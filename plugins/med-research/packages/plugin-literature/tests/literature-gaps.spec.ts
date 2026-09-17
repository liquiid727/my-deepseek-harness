import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import {
  paperIdSchema,
  projectIdSchema,
  researchQueryIdSchema,
  type QueryPlan,
  type ResearchQueryFilters,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import {
  PubmedConnector,
  type PubmedConnectorOptions,
  type PubmedRecord,
  type PubmedSearchResult,
} from '../src/pubmed/connector.ts'
import {
  LiteratureService,
  type RerankCapability,
  type RerankOutcome,
} from '../src/service.ts'
import { efetch, esearchPage, fixture, ReplayTransport } from './helpers/replay-transport.ts'

const PROJECT = projectIdSchema.parse('project-1')

interface Booted { storage: MedStorage; close(): Promise<void> }

async function bootStorage(): Promise<Booted> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  return {
    storage,
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  }
}

const booted: Booted[] = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

function connectorOptions(overrides: Partial<PubmedConnectorOptions> = {}): PubmedConnectorOptions {
  return {
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    tool: 'med-research-workspace',
    email: 'medresearch@example.com',
    requestsPerSecond: 1e9,
    maxRetries: 0,
    backoffBaseMs: 1,
    timeoutMs: 1_000,
    retmax: 20,
    efetchBatchSize: 200,
    cacheTtlMs: 0,
    sleep: async () => {},
    ...overrides,
  }
}

/** Real connector over a replay transport for the network-failure scenarios. */
function realService(storage: MedStorage, transport: ReplayTransport, defaultMaxResults = 100): LiteratureService {
  let paperSequence = 0
  let querySequence = 0
  return new LiteratureService({
    connector: new PubmedConnector((url, signal) => transport.get(url, signal), connectorOptions()),
    storage,
    defaultMaxResults,
    now: () => '2026-01-01T00:00:00.000Z',
    newPaperId: () => paperIdSchema.parse(`paper-${++paperSequence}`),
    newResearchQueryId: () => researchQueryIdSchema.parse(`query-${++querySequence}`),
  })
}

/** A synthetic PubMed record with only the fields the filter/rank paths read. */
function rec(pmid: string, over: Partial<PubmedRecord> = {}): PubmedRecord {
  return {
    pmid,
    title: `Title ${pmid}`,
    authors: [],
    publicationTypes: [],
    meshTerms: [],
    keywords: [],
    source: 'pubmed',
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    fulltextStatus: 'abstract_only',
    ...over,
  }
}

/** A connector that returns predetermined results and counts its search calls. */
function fakeConnector(results: PubmedSearchResult[]): { connector: PubmedConnector; calls: () => number } {
  let index = 0
  let count = 0
  const connector = {
    async search(): Promise<PubmedSearchResult> {
      count += 1
      return results[index++] ?? results[results.length - 1]!
    },
    async fetchByPmid(): Promise<PubmedRecord | undefined> {
      return undefined
    },
    metrics: () => ({ requests: count, cacheHits: 0, retries: 0, papersFetched: 0 }),
  }
  return { connector: connector as unknown as PubmedConnector, calls: () => count }
}

interface FakeOptions {
  connector: PubmedConnector
  rerank?: RerankCapability
  defaultMaxResults?: number
}

function fakeService(storage: MedStorage, opts: FakeOptions): LiteratureService {
  let paperSequence = 0
  let querySequence = 0
  return new LiteratureService({
    connector: opts.connector,
    storage,
    defaultMaxResults: opts.defaultMaxResults ?? 100,
    now: () => '2026-01-01T00:00:00.000Z',
    newPaperId: () => paperIdSchema.parse(`paper-${++paperSequence}`),
    newResearchQueryId: () => researchQueryIdSchema.parse(`query-${++querySequence}`),
    ...opts.rerank === undefined ? {} : { rerank: opts.rerank },
  })
}

const PLAN: QueryPlan = {
  normalizedQuestion: 'PONV and postoperative pain',
  pico: { population: 'surgical patients', outcome: 'postoperative pain' },
  concepts: [{ name: 'PONV', synonyms: [], meshCandidates: [] }],
  queries: [
    { source: 'pubmed', query: '"PONV"[Title/Abstract]', purpose: 'primary' },
    { source: 'pubmed', query: '"postoperative nausea"[Title/Abstract]', purpose: 'broad' },
  ],
}

