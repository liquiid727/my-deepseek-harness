/**
 * S04 lifecycle coverage (SPEC-R001-S04-001..004). These tests pin the
 * behaviours the spec makes normative but the first implementation missed:
 * qualification of PARTIAL/secondary/UNCERTAIN evidence, the aggregate claim
 * status, verification provenance, withdrawal propagation, citation map
 * de-duplication, and Reference Chasing.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { EvidenceService, type ReferenceResolver } from '../src/service.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const OTHER_PROJECT = c.projectIdSchema.parse('project-2')
const PAPER = c.paperIdSchema.parse('paper-1')
const DOCUMENT = c.documentIdSchema.parse('doc-1')
const SECTION = c.sectionIdSchema.parse('sec-1')
const PARAGRAPH = c.paragraphIdSchema.parse('par-1')

/** The original paper a reference resolves to. */
const ORIGINAL_PAPER = c.paperIdSchema.parse('paper-original')
const ORIGINAL_DOCUMENT = c.documentIdSchema.parse('doc-original')
const ORIGINAL_SECTION = c.sectionIdSchema.parse('sec-original')
const ORIGINAL_PARAGRAPH = c.paragraphIdSchema.parse('par-original')
const ORIGINAL_TEXT = 'The original trial reported a lower PONV incidence with the intervention.'

const QUERY = c.researchQueryIdSchema.parse('query-1')
const PROVENANCE = { extractorVersion: 'v1', extractorModel: 'model-x', promptVersion: 'p1' }
const PARAGRAPH_TEXT = 'PONV was associated with higher pain scores in this cohort.'

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

interface App {
  storage: MedStorage
  service: EvidenceService
}

