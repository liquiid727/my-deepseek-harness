import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { normalizeParagraph } from '@medresearch/dsh-medical-domain'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { EvidenceError, EvidenceService } from '../src/service.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const PAPER = c.paperIdSchema.parse('paper-1')
const OTHER_PAPER = c.paperIdSchema.parse('paper-2')
const DOCUMENT = c.documentIdSchema.parse('doc-1')
const SECTION = c.sectionIdSchema.parse('sec-1')
const PARAGRAPH = c.paragraphIdSchema.parse('par-1')
const CHUNK = c.evidenceChunkIdSchema.parse('chunk-1')
const PROVENANCE = { extractorVersion: 'v1', extractorModel: 'model-x', promptVersion: 'p1' }

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

interface App {
  storage: MedStorage
  service: EvidenceService
}

async function boot(paragraphText = 'PONV was associated with higher pain scores in this cohort.'): Promise<App> {
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

  await storage.projects.put(PROJECT, {
    id: PROJECT, name: 'P', keywords: [], workspacePath: '/tmp/p', status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.papers.put(PAPER, {
    id: PAPER, title: 'A paper', authors: [], publicationTypes: [], meshTerms: [], keywords: [],
    source: 'pubmed', fulltextStatus: 'available',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.projectPapers.put(`${PROJECT}|${PAPER}`, {
    projectId: PROJECT, paperId: PAPER, savedAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.documents.put(DOCUMENT, {
    id: DOCUMENT, paperId: PAPER, sourceType: 'pmc_xml', contentHash: 'h', parseStatus: 'READY',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.sections.put(SECTION, { id: SECTION, documentId: DOCUMENT, title: 'Results', type: 'results', order: 0 })
  await storage.paragraphs.put(PARAGRAPH, {
    id: PARAGRAPH, sectionId: SECTION, order: 0, text: paragraphText, rawText: paragraphText,
  })
  await storage.chunks.put(CHUNK, {
    id: CHUNK, paperId: PAPER, documentId: DOCUMENT, sectionType: 'results', sectionTitle: 'Results',
    paragraphIds: [PARAGRAPH], text: paragraphText,
  })

  let sequence = 0
  const service = new EvidenceService({
    storage,
    alignment: { tolerance: 0.05, windowSize: 8 },
    maxRetrieval: 10,
    maxHops: 3,
    now: () => '2026-01-01T00:00:00.000Z',
    newEvidenceId: () => c.evidenceIdSchema.parse(`evidence-${++sequence}`),
  })
  return { storage, service }
}

async function save(app: App, overrides: Partial<{ quote: string; relation: c.EvidenceRelation; sourceType: c.EvidenceSourceType }> = {}) {
  return app.service.save({
    projectId: PROJECT,
    candidate: {
      paragraphId: PARAGRAPH,
      quote: overrides.quote ?? 'PONV was associated with higher pain scores',
      relation: overrides.relation ?? 'SUPPORT',
      reason: 'reported association',
    },
    provenance: PROVENANCE,
    ...overrides.sourceType === undefined ? {} : { sourceType: overrides.sourceType },
  })
}

describe('EvidenceService (SPEC §56 matrix)', () => {
  it('locates a full-text direct support quote as FOUND and verifies it', async () => {
    const app = await boot()
    const evidence = await save(app)
    expect(evidence.locatorStatus).toBe('FOUND')
    expect(evidence.supportStatus).toBe('PENDING')
    expect(evidence.sourceType).toBe('fulltext')
    expect(evidence.offsetBase).toBe('normalized_paragraph')
    expect(evidence.extractorVersion).toBe('v1')
    expect(evidence.startOffset).toBe(0)

    const verified = await app.service.verify(evidence.id, 'VERIFIED')
    expect(verified.supportStatus).toBe('VERIFIED')
  })

  it('stores a full-text direct against quote with its relation', async () => {
    const app = await boot()
    const evidence = await save(app, { relation: 'AGAINST' })
    expect(evidence.relation).toBe('AGAINST')
    expect(evidence.locatorStatus).toBe('FOUND')
  })

  it('marks abstract-derived evidence as abstract', async () => {
    const app = await boot()
    await app.storage.documents.put(c.documentIdSchema.parse('doc-2'), {
      id: c.documentIdSchema.parse('doc-2'), paperId: PAPER, sourceType: 'abstract', contentHash: 'h2',
      parseStatus: 'ABSTRACT_ONLY', createdAt: '2026-01-01T00:00:00.000Z',
    })
    const section = c.sectionIdSchema.parse('sec-2')
    await app.storage.sections.put(section, { id: section, documentId: c.documentIdSchema.parse('doc-2'), title: 'Abstract', type: 'abstract', order: 0 })
    const paragraph = c.paragraphIdSchema.parse('par-2')
    await app.storage.paragraphs.put(paragraph, {
      id: paragraph, sectionId: section, order: 0,
      text: 'PONV was associated with higher pain scores', rawText: 'PONV was associated with higher pain scores',
    })

    const evidence = await app.service.save({
      projectId: PROJECT,
      candidate: { paragraphId: paragraph, quote: 'PONV was associated with higher pain scores', relation: 'SUPPORT', reason: '' },
      provenance: PROVENANCE,
    })
    expect(evidence.sourceType).toBe('abstract')
    expect(evidence.section).toBe('Abstract')
  })

  it('stores an explicitly marked secondary citation', async () => {
    const app = await boot()
    const evidence = await save(app, { sourceType: 'secondary_citation' })
    expect(evidence.sourceType).toBe('secondary_citation')
  })

  it('records a quote from the wrong paragraph as NOT_FOUND / REJECTED', async () => {
    const app = await boot('The second paragraph has entirely different content about mortality.')
    const evidence = await save(app, { quote: 'PONV was associated with higher pain scores' })
    expect(evidence.locatorStatus).toBe('NOT_FOUND')
    expect(evidence.supportStatus).toBe('REJECTED')
  })

  it('never turns a NOT_FOUND evidence into VERIFIED (hard rule negative)', async () => {
    const app = await boot('Nothing relevant here at all.')
    const evidence = await save(app, { quote: 'PONV was associated with higher pain scores' })
    expect(evidence.locatorStatus).toBe('NOT_FOUND')
    const verified = await app.service.verify(evidence.id, 'VERIFIED')
    expect(verified.supportStatus).toBe('REJECTED')
    expect(verified.locatorStatus).toBe('NOT_FOUND')
  })

  it('keeps the relation the model reported (direction is the verifier\'s job)', async () => {
    const app = await boot()
    const evidence = await save(app, { relation: 'AGAINST' })
    const rejected = await app.service.verify(evidence.id, 'REJECTED')
    expect(rejected.relation).toBe('AGAINST')
    expect(rejected.supportStatus).toBe('REJECTED')
  })

  it('returns an empty list for a claim without evidence', async () => {
    const app = await boot()
    expect(await app.service.listForClaim(c.claimIdSchema.parse('claim-none'))).toEqual([])
  })

  it('lists conflicting support and counter evidence for one claim', async () => {
    const app = await boot()
    const support = await save(app, { relation: 'SUPPORT' })
    const against = await save(app, { relation: 'AGAINST' })
    const claim = c.claimIdSchema.parse('claim-1')
    await app.storage.claimEvidences.put(`${claim}|${support.id}`, { claimId: claim, evidenceId: support.id, role: 'support' })
    await app.storage.claimEvidences.put(`${claim}|${against.id}`, { claimId: claim, evidenceId: against.id, role: 'counter' })

    const listed = await app.service.listForClaim(claim)
    expect(listed.map(item => item.relation).sort()).toEqual(['AGAINST', 'SUPPORT'])
  })

  it('fails loud when a claim binding names a missing evidence', async () => {
    const app = await boot()
    const claim = c.claimIdSchema.parse('claim-1')
    await app.storage.claimEvidences.put(`${claim}|ghost`, {
      claimId: claim, evidenceId: c.evidenceIdSchema.parse('ghost'), role: 'support',
    })
    await expect(app.service.listForClaim(claim)).rejects.toBeInstanceOf(EvidenceError)
  })

  it('matches a quote across normalization edges (ligature, hyphen, whitespace)', async () => {
    const app = await boot(normalizeParagraph('The \uFB01nal   outcome\u00ADline was not significant.'))
    const evidence = await save(app, { quote: 'The \uFB01nal outcome\u00ADline was not significant.' })
    expect(evidence.locatorStatus).toBe('FOUND')
    expect(evidence.normalizedText).toBe('The final outcomeline was not significant.')
  })

  it('accepts a near match as PARTIAL and keeps it locatable', async () => {
    const app = await boot('The treatment group showed a significant reduction in pain scores overall.')
    const evidence = await save(app, { quote: 'The treatment group showed a signifcant reduction in pain scores' })
    expect(evidence.locatorStatus).toBe('PARTIAL')
    expect(evidence.supportStatus).toBe('PENDING')
    const verified = await app.service.verify(evidence.id, 'VERIFIED')
    expect(verified.supportStatus).toBe('VERIFIED')
  })

  it('ranks the relevant chunk first and scopes retrieval to the project library', async () => {
    const app = await boot()
    await app.storage.papers.put(OTHER_PAPER, {
      id: OTHER_PAPER, title: 'Other', authors: [], publicationTypes: [], meshTerms: [], keywords: [],
      source: 'pubmed', fulltextStatus: 'available',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await app.storage.documents.put(c.documentIdSchema.parse('doc-other'), {
      id: c.documentIdSchema.parse('doc-other'), paperId: OTHER_PAPER, sourceType: 'pmc_xml', contentHash: 'h3',
      parseStatus: 'READY', createdAt: '2026-01-01T00:00:00.000Z',
    })
    await app.storage.chunks.put(c.evidenceChunkIdSchema.parse('chunk-other'), {
      id: c.evidenceChunkIdSchema.parse('chunk-other'), paperId: OTHER_PAPER, documentId: c.documentIdSchema.parse('doc-other'),
      sectionType: 'results', sectionTitle: 'Results', paragraphIds: [PARAGRAPH],
      text: 'PONV pain pain pain unrelated duplicate text about pain',
    })

    const hits = await app.service.retrieve({
      projectId: PROJECT, claimText: 'PONV and postoperative pain', conceptTerms: ['pain'], maxResults: 5,
    })
    expect(hits.map(hit => hit.id)).toContain(CHUNK)
    expect(hits.map(hit => hit.id)).not.toContain('chunk-other')
  })
})