/** Plan + approve a query, optionally with filters, and return the approved record. */
async function approvedPlan(
  service: LiteratureService,
  filters: ResearchQueryFilters = {},
): Promise<{ researchQueryId: ReturnType<typeof researchQueryIdSchema.parse>; revision: number }> {
  const plan = await service.planQuery({ projectId: PROJECT, question: 'q', plan: PLAN, filters })
  const approved = await service.approveQuery(plan.id)
  return { researchQueryId: approved.id, revision: approved.revision ?? 1 }
}

describe('LiteratureService — approval gate', () => {
  it('issues zero network requests and refuses before the plan is approved', async () => {
    const transport = new ReplayTransport([{ test: () => false, body: '' }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport)
    const plan = await client.planQuery({ projectId: PROJECT, question: 'q', plan: PLAN })

    await expect(client.search({ projectId: PROJECT, researchQueryId: plan.id, query: PLAN.queries[0]!.query, purpose: 'primary' }))
      .rejects.toThrow(/approved/)
    expect(transport.count).toBe(0)
  })

  it('invalidates approval the moment the plan is edited', async () => {
    const transport = new ReplayTransport([{ test: () => false, body: '' }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport)
    const plan = await client.planQuery({ projectId: PROJECT, question: 'q', plan: PLAN })
    const approved = await client.approveQuery(plan.id)
    await client.editQuery(approved.id, { ...PLAN, queries: PLAN.queries })

    await expect(client.search({
      projectId: PROJECT,
      researchQueryId: approved.id,
      researchQueryRevision: approved.revision ?? 1,
      query: PLAN.queries[0]!.query,
      purpose: 'primary',
    })).rejects.toThrow(/approved/)
  })
})

describe('LiteratureService — network scenarios (replay, no live call)', () => {
  it('returns a successful search with run/paging metadata', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, fixture('esearch-ponv.json')),
      efetch(fixture('efetch-batch.xml')),
    ])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport, 2)
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT,
      researchQueryId,
      researchQueryRevision: revision,
      query: '"PONV"[Title/Abstract]',
      purpose: 'primary',
    })

    expect(result.papers).toHaveLength(2)
    expect(result.totalCount).toBe(9713)
    expect(result.localCandidateCount).toBe(2)
    expect(result.runId).toMatch(/^run-/)
    expect(result.nextCursor).toBeUndefined()
    expect(result.degraded).toBe(false)
    expect(result.provenance).toBe('primary')
    expect(result.appliedFilters).toEqual({})
    expect(boot.storage.papers.size).toBe(2)
  })

  it('returns an empty result on an empty PubMed page without calling EFetch', async () => {
    const transport = new ReplayTransport([esearchPage(0, fixture('esearch-empty.json'))])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport)
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT,
      researchQueryId,
      researchQueryRevision: revision,
      query: 'zzzqxnonexistenttermzzz',
      purpose: 'primary',
    })
    expect(result.totalCount).toBe(0)
    expect(result.papers).toEqual([])
    expect(result.localCandidateCount).toBe(0)
    expect(transport.calls.filter(url => url.includes('/efetch.fcgi'))).toHaveLength(0)
  })

  it('maps HTTP 429 to PUBMED_RATE_LIMIT and persists nothing', async () => {
    const transport = new ReplayTransport([{ test: url => url.pathname.endsWith('/esearch.fcgi'), status: 429 }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport)
    const { researchQueryId, revision } = await approvedPlan(client)

    await expect(client.search({
      projectId: PROJECT,
      researchQueryId,
      researchQueryRevision: revision,
      query: 'x',
      purpose: 'primary',
    })).rejects.toMatchObject({ code: 'PUBMED_RATE_LIMIT' })
    expect(boot.storage.papers.size).toBe(0)
  })

  it('maps a hanging request to PUBMED_TIMEOUT', async () => {
    const transport = new ReplayTransport([{ test: url => url.pathname.endsWith('/esearch.fcgi'), delayMs: 5_000 }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport, 100)
    const { researchQueryId, revision } = await approvedPlan(client)

    await expect(client.search({
      projectId: PROJECT,
      researchQueryId,
      researchQueryRevision: revision,
      query: 'x',
      purpose: 'primary',
    })).rejects.toMatchObject({ code: 'PUBMED_TIMEOUT' })
  })

  it('surfaces a malformed query as an empty page with warnings', async () => {
    const transport = new ReplayTransport([esearchPage(0, fixture('esearch-malformed.json'))])
    const boot = await bootStorage()
    booted.push(boot)
    const client = realService(boot.storage, transport)
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT,
      researchQueryId,
      researchQueryRevision: revision,
      query: 'AND[',
      purpose: 'primary',
    })
    expect(result.totalCount).toBe(0)
    expect(result.papers).toEqual([])
    expect(result.warnings).toContain('No items found.')
  })

  it('reports a partial reason when fewer records than requested are retrieved', async () => {
    const { connector, calls } = fakeConnector([{ records: [rec('1'), rec('2')], totalCount: 50, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT,
      researchQueryId,
      researchQueryRevision: revision,
      query: 'x',
      purpose: 'primary',
      maxResults: 50,
    })
    expect(result.papers).toHaveLength(2)
    expect(result.totalCount).toBe(50)
    expect(result.localCandidateCount).toBe(2)
    expect(result.partialReason).toMatch(/returned 2 of 50/)
    expect(calls()).toBe(1)
  })
})