async function boot(resolver?: ReferenceResolver): Promise<App> {
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
    id: PAPER, title: 'A paper', authors: [], publicationTypes: ['Randomized Controlled Trial'],
    meshTerms: [], keywords: [], pmid: '111', doi: '10.1000/one', source: 'pubmed',
    fulltextStatus: 'available', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.projectPapers.put(`${PROJECT}|${PAPER}`, { projectId: PROJECT, paperId: PAPER, savedAt: '2026-01-01T00:00:00.000Z' })
  await storage.documents.put(DOCUMENT, {
    id: DOCUMENT, paperId: PAPER, sourceType: 'pmc_xml', contentHash: 'h', parseStatus: 'READY',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.sections.put(SECTION, { id: SECTION, documentId: DOCUMENT, title: 'Results', type: 'results', order: 0 })
  await storage.paragraphs.put(PARAGRAPH, { id: PARAGRAPH, sectionId: SECTION, order: 0, text: PARAGRAPH_TEXT, rawText: PARAGRAPH_TEXT })

  // The paper a chased reference resolves to: a real, separately stored source.
  await storage.papers.put(ORIGINAL_PAPER, {
    id: ORIGINAL_PAPER, title: 'Original trial', authors: [], publicationTypes: [], meshTerms: [], keywords: [],
    source: 'pubmed', fulltextStatus: 'available',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.documents.put(ORIGINAL_DOCUMENT, {
    id: ORIGINAL_DOCUMENT, paperId: ORIGINAL_PAPER, sourceType: 'pmc_xml', contentHash: 'ho', parseStatus: 'READY',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.sections.put(ORIGINAL_SECTION, { id: ORIGINAL_SECTION, documentId: ORIGINAL_DOCUMENT, title: 'Results', type: 'results', order: 0 })
  await storage.paragraphs.put(ORIGINAL_PARAGRAPH, { id: ORIGINAL_PARAGRAPH, sectionId: ORIGINAL_SECTION, order: 0, text: ORIGINAL_TEXT, rawText: ORIGINAL_TEXT })

  let sequence = 0
  const service = new EvidenceService({
    storage,
    alignment: { tolerance: 0.05, windowSize: 8 },
    maxRetrieval: 10,
    maxHops: 2,
    now: () => '2026-01-01T00:00:00.000Z',
    newEvidenceId: () => c.evidenceIdSchema.parse(`evidence-${++sequence}`),
    newClaimId: () => c.claimIdSchema.parse(`claim-${++sequence}`),
    ...resolver === undefined ? {} : { referenceResolver: resolver },
  })
  return { storage, service }
}

async function saveQuote(app: App, quote: string, options: {
  relation?: c.EvidenceRelation
  sourceType?: c.EvidenceSourceType
  paragraphId?: c.ParagraphId
} = {}): Promise<c.Evidence> {
  return app.service.save({
    projectId: PROJECT,
    candidate: { paragraphId: options.paragraphId ?? PARAGRAPH, quote, relation: options.relation ?? 'SUPPORT', reason: '' },
    provenance: PROVENANCE,
    ...options.sourceType === undefined ? {} : { sourceType: options.sourceType },
  })
}

/** Save a quote and mark it semantically verified. */
async function verified(app: App, quote: string, options: Parameters<typeof saveQuote>[2] = {}): Promise<c.Evidence> {
  const evidence = await saveQuote(app, quote, options)
  return app.service.verify(evidence.id, 'VERIFIED', { reason: 'gold-set review' })
}

const SUPPORT_QUOTE = 'PONV was associated with higher pain scores'
const AGAINST_QUOTE = 'in this cohort'

describe('S04 evidence lifecycle (SPEC-R001-S04)', () => {
  it('keeps the matched anchors and unmatched ranges of a PARTIAL locator', async () => {
    const app = await boot()
    // One substitution inside an otherwise identical quote: PARTIAL, but with
    // exact spans that can still be highlighted.
    const evidence = await saveQuote(app, 'PONV was associated with higher pain scorez in this cohort.')
    expect(evidence.locatorStatus).toBe('PARTIAL')
    const matched = evidence.matchedAnchors ?? []
    expect(matched.length).toBeGreaterThan(0)
    expect(evidence.unmatchedRanges?.length ?? 0).toBeGreaterThan(0)
    // Every matched span is a real, non-empty slice of the stored paragraph, in
    // ascending order and disjoint, so the reader can highlight it exactly.
    let cursor = -1
    for (const span of matched) {
      expect(span.end).toBeGreaterThan(span.start)
      expect(span.start).toBeGreaterThan(cursor)
      expect(PARAGRAPH_TEXT.slice(span.start, span.end).length).toBe(span.end - span.start)
      cursor = span.end
    }
  })

  it('lists a project claims newest first and never leaks another project', async () => {
    const app = await boot()
    const claim = (id: string, projectId: string, createdAt: string) => ({
      id,
      projectId,
      researchQueryId: QUERY,
      text: `claim-${id}`,
      evidenceIds: [],
      counterEvidenceIds: [],
      evidenceStatus: 'INSUFFICIENT' as const,
      supportStatus: 'UNCERTAIN' as const,
      rejectionReasons: [],
      createdAt,
    })
    await app.storage.claims.put('c-old' as never, claim('c-old', PROJECT, '2025-01-01T00:00:00.000Z') as never)
    await app.storage.claims.put('c-new' as never, claim('c-new', PROJECT, '2025-06-01T00:00:00.000Z') as never)
    await app.storage.claims.put('c-other' as never, claim('c-other', 'project-2', '2025-12-01T00:00:00.000Z') as never)

    const claims = await app.service.listClaims(PROJECT)
    expect(claims.map(item => item.id)).toEqual(['c-new', 'c-old'])
    expect(await app.service.listClaims('project-3' as never)).toEqual([])
  })

  it('refuses to qualify a PARTIAL record that carries no exact matched span', async () => {
    const app = await boot()
    const evidence = await verified(app, SUPPORT_QUOTE)
    // Force the un-highlightable shape a bad locator would produce.
    await app.storage.evidences.put(evidence.id, {
      ...evidence, locatorStatus: 'PARTIAL', matchedAnchors: [], supportStatus: 'VERIFIED',
    })
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores', evidenceIds: [evidence.id],
    })
    expect(gated.status).toBe('INSUFFICIENT')
    expect(gated.reasons).toContain(`EVIDENCE_PARTIAL_WITHOUT_ANCHOR:${evidence.id}`)
  })

  it('never lets a secondary citation support a claim, and reports it separately', async () => {
    const app = await boot()
    const secondary = await verified(app, SUPPORT_QUOTE, { sourceType: 'secondary_citation' })
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores', evidenceIds: [secondary.id],
    })
    expect(gated.status).toBe('INSUFFICIENT')
    expect(gated.counts.secondary).toBe(1)
    expect(gated.counts.support).toBe(0)
    expect(gated.reasons).toContain(`EVIDENCE_SECONDARY:${secondary.id}`)
  })

  it('reports CONSISTENT when only one side has qualified evidence, with counts', async () => {
    const app = await boot()
    const support = await verified(app, SUPPORT_QUOTE)
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores', evidenceIds: [support.id],
    })
    expect(gated.status).toBe('CONSISTENT')
    expect(gated.counts).toEqual({ support: 1, against: 0, pending: 0, secondary: 0 })
    expect(gated.claim?.evidenceStatus).toBe('CONSISTENT')
  })

  it('reports CONFLICTING when qualified support and qualified counter evidence coexist', async () => {
    const app = await boot()
    const support = await verified(app, SUPPORT_QUOTE)
    const against = await verified(app, AGAINST_QUOTE, { relation: 'AGAINST' })
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores',
      evidenceIds: [support.id], counterEvidenceIds: [against.id],
    })
    expect(gated.status).toBe('CONFLICTING')
    expect(gated.counts).toMatchObject({ support: 1, against: 1 })
    // The counter evidence is kept, never averaged away.
    expect(gated.claim?.counterEvidenceIds).toEqual([against.id])
  })

  it('counts pending evidence separately instead of using it as support', async () => {
    const app = await boot()
    const pending = await saveQuote(app, SUPPORT_QUOTE)
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores', evidenceIds: [pending.id],
    })
    expect(gated.status).toBe('INSUFFICIENT')
    expect(gated.counts.pending).toBe(1)
    expect(gated.reasons).toContain(`EVIDENCE_NOT_VERIFIED:${pending.id}`)
    expect(gated.reasons).toContain('NO_SUPPORTING_EVIDENCE')
  })

  it('records the verdict reason and verifier version, and keeps UNCERTAIN at PENDING', async () => {
    const app = await boot()
    const evidence = await saveQuote(app, SUPPORT_QUOTE)
    const verified = await app.service.verify(evidence.id, 'VERIFIED', {
      reason: 'quote matches the reported association',
      verificationVersion: 'verifier-2',
    })
    expect(verified.verificationReason).toBe('quote matches the reported association')
    expect(verified.verificationVersion).toBe('verifier-2')
    expect(verified.verifiedAt).toBe('2026-01-01T00:00:00.000Z')

    const uncertain = await app.service.verify(evidence.id, 'VERIFIED', { relation: 'UNCERTAIN', reason: 'ambiguous wording' })
    expect(uncertain.relation).toBe('UNCERTAIN')
    expect(uncertain.supportStatus).toBe('PENDING')
  })

  it('never lets a NOT_FOUND locator reach VERIFIED', async () => {
    const app = await boot()
    const evidence = await saveQuote(app, 'a quote that does not appear anywhere in the paragraph')
    expect(evidence.locatorStatus).toBe('NOT_FOUND')
    expect(evidence.supportStatus).toBe('REJECTED')
    const forced = await app.service.verify(evidence.id, 'VERIFIED')
    expect(forced.supportStatus).toBe('REJECTED')
  })

  it('propagates a withdrawal to claims and drafts', async () => {
    const app = await boot()
    const evidence = await verified(app, SUPPORT_QUOTE)
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores', evidenceIds: [evidence.id],
    })
    expect(gated.status).toBe('CONSISTENT')

    const draftId = c.draftIdSchema.parse('draft-1')
    await app.storage.drafts.put(draftId, {
      id: draftId, projectId: PROJECT, title: 'D', outline: [], body: 'body',
      facts: [{ text: SUPPORT_QUOTE, evidenceIds: [evidence.id] }], claimIds: [], evidenceIds: [evidence.id],
      status: 'REVIEWABLE', revision: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const withdrawn = await app.service.withdraw(evidence.id, 'source retracted')
    expect(withdrawn.withdrawnAt).toBe('2026-01-01T00:00:00.000Z')

    const claim = app.storage.claims.get(gated.claim!.id)
    expect(claim?.supportStatus).toBe('PENDING')
    expect(claim?.evidenceStatus).toBe('INSUFFICIENT')
    expect(claim?.rejectionReasons).toContain(`EVIDENCE_WITHDRAWN:${evidence.id}`)
    expect(app.storage.drafts.get(draftId)?.status).toBe('DRAFT')
  })

  it('numbers citations by first appearance and keeps one index per evidence', async () => {
    const app = await boot()
    const support = await verified(app, SUPPORT_QUOTE)
    const against = await verified(app, AGAINST_QUOTE, { relation: 'AGAINST' })
    const gated = await app.service.gateClaim({
      projectId: PROJECT, researchQueryId: QUERY, text: 'PONV rises with pain scores',
      // The same evidence appears on both sides; it must still take one index.
      evidenceIds: [support.id, support.id], counterEvidenceIds: [against.id, support.id],
    })
    const map = await app.service.serializeCitations(gated.claim!.id)
    expect(map.entries.map(entry => entry.index)).toEqual([1, 2])
    expect(map.entries.map(entry => entry.evidenceId)).toEqual([support.id, against.id])
    expect(map.entries[0]!.pmid).toBe('111')
    expect(map.entries[0]!.doi).toBe('10.1000/one')
    expect(map.entries[0]!.anchor?.paragraphId).toBe(PARAGRAPH)
  })

  it('reports comparison rows with relation, source class, statuses, and metadata', async () => {
    const app = await boot()
    const evidence = await verified(app, SUPPORT_QUOTE)
    const comparison = await app.service.compare(PROJECT, [evidence.id])
    expect(comparison.rows).toHaveLength(1)
    expect(comparison.rows[0]).toMatchObject({
      quote: SUPPORT_QUOTE,
      relation: 'SUPPORT',
      sourceType: 'fulltext',
      locatorStatus: 'FOUND',
      supportStatus: 'VERIFIED',
      status: 'FOUND/VERIFIED',
      withdrawn: false,
      studyDesign: 'Randomized Controlled Trial',
    })
    expect(comparison.rows[0]!.paper?.id).toBe(PAPER)
  })

  it('excludes other projects from retrieval and comparison', async () => {
    const app = await boot()
    const evidence = await verified(app, SUPPORT_QUOTE)
    expect((await app.service.compare(OTHER_PROJECT, [evidence.id])).rows).toEqual([])
    const gated = await app.service.gateClaim({
      projectId: OTHER_PROJECT, researchQueryId: QUERY, text: 'x', evidenceIds: [evidence.id],
    })
    expect(gated.reasons).toContain(`PROJECT_SCOPE:${evidence.id}`)
  })
})

