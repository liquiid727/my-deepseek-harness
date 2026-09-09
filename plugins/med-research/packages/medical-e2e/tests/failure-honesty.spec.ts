import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { ArtifactService } from '@medresearch/dsh-plugin-artifact'
import { EvidenceService } from '@medresearch/dsh-plugin-evidence'
import { LiteratureService, PubmedConnector } from '@medresearch/dsh-plugin-literature'
import { PapersService } from '@medresearch/dsh-plugin-paper'
import { StatisticsService } from '@medresearch/dsh-plugin-statistics'

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => { for (const item of booted.splice(0)) await item.close() })

const PROJECT = c.projectIdSchema.parse('project-1')
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

function literature(storage: MedStorage, status: number): LiteratureService {
  let papers = 0
  let queries = 0
  const connector = new PubmedConnector(async () => ({ status, body: '' }), {
    baseUrl: 'https://example.invalid', tool: 't', email: 'e@example.com',
    requestsPerSecond: 1e9, maxRetries: 0, backoffBaseMs: 1, timeoutMs: 5_000,
    retmax: 20, efetchBatchSize: 200, cacheTtlMs: 0, sleep: async () => {},
  })
  return new LiteratureService({
    connector, storage, defaultMaxResults: 2, now: () => '2026-01-01T00:00:00.000Z',
    newPaperId: () => c.paperIdSchema.parse(`paper-${++papers}`),
    newResearchQueryId: () => c.researchQueryIdSchema.parse(`query-${++queries}`),
  })
}

describe('Gate 4 — failure honesty across the chains', () => {
  it('a rate-limited PubMed search fails loud and stores no papers', async () => {
    const storage = await boot()
    await expect(literature(storage, 429).search({ projectId: PROJECT, query: '"PONV"', purpose: 'primary' }))
      .rejects.toMatchObject({ code: 'PUBMED_RATE_LIMIT', retryable: true })
    expect(storage.papers.size).toBe(0)
  })

  it('an unparseable document is FAILED and yields no paragraphs or evidence', async () => {
    const storage = await boot()
    let sequence = 0
    const papers = new PapersService({
      storage, fulltext: offlineFulltext, fetchText: async () => '', extractPdf: async () => ({ pages: [] }),
      maxSearchResults: 50, now: () => '2026-01-01T00:00:00.000Z',
      newPaperId: () => c.paperIdSchema.parse('paper-1'),
      newDocumentId: () => c.documentIdSchema.parse(`doc-${++sequence}`),
      newSectionId: () => c.sectionIdSchema.parse(`sec-${++sequence}`),
      newParagraphId: () => c.paragraphIdSchema.parse(`par-${++sequence}`),
      newEvidenceChunkId: () => c.evidenceChunkIdSchema.parse(`chunk-${++sequence}`),
    })
    await storage.papers.put(c.paperIdSchema.parse('paper-1'), {
      id: c.paperIdSchema.parse('paper-1'), title: 'Broken', authors: [], publicationTypes: [], meshTerms: [],
      keywords: [], source: 'pubmed', fulltextStatus: 'available',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const document = await papers.ingestJats(c.paperIdSchema.parse('paper-1'), '<not-jats')
    expect(document.parseStatus).toBe('FAILED')
    expect(storage.paragraphs.size).toBe(0)

    const evidence = new EvidenceService({
      storage, alignment: { tolerance: 0.05, windowSize: 8 }, maxRetrieval: 10,
      now: () => '2026-01-01T00:00:00.000Z',
      newEvidenceId: () => c.evidenceIdSchema.parse('evidence-1'),
    })
    await expect(evidence.save({
      projectId: PROJECT,
      candidate: { paragraphId: c.paragraphIdSchema.parse('par-1'), quote: 'anything', relation: 'SUPPORT', reason: '' },
      provenance: { extractorVersion: 'v1', extractorModel: 'm', promptVersion: 'p' },
    })).rejects.toMatchObject({ code: 'PARAGRAPH_NOT_FOUND' })
    expect(storage.evidences.size).toBe(0)
  })

  it('a failed run stores no result and no artifact', async () => {
    const storage = await boot()
    const datasetId = c.datasetIdSchema.parse('dataset-1')
    await storage.datasets.put(datasetId, {
      id: datasetId, projectId: PROJECT, filename: 'x.csv', contentHash: 'sha256:x',
      rowCount: 1, columnCount: 1, schema: [], createdAt: '2026-01-01T00:00:00.000Z',
    })
    let sequence = 0
    let artifacts = 0
    const artifactService = new ArtifactService({
      storage, artifactRoot: '/tmp/med-e2e-artifacts',
      copy: async () => {}, readBytes: async () => new Uint8Array(),
      now: () => '2026-01-01T00:00:00.000Z',
      newArtifactId: () => c.artifactIdSchema.parse(`artifact-${++artifacts}`),
    })
    const statistics = new StatisticsService({
      storage,
      runner: {
        execute: async () => ({
          status: 'failed', stdout: '', stderr: 'ZeroDivisionError', outputs: [],
          runtime: { language: 'python', version: '3.9.6', packages: {} },
        }),
      },
      limits: { timeoutMs: 1_000, cpuSeconds: 1, memoryMb: 128, maxOutputBytes: 1_000 },
      allowlist: [], now: () => '2026-01-01T00:00:00.000Z',
      newRunId: () => c.analysisRunIdSchema.parse(`run-${++sequence}`),
      artifacts: artifactService, artifactRoot: '/tmp/med-e2e-artifacts',
    })
    const planned = await statistics.plan({
      projectId: PROJECT, datasetId, question: 'q',
      plan: { objective: 'o', exposures: [], covariates: [], steps: [], assumptions: [], warnings: [] },
    })
    await statistics.generateCode(planned.id, '1/0')
    const result = await statistics.execute({ analysisRunId: planned.id, datasetPath: '/tmp/x.csv' })

    expect(result.status).toBe('failed')
    const run = statistics.getRun(planned.id)!
    expect(run.status).toBe('failed')
    expect(run.resultJson).toBeUndefined()
    expect(run.stderr).toContain('ZeroDivisionError')
    expect(run.artifactIds).toEqual([])
    expect(storage.artifacts.size).toBe(0)
  })
})