describe('LiteratureService — filter trace and exclusion reasons', () => {
  it('records YEAR_BEFORE for out-of-window candidates', async () => {
    const { connector } = fakeConnector([{
      records: [
        rec('old', { publicationDate: '2010-01-01' }),
        rec('new', { publicationDate: '2022-03-04' }),
      ],
      totalCount: 2,
      warnings: [],
    }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client, { dateFrom: '2020' })

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary',
    })
    const old = result.filterTrace.find(t => t.paperId === 'paper-1')!
    const fresh = result.filterTrace.find(t => t.paperId === 'paper-2')!
    expect(old.included).toBe(false)
    expect(old.reasons).toEqual(['YEAR_BEFORE'])
    expect(fresh.included).toBe(true)
    expect(fresh.reasons).toEqual([])
    expect(result.appliedFilters.year).toEqual({ from: '2020' })
  })

  it('records STUDY_TYPE_MISMATCH and STUDY_TYPE_UNKNOWN', async () => {
    const { connector } = fakeConnector([{
      records: [
        rec('match', { publicationTypes: ['Clinical Trial'] }),
        rec('mismatch', { publicationTypes: ['Review'] }),
        rec('unknown', { publicationTypes: [] }),
      ],
      totalCount: 3,
      warnings: [],
    }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client, { publicationTypes: ['Clinical Trial'] })

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary',
    })
    const trace = Object.fromEntries(result.filterTrace.map(t => [t.paperId, t]))
    expect(trace['paper-1']!.included).toBe(true)
    expect(trace['paper-2']!.reasons).toEqual(['STUDY_TYPE_MISMATCH'])
    expect(trace['paper-3']!.reasons).toEqual(['STUDY_TYPE_UNKNOWN'])
    expect(result.appliedFilters.studyType).toEqual({ values: ['Clinical Trial'], unknownValues: ['paper-3'] })
  })

  it('records FULLTEXT_UNAVAILABLE for AVAILABLE when only abstracts exist, and includes verified full text', async () => {
    const { connector } = fakeConnector([{
      records: [
        rec('abstract', { fulltextStatus: 'abstract_only' }),
        rec('verified', { fulltextStatus: 'available' }),
      ],
      totalCount: 2,
      warnings: [],
    }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', fullText: 'AVAILABLE',
    })
    const trace = Object.fromEntries(result.filterTrace.map(t => [t.paperId, t]))
    expect(trace['paper-1']!.reasons).toEqual(['FULLTEXT_UNAVAILABLE'])
    expect(trace['paper-2']!.included).toBe(true)
    expect(result.appliedFilters.fullText).toBe('AVAILABLE')
    expect(result.papers.map(p => p.pmid)).toEqual(['verified'])
  })

  it('records requested languages but never silently applies them', async () => {
    const { connector } = fakeConnector([{ records: [rec('1')], totalCount: 1, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', languages: ['english'],
    })
    expect(result.appliedFilters.languages).toEqual({
      requested: ['english'],
      applied: false,
      reason: 'connector does not surface per-paper language metadata',
    })
    expect(result.papers).toHaveLength(1)
  })
})