describe('S04 Reference Chasing (SPEC-R001-S04-004)', () => {
  const secondary = async (app: App): Promise<c.Evidence> => verified(app, SUPPORT_QUOTE, { sourceType: 'secondary_citation' })

  it('resolves a secondary citation into a new direct evidence and records the hop', async () => {
    const resolver: ReferenceResolver = {
      resolve: async () => ({
        status: 'RESOLVED',
        paperId: ORIGINAL_PAPER,
        documentId: ORIGINAL_DOCUMENT,
        paragraphId: ORIGINAL_PARAGRAPH,
        quote: 'PONV incidence with the intervention',
      }),
    }
    const app = await boot(resolver)
    const origin = await secondary(app)
    const result = await app.service.chase({ evidenceId: origin.id, reference: { doi: '10.1000/orig' } })

    expect(result.status).toBe('RESOLVED')
    expect(result.hops).toEqual([{
      source: 'declared-reference-connector',
      identifier: '10.1000/orig',
      status: 'RESOLVED',
      reason: `resolved to paper ${ORIGINAL_PAPER}`,
    }])
    expect(result.evidence?.paperId).toBe(ORIGINAL_PAPER)
    expect(result.evidence?.sourceType).toBe('fulltext')
    expect(result.evidence?.locatorStatus).toBe('FOUND')
    // The original secondary record keeps its own status untouched.
    expect(app.storage.evidences.get(origin.id)).toMatchObject({ sourceType: 'secondary_citation', locatorStatus: 'FOUND' })
  })

  it('records the failure without touching the original record when the hop fails', async () => {
    const resolver: ReferenceResolver = { resolve: async () => ({ status: 'UNRESOLVED', reason: 'no identifier matched' }) }
    const app = await boot(resolver)
    const origin = await secondary(app)
    const result = await app.service.chase({ evidenceId: origin.id, reference: { title: 'Unknown reference' } })
    expect(result.status).toBe('UNRESOLVED')
    expect(result.evidence).toBeUndefined()
    expect(result.hops[0]).toMatchObject({ status: 'UNRESOLVED', reason: 'no identifier matched' })
    expect(app.storage.evidences.get(origin.id)?.locatorStatus).toBe('FOUND')
  })

  it('reports CHASE_LIMIT when the configured hop cap leaves no hop to take', async () => {
    const resolver: ReferenceResolver = { resolve: async () => ({ status: 'UNRESOLVED', reason: 'never called' }) }
    const app = await boot(resolver)
    const origin = await secondary(app)
    const result = await app.service.chase({ evidenceId: origin.id, reference: { pmid: '999' }, maxHops: 0 })
    expect(result.status).toBe('CHASE_LIMIT')
    expect(result.hops).toEqual([])
  })

  it('says so plainly when no declared reference connector is configured', async () => {
    const app = await boot()
    const origin = await secondary(app)
    const result = await app.service.chase({ evidenceId: origin.id, reference: { pmid: '999' } })
    expect(result).toEqual({ status: 'UNRESOLVED', hops: [], reason: 'no declared reference connector is configured' })
  })
})
