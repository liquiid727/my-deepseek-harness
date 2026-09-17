import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { alignQuote, serializeCitations, verifyClaim } from '@medresearch/dsh-medical-domain'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { EvidenceService } from '@medresearch/dsh-plugin-evidence'
import { LiteratureService, PubmedConnector, type PubmedConnectorOptions } from '@medresearch/dsh-plugin-literature'

import { PapersService } from '@medresearch/dsh-plugin-paper/src/service.ts'
import { ProjectsService } from '@medresearch/dsh-plugin-project/src/service.ts'

const fixture = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8')
const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => { for (const item of booted.splice(0)) await item.close() })

const offlineFulltext = { resolve: async (): Promise<c.FulltextResolution> => ({ status: 'unavailable' }) }

async function boot(): Promise<MedStorage> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  booted.push({ async close() { await storage.close(); await facility.closeAll(); await backend.close() } })
  return storage
}

describe('Research chain (PRD §36 Research DoD)', () => {
  it('runs question → real PMID → JATS → evidence → verified claim → [1] citation', async () => {
    const storage = await boot()
    let paperSequence = 0
    let querySequence = 0
    let documentSequence = 0
    let sectionSequence = 0
    let paragraphSequence = 0
    let evidenceSequence = 0

    const projects = new ProjectsService({
      storage,
      files: { async write() {} },
      workspaces: { async create() { return { id: 'ws-1' } } },
      workspaceRoot: '/tmp/med-e2e',
      now: () => '2026-01-01T00:00:00.000Z',
      newId: () => c.projectIdSchema.parse('project-1'),
    })
    const project = await projects.create({ name: 'PONV', researchQuestion: 'PONV 与术后疼痛是否相关？' })

    // 1. Literature: recorded PubMed replay persists papers.
    const connectorOptions: PubmedConnectorOptions = {
      baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils', tool: 'med-e2e', email: 'e2e@example.com',
      requestsPerSecond: 1e9, maxRetries: 0, backoffBaseMs: 1, timeoutMs: 5_000, retmax: 20,
      efetchBatchSize: 200, cacheTtlMs: 0, sleep: async () => {},
    }
    const routes = [
      { match: (url: URL) => url.pathname.endsWith('/esearch.fcgi'), body: fixture('../../plugin-literature/tests/fixtures/pubmed/esearch-ponv.json') },
      { match: (url: URL) => url.pathname.endsWith('/efetch.fcgi'), body: fixture('../../plugin-literature/tests/fixtures/pubmed/efetch-batch.xml') },
    ]
    const connector = new PubmedConnector(async (url: string) => {
      const route = routes.find(candidate => candidate.match(new URL(url)))
      if (route === undefined) throw new Error(`no replay route for ${url}`)
      return { status: 200, body: route.body }
    }, connectorOptions)
    const literature = new LiteratureService({
      connector, storage, defaultMaxResults: 2, now: () => '2026-01-01T00:00:00.000Z',
      newPaperId: () => c.paperIdSchema.parse(`paper-${++paperSequence}`),
      newResearchQueryId: () => c.researchQueryIdSchema.parse(`query-${++querySequence}`),
    })
    const plan = await literature.planQuery({ projectId: project.id, question: 'PONV 与术后疼痛是否相关？', plan: { normalizedQuestion: 'PONV and postoperative pain association', concepts: [], queries: [{ source: 'pubmed', query: '"PONV"[Title/Abstract]', purpose: 'primary' }, { source: 'pubmed', query: 'PONV', purpose: 'broad' }] } })
    await literature.approveQuery(plan.id)
    const search = await literature.search({ projectId: project.id, researchQueryId: plan.id, researchQueryRevision: plan.revision ?? 1, query: '"PONV"[Title/Abstract]', purpose: 'primary' })
    expect(search.papers).toHaveLength(2)
    expect(search.papers[0]!.pmid).toBe('42705006')
    await projects.savePaper(project.id, search.papers[0]!.id)
    expect((await projects.overview(project.id)).papers).toMatchObject({ status: 'counted', value: 1 })

    // 2. Paper: parse real JATS into paragraphs.
    const papers = new PapersService({
      storage, fulltext: offlineFulltext, fetchText: async () => '', extractPdf: async () => ({ pages: [] }),
      maxSearchResults: 50, now: () => '2026-01-01T00:00:00.000Z',
      newPaperId: () => c.paperIdSchema.parse(`paper-x-${++paperSequence}`),
      newDocumentId: () => c.documentIdSchema.parse(`doc-${++documentSequence}`),
      newSectionId: () => c.sectionIdSchema.parse(`sec-${++sectionSequence}`),
      newParagraphId: () => c.paragraphIdSchema.parse(`par-${++paragraphSequence}`),
      newEvidenceChunkId: () => c.evidenceChunkIdSchema.parse(`chunk-${++paragraphSequence}`),
    })
    const document = await papers.ingestJats(search.papers[0]!.id, fixture('../../plugin-paper/tests/fixtures/jats/europepmc-fulltext.xml'))
    expect(document.parseStatus).toBe('READY')

    // 3. Evidence: retrieve a chunk, locate a quote, verify it.
    const evidenceService = new EvidenceService({
      storage, alignment: { tolerance: 0.05, windowSize: 8 }, maxRetrieval: 10, maxHops: 3,
      now: () => '2026-01-01T00:00:00.000Z',
      newEvidenceId: () => c.evidenceIdSchema.parse(`evidence-${++evidenceSequence}`),
    })
    const chunks = await evidenceService.retrieve({
      projectId: project.id, claimText: 'PONV and postoperative pain', conceptTerms: ['pain'], maxResults: 5,
    })
    expect(chunks.length).toBeGreaterThan(0)
    const paragraphId = chunks[0]!.paragraphIds[0]!
    const paragraph = storage.paragraphs.get(paragraphId)!
    const quote = paragraph.text.slice(0, 120)
    const evidence = await evidenceService.save({
      projectId: project.id,
      candidate: { paragraphId, quote, relation: 'SUPPORT', reason: 'reported association' },
      provenance: { extractorVersion: 'v1', extractorModel: 'e2e', promptVersion: 'p1' },
    })
    expect(evidence.locatorStatus).toBe('FOUND')
    const verified = await evidenceService.verify(evidence.id, 'VERIFIED')
    expect(verified.supportStatus).toBe('VERIFIED')

    // 4. Claim Gate over the verified evidence.
    const claim: c.Claim = {
      id: c.claimIdSchema.parse('claim-1'), projectId: project.id, researchQueryId: c.researchQueryIdSchema.parse('query-1'),
      text: 'PONV is associated with postoperative pain.', evidenceIds: [verified.id], counterEvidenceIds: [],
      evidenceStatus: 'CONSISTENT', supportStatus: 'PENDING', rejectionReasons: [], createdAt: '2026-01-01T00:00:00.000Z',
    }
    const gate = verifyClaim({
      claim,
      evidence: new Map([[verified.id, verified]]),
      papers: new Map([[verified.paperId, storage.papers.get(verified.paperId)!]]),
      relocate: item => alignQuote(paragraph.text, item.originalText, { tolerance: 0.05, windowSize: 8 }).status !== 'NOT_FOUND',
    })
    expect(gate.passed).toBe(true)
    expect(gate.reasons).toEqual([])

    // 5. Backend citation serialization: [1] → evidence_id → paper_id.
    const answer = serializeCitations(
      [{ text: claim.text, evidenceIds: [verified.id] }],
      new Map([[verified.id, verified]]),
    )
    expect(answer.claims[0]!.citations).toEqual([1])
    expect(answer.citations[0]).toEqual({ index: 1, evidenceId: verified.id, paperId: search.papers[0]!.id })

    // Every step stayed inside the project.
    expect((await projects.overview(project.id)).evidences).toMatchObject({ status: 'counted', value: 1 })
    expect((await projects.overview(project.id)).papers).toMatchObject({ status: 'counted', value: 1 })

    // 6. SPEC §49: the two audited operations left one row each, in order.
    const audits = [...storage.auditLogs.entries()].map(([, row]) => row)
    expect(audits.map(row => row.action)).toEqual(['project.create', 'evidence.verify'])
    expect(audits.every(row => row.projectId === project.id && row.at === '2026-01-01T00:00:00.000Z')).toBe(true)
  })
})
