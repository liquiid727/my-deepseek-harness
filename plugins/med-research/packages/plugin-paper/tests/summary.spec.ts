/**
 * S03 structured summary coverage (SPEC-R001-S03-002, §8). The spec fixes the
 * field list, the order, the unreported marker, and the rule that a reported
 * value keeps its source anchor; those are pinned here so a later extractor
 * cannot quietly drop or infer a field.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import {
  PAPER_SUMMARY_FIELD_KEYS,
  documentIdSchema,
  paperIdSchema,
  paragraphIdSchema,
  projectIdSchema,
  sectionIdSchema,
  type FulltextResolution,
  type MedFulltextService,
  type Paper,
  type PaperSummary,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { PapersService } from '../src/service.ts'

const PROJECT = projectIdSchema.parse('project-1')
const PAPER = paperIdSchema.parse('paper-1')
const DOCUMENT = documentIdSchema.parse('doc-1')

const offlineFulltext: MedFulltextService = {
  resolve: async (): Promise<FulltextResolution> => ({ status: 'unavailable' }),
}

/** Sections the "paper" reports; every other spec field stays unreported. */
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['Abstract', 'Ondansetron may reduce PONV after surgery.'],
  ['Methods', 'We randomized 120 adults to ondansetron or placebo.'],
  ['Results', 'PONV fell from 48% to 26% (risk ratio 0.54, 95% CI 0.35 to 0.83).'],
  ['Limitations', 'Single centre and short follow-up.'],
  ['Conclusion', 'Ondansetron prophylaxis reduced PONV in this cohort.'],
]

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

interface App {
  storage: MedStorage
  service: PapersService
}

async function boot(): Promise<App> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  booted.push({
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  })

  const now = '2026-01-01T00:00:00.000Z'
  const record: Paper = {
    id: PAPER, title: 'Ondansetron for PONV', authors: [], publicationTypes: [], meshTerms: [], keywords: [],
    source: 'pubmed', fulltextStatus: 'available', createdAt: now, updatedAt: now,
  }
  await storage.papers.put(PAPER, record)
  await storage.documents.put(DOCUMENT, {
    id: DOCUMENT, paperId: PAPER, sourceType: 'pmc_xml', contentHash: 'h', parseStatus: 'READY', createdAt: now,
  })
  for (const [index, [title, text]] of SECTIONS.entries()) {
    const sectionId = sectionIdSchema.parse(`sec-${index}`)
    // Section `type` is a fixed enum; the title carries the searchable name.
    const type = title.toLowerCase() === 'conclusion' ? 'conclusion' as const
      : title.toLowerCase() === 'results' ? 'results' as const
        : title.toLowerCase() === 'methods' ? 'methods' as const
          : title.toLowerCase() === 'abstract' ? 'abstract' as const
            : 'other' as const
    await storage.sections.put(sectionId, { id: sectionId, documentId: DOCUMENT, title, type, order: index })
    const paragraphId = paragraphIdSchema.parse(`par-${index}`)
    await storage.paragraphs.put(paragraphId, { id: paragraphId, sectionId, order: 0, text, rawText: text })
  }

  const service = new PapersService({
    storage,
    fulltext: offlineFulltext,
    fetchText: async () => '',
    extractPdf: async () => ({ pages: [] }),
    maxSearchResults: 20,
    now: () => now,
    newPaperId: () => paperIdSchema.parse('paper-new'),
    newDocumentId: () => documentIdSchema.parse('doc-new'),
    newSectionId: () => sectionIdSchema.parse('sec-new'),
    newParagraphId: () => paragraphIdSchema.parse('par-new'),
    newEvidenceChunkId: () => paragraphIdSchema.parse('chunk-new') as never,
    newNoteId: () => paragraphIdSchema.parse('note-new') as never,
    newAnnotationId: () => paragraphIdSchema.parse('ann-new') as never,
  })
  return { storage, service }
}

const summaryOf = (app: App, mode: PaperSummary['mode']): Promise<PaperSummary> =>
  app.service.summary({ projectId: PROJECT, paperId: PAPER, mode })

describe('S03 structured paper summary (SPEC-R001-S03-002)', () => {
  it('covers every spec field in the spec order', async () => {
    const app = await boot()
    const summary = await summaryOf(app, 'structured')
    expect(summary.fields.map(field => field.key)).toEqual([...PAPER_SUMMARY_FIELD_KEYS])
  })

  it('reports values from the sections that report them, with their anchor', async () => {
    const app = await boot()
    const summary = await summaryOf(app, 'structured')
    const byKey = new Map(summary.fields.map(field => [field.key, field]))
    expect(byKey.get('keyResults')).toMatchObject({ reported: true })
    expect(byKey.get('keyResults')!.value).toContain('risk ratio 0.54')
    expect(byKey.get('limitations')!.value).toContain('Single centre')
    // A reported value keeps the exact paragraph it came from.
    expect(byKey.get('keyResults')!.anchor?.paragraphId).toBe(paragraphIdSchema.parse('par-2'))
    expect(byKey.get('keyResults')!.anchor?.projectId).toBe(PROJECT)
  })

  it('marks a field the source does not report instead of inferring it', async () => {
    const app = await boot()
    const summary = await summaryOf(app, 'structured')
    const byKey = new Map(summary.fields.map(field => [field.key, field]))
    // The document says nothing about bias or project relevance.
    expect(byKey.get('bias')).toMatchObject({ reported: false, value: '未报告' })
    expect(byKey.get('bias')!.anchor).toBeUndefined()
    expect(summary.missingFields).toContain('bias')
    expect(summary.missingFields).toContain('projectRelevance')
    // A reported field is never listed as missing.
    expect(summary.missingFields).not.toContain('keyResults')
  })

  it('orders the three-minute mode as the spec lists it', async () => {
    const app = await boot()
    const summary = await summaryOf(app, 'threeMinute')
    expect(summary.fields.map(field => field.key)).toEqual([
      'researchQuestion', 'studyDesign', 'population', 'keyResults', 'limitations', 'projectRelevance',
    ])
  })

  it('derives the one-sentence mode from the source text', async () => {
    const app = await boot()
    const summary = await summaryOf(app, 'oneSentence')
    expect(summary.fields.map(field => field.key)).toEqual(['researchQuestion'])
    expect(summary.sections[0]!.text).toBe('Ondansetron may reduce PONV after surgery.')
  })
})
