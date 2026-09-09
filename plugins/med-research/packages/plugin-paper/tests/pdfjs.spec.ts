import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import {
  documentIdSchema,
  evidenceChunkIdSchema,
  paperIdSchema,
  paragraphIdSchema,
  projectIdSchema,
  sectionIdSchema,
  type FulltextResolution,
  type MedFulltextService,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { extractPdfPages } from '../src/pdfjs.ts'
import { PapersService } from '../src/service.ts'

const FIXTURE = new URL('./fixtures/pdf/sample.pdf', import.meta.url).pathname

const offlineFulltext: MedFulltextService = {
  resolve: async (): Promise<FulltextResolution> => ({ status: 'unavailable' }),
}

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function boot(): Promise<{ storage: MedStorage; service: PapersService }> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  let sequence = 0
  const service = new PapersService({
    storage,
    fulltext: offlineFulltext,
    fetchText: async () => '',
    extractPdf: extractPdfPages,
    maxSearchResults: 50,
    now: () => '2026-01-01T00:00:00.000Z',
    newPaperId: () => paperIdSchema.parse(`paper-${++sequence}`),
    newDocumentId: () => documentIdSchema.parse(`doc-${sequence}`),
    newSectionId: () => sectionIdSchema.parse(`sec-${sequence}`),
    newEvidenceChunkId: () => evidenceChunkIdSchema.parse(`chunk-${sequence}`),
    newParagraphId: () => paragraphIdSchema.parse(`par-${sequence}`),
  })
  booted.push({
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  })
  return { storage, service }
}

describe('PDF extraction (SPEC §22.2, US-004)', () => {
  it('extracts real page text from a PDF file', async () => {
    const extraction = await extractPdfPages(FIXTURE)
    expect(extraction.pages.map(page => page.page)).toEqual([1, 2])
    expect(extraction.pages[0]!.text).toContain('PONV was associated with higher pain scores')
    expect(extraction.pages[1]!.text).toContain('significant reduction in opioid consumption')
    expect(extraction.pages.every(page => page.failed !== true)).toBe(true)
  })

  it('uploads a PDF as a parsed paper with page-tagged paragraphs', async () => {
    const app = await boot()
    const project = projectIdSchema.parse('project-1')
    const paper = await app.service.upload(project, FIXTURE)

    expect(paper.source).toBe('upload')
    expect(paper.fulltextStatus).toBe('user_upload')
    expect(paper.title).toBe('sample')

    const documents = await app.service.document(paper.id)
    expect(documents).toHaveLength(1)
    expect(documents[0]!.parseStatus).toBe('READY')
    expect(documents[0]!.sourceType).toBe('uploaded_pdf')

    const paragraphs = [...app.storage.paragraphs.entries()].map(([, value]) => value)
    expect(paragraphs.length).toBeGreaterThan(0)
    expect(paragraphs.some(paragraph => paragraph.page === 2)).toBe(true)
    expect(paragraphs.map(paragraph => paragraph.text).join(' ')).toContain('opioid consumption')

    // SPEC §49: the upload left one audit row naming the paper, not its text.
    expect([...app.storage.auditLogs.entries()].map(([, row]) => row)).toEqual([
      expect.objectContaining({
        action: 'paper.upload',
        projectId: project,
        detail: expect.objectContaining({ paperId: paper.id, filename: 'sample.pdf' }),
      }),
    ])
  })
})
