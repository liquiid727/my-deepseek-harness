import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import {
  documentIdSchema,
  evidenceChunkIdSchema,
  paperIdSchema,
  paragraphIdSchema,
  sectionIdSchema,
  type FulltextResolution,
  type MedFulltextService,
  type Paper,
} from '@medresearch/dsh-medical-contracts'
import { alignQuote } from '@medresearch/dsh-medical-domain'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { PapersService } from '../src/service.ts'

const PAPER = paperIdSchema.parse('paper-1')
const fixture = (): string => readFileSync(new URL('./fixtures/jats/europepmc-fulltext.xml', import.meta.url), 'utf8')

const offlineFulltext: MedFulltextService = {
  resolve: async (): Promise<FulltextResolution> => ({ status: 'unavailable' }),
}

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: PAPER,
    title: 'A paper',
    authors: [],
    publicationTypes: [],
    meshTerms: [],
    keywords: [],
    source: 'pubmed',
    fulltextStatus: 'abstract_only',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

interface Booted {
  storage: MedStorage
  service: PapersService
  close(): Promise<void>
}

const booted: Booted[] = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function boot(): Promise<Booted> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  let documentSequence = 0
  let sectionSequence = 0
  let paragraphSequence = 0
  const service = new PapersService({
    storage,
    fulltext: offlineFulltext,
    fetchText: async () => '',
    extractPdf: async () => ({ pages: [] }),
    maxSearchResults: 50,
    now: () => '2026-01-01T00:00:00.000Z',
    newPaperId: () => paperIdSchema.parse(`paper-${++documentSequence}`),
    newDocumentId: () => documentIdSchema.parse(`doc-${++documentSequence}`),
    newSectionId: () => sectionIdSchema.parse(`sec-${++sectionSequence}`),
    newEvidenceChunkId: () => evidenceChunkIdSchema.parse(`chunk-${++paragraphSequence}`),
    newParagraphId: () => paragraphIdSchema.parse(`par-${++paragraphSequence}`),
  })
  const bootedItem: Booted = {
    storage,
    service,
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  }
  booted.push(bootedItem)
  return bootedItem
}

describe('PapersService (SPEC §10, §22)', () => {
  it('stores a parsed JATS document with ordered sections and normalized paragraphs', async () => {
    const app = await boot()
    await app.storage.papers.put(PAPER, paper())

    const document = await app.service.ingestJats(PAPER, fixture())
    expect(document.parseStatus).toBe('READY')
    expect(document.paperId).toBe(PAPER)

    const sections = await app.service.sections(document.id)
    expect(sections.map(section => section.order)).toEqual(sections.map((_, index) => index))
    const introduction = sections.find(section => section.title === 'Introduction')
    expect(introduction?.type).toBe('introduction')

    const paragraphs = [...app.storage.paragraphs.entries()].map(([, value]) => value)
    expect(paragraphs.length).toBeGreaterThan(20)
    expect(paragraphs.every(paragraph => paragraph.text === paragraph.text.trim())).toBe(true)
  })

  it('parses the abstract lazily into an ABSTRACT_ONLY document', async () => {
    const app = await boot()
    await app.storage.papers.put(PAPER, paper({ abstract: 'PONV was associated with higher pain scores.' }))

    const documents = await app.service.document(PAPER)
    expect(documents).toHaveLength(1)
    expect(documents[0]!.parseStatus).toBe('ABSTRACT_ONLY')
    expect(documents[0]!.sourceType).toBe('abstract')
  })

  it('finds paragraphs by content and caps the result set', async () => {
    const app = await boot()
    await app.storage.papers.put(PAPER, paper())
    await app.service.ingestJats(PAPER, fixture())

    const matches = await app.service.search(PAPER, 'postoperative nausea')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]!.text.toLowerCase()).toContain('postoperative nausea')
    expect(await app.service.search(PAPER, 'zzz-not-present-zzz')).toEqual([])
  })

  it('keeps evidence offsets relative to the normalized paragraph (SPEC §22.3)', async () => {
    const app = await boot()
    await app.storage.papers.put(PAPER, paper())
    await app.service.ingestJats(PAPER, fixture())

    const paragraph = [...app.storage.paragraphs.entries()]
      .map(([, value]) => value)
      .find(value => value.text.length > 200)!
    const quote = paragraph.text.slice(20, 120)

    const exact = alignQuote(paragraph.text, quote, { tolerance: 0.05, windowSize: 8 })
    expect(exact.status).toBe('FOUND')
    // The quote is normalized before matching, so its leading/trailing space is trimmed.
    expect(paragraph.text.slice(exact.startOffset, exact.endOffset)).toBe(quote.trim())

    const near = alignQuote(paragraph.text, `${quote.slice(0, 50)}X${quote.slice(51)}`, { tolerance: 0.05, windowSize: 8 })
    expect(near.status).toBe('PARTIAL')

    expect(alignQuote(paragraph.text, 'a completely unrelated sentence about mortality', { tolerance: 0.05, windowSize: 8 }).status)
      .toBe('NOT_FOUND')
  })
})
