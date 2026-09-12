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
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { PubmedConnector, type PubmedConnectorOptions } from '../src/pubmed/connector.ts'
import { LiteratureService } from '../src/service.ts'
import { efetch, esearchPage, fixture, ReplayTransport } from './helpers/replay-transport.ts'

const PROJECT = projectIdSchema.parse('project-1')

interface Booted {
  storage: MedStorage
  close(): Promise<void>
}

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

function connectorOptions(overrides: Partial<PubmedConnectorOptions> = {}): PubmedConnectorOptions {
  const base: PubmedConnectorOptions = {
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    tool: 'med-research-workspace',
    email: 'medresearch@example.com',
    requestsPerSecond: 1e9,
    maxRetries: 0,
    backoffBaseMs: 1,
    timeoutMs: 5_000,
    retmax: 20,
    efetchBatchSize: 200,
    cacheTtlMs: 0,
    sleep: async () => {},
  }
  return { ...base, ...overrides } as PubmedConnectorOptions
}

function service(storage: MedStorage, transport: ReplayTransport): LiteratureService {
  let paperSequence = 0
  let querySequence = 0
  return new LiteratureService({
    connector: new PubmedConnector((url, signal) => transport.get(url, signal), connectorOptions()),
    storage,
    defaultMaxResults: 2,
    now: () => '2026-01-01T00:00:00.000Z',
    newPaperId: () => paperIdSchema.parse(`paper-${++paperSequence}`),
    newResearchQueryId: () => researchQueryIdSchema.parse(`query-${++querySequence}`),
  })
}

const PLAN: QueryPlan = {
  normalizedQuestion: 'PONV and postoperative pain association',
  pico: { population: 'surgical patients', outcome: 'postoperative pain' },
  concepts: [{ name: 'PONV', synonyms: ['postoperative nausea and vomiting'], meshCandidates: [] }],
  queries: [
    { source: 'pubmed', query: '"PONV"[Title/Abstract]', purpose: 'primary' },
    { source: 'pubmed', query: '"postoperative nausea"[Title/Abstract]', purpose: 'broad' },
  ],
}

const booted: Booted[] = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

describe('LiteratureService', () => {
  it('persists a plan without issuing any PubMed request (FR-2)', async () => {
    const transport = new ReplayTransport([{ test: () => true, body: '' }])
    const boot = await bootStorage()
    booted.push(boot)

    const stored = await service(boot.storage, transport).planQuery({
      projectId: PROJECT,
      question: 'PONV 与术后疼痛是否相关？',
      plan: PLAN,
      filters: { publicationTypes: ['Journal Article'] },
    })

    expect(transport.count).toBe(0)
    expect(stored.queries).toHaveLength(2)
    expect(boot.storage.researchQueries.get(stored.id)).toEqual(stored)
  })

  it('persists approval and requires it when a search references the plan', async () => {
    const transport = new ReplayTransport([{ test: () => true, body: '' }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = service(boot.storage, transport)
    const plan = await client.planQuery({ projectId: PROJECT, question: 'q', plan: PLAN })
    await expect(client.search({ projectId: PROJECT, researchQueryId: plan.id, query: PLAN.queries[0]!.query, purpose: 'primary' })).rejects.toThrow(/approved/)
    const approved = await client.approveQuery(plan.id)
    expect(approved.approvedAt).toBeDefined()
  })

  it('rejects a plan that lacks a primary or broad query (SPEC §18)', async () => {
    const transport = new ReplayTransport([{ test: () => true, body: '' }])
    const boot = await bootStorage()
    booted.push(boot)
    const client = service(boot.storage, transport)

    await expect(client.planQuery({
      projectId: PROJECT,
      question: 'q',
      plan: { ...PLAN, queries: [PLAN.queries[0]!] },
    })).rejects.toThrow(/broad/)
    expect(boot.storage.researchQueries.size).toBe(0)
  })

  it('persists searched papers with connector-assigned identifiers', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, fixture('esearch-ponv.json')),
      efetch(fixture('efetch-batch.xml')),
    ])
    const boot = await bootStorage()
    booted.push(boot)

    const result = await service(boot.storage, transport).search({
      projectId: PROJECT,
      query: '"PONV"[Title/Abstract]',
      purpose: 'primary',
    })

    expect(result.papers).toHaveLength(2)
    expect(result.totalCount).toBe(9713)
    expect(boot.storage.papers.size).toBe(2)
    expect(boot.storage.paperSources.size).toBe(2)
    expect(result.papers[0]!.pmid).toBe('42705006')
    expect(boot.storage.papers.get(result.papers[0]!.id)).toEqual(result.papers[0])
  })

  it('reuses the stored paper when a later search returns the same PMID', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, fixture('esearch-ponv.json')),
      efetch(fixture('efetch-batch.xml')),
    ])
    const boot = await bootStorage()
    booted.push(boot)
    const client = service(boot.storage, transport)

    const first = await client.search({ projectId: PROJECT, query: '"PONV"[Title/Abstract]', purpose: 'primary' })
    const second = await client.search({ projectId: PROJECT, query: '"PONV"[Title/Abstract]', purpose: 'primary' })

    expect(second.papers.map(paper => paper.id)).toEqual(first.papers.map(paper => paper.id))
    expect(boot.storage.papers.size).toBe(2)
  })

  it('does not persist anything when the connector fails', async () => {
    const transport = new ReplayTransport([{ test: url => url.pathname.endsWith('/esearch.fcgi'), status: 429 }])
    const boot = await bootStorage()
    booted.push(boot)

    await expect(service(boot.storage, transport).search({
      projectId: PROJECT,
      query: '"PONV"[Title/Abstract]',
      purpose: 'primary',
    })).rejects.toMatchObject({ code: 'PUBMED_RATE_LIMIT' })
    expect(boot.storage.papers.size).toBe(0)
  })

  it('reads a paper by PMID and persists it', async () => {
    const transport = new ReplayTransport([efetch(fixture('efetch-batch.xml'))])
    const boot = await bootStorage()
    booted.push(boot)

    const paper = await service(boot.storage, transport).getPaper('42705006')
    expect(paper?.pmid).toBe('42705006')
    expect(boot.storage.papers.size).toBe(1)
  })
})