describe('LiteratureService — AI rerank with explicit degradation', () => {
  function rerank(hits: RerankOutcome['hits'], degraded = false, reason?: string): RerankCapability {
    return {
      rerank: async () => (degraded
        ? { hits, degraded: true, reason: reason ?? 'DEGRADED' }
        : { hits, degraded: false }),
    }
  }

  it('ranks by AI score desc and never degrades', async () => {
    const { connector } = fakeConnector([{
      records: [rec('a', { title: 'alpha' }), rec('b', { title: 'beta' })],
      totalCount: 2,
      warnings: [],
    }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, {
      connector,
      rerank: rerank([{ id: paperIdSchema.parse('paper-2'), score: 0.9 }, { id: paperIdSchema.parse('paper-1'), score: 0.3 }]),
    })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', rerankModel: 'model-1',
    })
    expect(result.degraded).toBe(false)
    expect(result.papers.map(p => p.pmid)).toEqual(['b', 'a'])
    expect(result.ranking![0]!.reason).toBe('ai relevance')
    expect(result.ranking![0]!.score).toBe(0.9)
  })

  it('degrades to lexical order on invalid model id and says so', async () => {
    const { connector } = fakeConnector([{
      records: [rec('a'), rec('b')], totalCount: 2, warnings: [],
    }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector, rerank: rerank([], true, 'INVALID_MODEL_ID') })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', rerankModel: 'bad',
    })
    expect(result.degraded).toBe(true)
    expect(result.degradationReason).toBe('INVALID_MODEL_ID')
    expect(result.warnings.some(w => w.includes('rerank degraded'))).toBe(true)
    expect(result.papers).toHaveLength(2)
  })

  it('degrades on duplicate ids', async () => {
    const { connector } = fakeConnector([{ records: [rec('a'), rec('b')], totalCount: 2, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector, rerank: rerank([{ id: paperIdSchema.parse('paper-1'), score: 1 }, { id: paperIdSchema.parse('paper-1'), score: 2 }], true, 'DUPLICATE_ID') })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', rerankModel: 'm',
    })
    expect(result.degraded).toBe(true)
    expect(result.degradationReason).toBe('DUPLICATE_ID')
  })

  it('degrades on missing score', async () => {
    const { connector } = fakeConnector([{ records: [rec('a'), rec('b')], totalCount: 2, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector, rerank: rerank([{ id: paperIdSchema.parse('paper-1'), score: 1 }, { id: paperIdSchema.parse('paper-2'), score: undefined as unknown as number }], true, 'MISSING_SCORE') })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', rerankModel: 'm',
    })
    expect(result.degraded).toBe(true)
    expect(result.degradationReason).toBe('MISSING_SCORE')
  })
})

describe('LiteratureService — cursor pagination over frozen set', () => {
  it('pages the same frozen candidates without widening the network query', async () => {
    const { connector, calls } = fakeConnector([{
      records: [rec('1'), rec('2'), rec('3'), rec('4'), rec('5')],
      totalCount: 5,
      warnings: [],
    }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector, defaultMaxResults: 100 })
    const { researchQueryId, revision } = await approvedPlan(client)

    const page1 = await client.search({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'x', purpose: 'primary', pageSize: 2,
    })
    expect(page1.papers.map(p => p.pmid)).toEqual(['1', '2'])
    expect(page1.localCandidateCount).toBe(5)
    expect(page1.nextCursor).toBeDefined()
    const callsAfterPage1 = calls()

    const page2 = await client.search({ projectId: PROJECT, query: 'x', purpose: 'primary', cursor: page1.nextCursor! })
    expect(calls()).toBe(callsAfterPage1)
    expect(page2.papers.map(p => p.pmid)).toEqual(['3', '4'])
    expect(page2.localCandidateCount).toBe(5)
    expect(page2.filterTrace).toHaveLength(5)
    expect(page2.nextCursor).toBeDefined()

    const page3 = await client.search({ projectId: PROJECT, query: 'x', purpose: 'primary', cursor: page2.nextCursor! })
    expect(page3.papers.map(p => p.pmid)).toEqual(['5'])
    expect(page3.nextCursor).toBeUndefined()
  })

  it('rejects an unparseable cursor instead of widening the query', async () => {
    const { connector } = fakeConnector([{ records: [rec('1')], totalCount: 1, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    await expect(client.search({ projectId: PROJECT, query: 'x', purpose: 'primary', cursor: 'not-base64-json' })).rejects.toThrow(/invalid search cursor/)
  })
})

describe('LiteratureService — counter / related provenance', () => {
  it('marks counter search with independent provenance', async () => {
    const { connector } = fakeConnector([{ records: [rec('1')], totalCount: 1, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.counterSearch({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'counter query', purpose: 'counter',
    })
    expect(result.provenance).toBe('counter')
    expect(result.query.purpose).toBe('counter')
  })

  it('carries relationship / source / query identity for related search', async () => {
    const { connector } = fakeConnector([{ records: [rec('1')], totalCount: 1, warnings: [] }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = fakeService(boot.storage, { connector })
    const { researchQueryId, revision } = await approvedPlan(client)

    const result = await client.relatedSearch({
      projectId: PROJECT, researchQueryId, researchQueryRevision: revision, query: 'related query', purpose: 'related',
    })
    expect(result.provenance).toBe('related')
    expect(result.relationship).toBe('related')
    expect(result.source).toBe('pubmed')
    expect(result.queryIdentity).toBe(researchQueryId)
  })
})
