import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Storage, { StorageError } from '@deepseek-ai/dsh-storage'
import { defineDomain, domainTable, DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import {
  MED_DOMAIN_VERSION,
  MedStorageError,
  medExport,
  medImport,
  openMedStorage,
  type MedExportBundle,
  type MedStorage,
} from '../src/index.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const QUERY = c.researchQueryIdSchema.parse('query-1')
const PAPER = c.paperIdSchema.parse('paper-1')
const DOCUMENT = c.documentIdSchema.parse('document-1')

interface BootedContext {
  facility: DomainFacility
  shutdown(): Promise<void>
}

interface Booted extends BootedContext {
  storage: MedStorage
}

const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function freshDbPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'med-storage-'))
  dirs.push(dir)
  return join(dir, 'storage.db')
}

/** Boot the real storage hub, the real SQLite backend, and the domain form. */
async function bootContext(path: string): Promise<BootedContext> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  return {
    facility,
    async shutdown() {
      await facility.closeAll()
      await backend.close()
    },
  }
}

/** Boot the context and open every Med Research domain over it. */
async function boot(path: string): Promise<Booted> {
  const booted = await bootContext(path)
  const storage = await openMedStorage(booted.facility)
  return {
    ...booted,
    storage,
    async shutdown() {
      await storage.close()
      await booted.shutdown()
    },
  }
}

/** A domain declaration of the same name at a future version, to stamp a newer medium. */
const futureProjectDomain = defineDomain({
  name: 'med_project',
  version: MED_DOMAIN_VERSION + 1,
  tables: {
    med_projects: domainTable<c.ProjectId, c.Project>(c.projectSchema),
    med_session_project: domainTable<string, c.SessionProject>(c.sessionProjectSchema),
  },
})

function project(): c.Project {
  return {
    id: PROJECT,
    name: 'PONV 与术后疼痛',
    researchQuestion: 'PONV 与术后疼痛是否相关？',
    keywords: ['PONV', 'pain'],
    workspacePath: '/tmp/workspace',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function researchQuery(): c.ResearchQuery {
  return {
    id: QUERY,
    projectId: PROJECT,
    question: 'PONV 与术后疼痛是否相关？',
    normalizedQuestion: 'PONV and postoperative pain association',
    pico: { population: 'surgical patients', outcome: 'postoperative pain' },
    concepts: [{ name: 'PONV', synonyms: ['postoperative nausea and vomiting'], meshCandidates: [] }],
    queries: [{ source: 'pubmed', query: '"PONV"[Title/Abstract]', purpose: 'primary' }],
    filters: { publicationTypes: ['Journal Article'] },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function paper(): c.Paper {
  return {
    id: PAPER,
    pmid: '12345678',
    doi: '10.1000/abc',
    title: 'A real paper',
    authors: [{ name: 'A. Author' }],
    publicationTypes: ['Journal Article'],
    meshTerms: ['Pain'],
    keywords: ['pain'],
    source: 'pubmed',
    fulltextStatus: 'abstract_only',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function evidence(): c.Evidence {
  return {
    id: c.evidenceIdSchema.parse('evidence-1'),
    projectId: PROJECT,
    paperId: PAPER,
    documentId: DOCUMENT,
    sourceType: 'abstract',
    originalText: 'PONV was associated with higher pain scores.',
    normalizedText: 'PONV was associated with higher pain scores.',
    offsetBase: 'normalized_paragraph',
    relation: 'SUPPORT',
    locatorStatus: 'FOUND',
    startOffset: 0,
    endOffset: 47,
    supportStatus: 'VERIFIED',
    extractorVersion: 'v1',
    extractorModel: 'model-x',
    promptVersion: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function dataset(): c.Dataset {
  return {
    id: c.datasetIdSchema.parse('dataset-1'),
    projectId: PROJECT,
    filename: 'ponv.csv',
    contentHash: 'sha256:deadbeef',
    rowCount: 120,
    columnCount: 2,
    schema: [
      { name: 'ponv', inferredType: 'binary', nullable: false, missingCount: 0, uniqueCount: 2 },
      { name: 'pain', inferredType: 'continuous', nullable: true, missingCount: 3, uniqueCount: 118 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function analysisRun(): c.AnalysisRun {
  return {
    id: c.analysisRunIdSchema.parse('run-1'),
    projectId: PROJECT,
    datasetId: c.datasetIdSchema.parse('dataset-1'),
    datasetHash: 'sha256:deadbeef',
    question: 'PONV 是否与疼痛评分相关？',
    analysisPlan: {
      objective: 'Assess association',
      outcome: 'pain',
      exposures: ['ponv'],
      covariates: [],
      steps: [{ id: 's1', method: 'logistic regression', reason: 'binary outcome', variables: ['ponv', 'pain'] }],
      assumptions: [],
      warnings: [],
    },
    language: 'python',
    generatedCode: 'print("ok")',
    codeHash: 'sha256:cafe',
    runtime: 'python',
    runtimeVersion: '3.12.0',
    packageVersions: { statsmodels: '0.14.0' },
    status: 'succeeded',
    stdout: 'ok',
    resultJson: { or: 2.1, ci: [1.2, 3.4], p: 0.01 },
    artifactIds: [c.artifactIdSchema.parse('artifact-1')],
    createdAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:01:00.000Z',
  }
}

function artifact(): c.Artifact {
  return {
    id: c.artifactIdSchema.parse('artifact-1'),
    projectId: PROJECT,
    analysisRunId: c.analysisRunIdSchema.parse('run-1'),
    type: 'figure',
    mimeType: 'image/png',
    storageKey: 'projects/project-1/artifacts/artifact-1.png',
    datasetHash: 'sha256:deadbeef',
    codeHash: 'sha256:cafe',
    metadata: { width: 800, height: 600 },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function auditLog(): c.AuditLog {
  return {
    id: c.auditLogIdSchema.parse('audit-1'),
    projectId: PROJECT,
    action: 'code.execute',
    at: '2026-01-01T00:00:00.000Z',
    detail: { analysisRunId: 'run-1' },
  }
}

/** Write one record of every entity the schema declares. */
async function seed(storage: MedStorage): Promise<void> {
  await storage.projects.put(PROJECT, project())
  await storage.sessionProjects.put('session-1', { sessionId: 'session-1', projectId: PROJECT, updatedAt: '2026-01-01T00:00:00.000Z' })
  await storage.researchQueries.put(QUERY, researchQuery())
  await storage.papers.put(PAPER, paper())
  await storage.paperSources.put(`${PAPER}|pubmed|12345678`, { paperId: PAPER, source: 'pubmed', sourceId: '12345678', rawMetadata: { pmid: '12345678' } })
  await storage.projectPapers.put(`${PROJECT}|${PAPER}`, { projectId: PROJECT, paperId: PAPER, savedAt: '2026-01-01T00:00:00.000Z' })
  await storage.documents.put(DOCUMENT, {
    id: DOCUMENT,
    paperId: PAPER,
    sourceType: 'abstract',
    contentHash: 'sha256:beef',
    parseStatus: 'ABSTRACT_ONLY',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.sections.put(c.sectionIdSchema.parse('section-1'), {
    id: c.sectionIdSchema.parse('section-1'),
    documentId: DOCUMENT,
    title: 'Abstract',
    type: 'abstract',
    order: 0,
  })
  await storage.paragraphs.put(c.paragraphIdSchema.parse('paragraph-1'), {
    id: c.paragraphIdSchema.parse('paragraph-1'),
    sectionId: c.sectionIdSchema.parse('section-1'),
    order: 0,
    text: 'PONV was associated with higher pain scores.',
    rawText: 'PONV was associated with higher pain scores.',
  })
  await storage.chunks.put(c.evidenceChunkIdSchema.parse('chunk-1'), {
    id: c.evidenceChunkIdSchema.parse('chunk-1'),
    paperId: PAPER,
    documentId: DOCUMENT,
    sectionType: 'abstract',
    sectionTitle: 'Abstract',
    paragraphIds: [c.paragraphIdSchema.parse('paragraph-1')],
    text: 'PONV was associated with higher pain scores.',
  })
  await storage.evidences.put(evidence().id, evidence())
  await storage.claims.put(c.claimIdSchema.parse('claim-1'), {
    id: c.claimIdSchema.parse('claim-1'),
    projectId: PROJECT,
    researchQueryId: c.researchQueryIdSchema.parse('query-1'),
    text: 'PONV is associated with postoperative pain.',
    evidenceIds: [evidence().id],
    counterEvidenceIds: [],
    evidenceStatus: 'SUFFICIENT',
    supportStatus: 'VERIFIED',
    rejectionReasons: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.claimEvidences.put(`claim-1|${evidence().id}`, {
    claimId: c.claimIdSchema.parse('claim-1'),
    evidenceId: evidence().id,
    role: 'support',
  })
  await storage.datasets.put(dataset().id, dataset())
  await storage.datasetColumns.put('dataset-1|ponv', dataset().schema[0]!)
  await storage.datasetColumns.put('dataset-1|pain', dataset().schema[1]!)
  await storage.analysisRuns.put(analysisRun().id, analysisRun())
  await storage.artifacts.put(artifact().id, artifact())
  await storage.auditLogs.put(auditLog().id, auditLog())
}

describe('medical-storage contract (SPEC §15–§16)', () => {
  it('writes and reads back every declared entity over the real SQLite backend', async () => {
    const booted = await boot(await freshDbPath())
    try {
      await seed(booted.storage)
      expect(booted.storage.projects.get(PROJECT)).toEqual(project())
      expect(booted.storage.researchQueries.get(QUERY)).toEqual(researchQuery())
      expect(booted.storage.papers.get(PAPER)).toEqual(paper())
      expect(booted.storage.evidences.get(evidence().id)).toEqual(evidence())
      expect(booted.storage.datasets.get(dataset().id)).toEqual(dataset())
      expect(booted.storage.analysisRuns.get(analysisRun().id)).toEqual(analysisRun())
      expect(booted.storage.artifacts.get(artifact().id)).toEqual(artifact())
      expect(booted.storage.auditLogs.get(auditLog().id)).toEqual(auditLog())
      expect(booted.storage.datasetColumns.size).toBe(2)
      expect(booted.storage.claimEvidences.size).toBe(1)
    } finally {
      await booted.shutdown()
    }
  })

  it('survives a restart and reopens the same records', async () => {
    const path = await freshDbPath()
    const first = await boot(path)
    await seed(first.storage)
    await first.shutdown()

    const second = await boot(path)
    try {
      expect(second.storage.projects.get(PROJECT)).toEqual(project())
      expect(second.storage.analysisRuns.get(analysisRun().id)).toEqual(analysisRun())
    } finally {
      await second.shutdown()
    }
  })

  it('round-trips medExport → medImport into an empty medium (FR-21)', async () => {
    const source = await boot(await freshDbPath())
    let bundle: MedExportBundle
    try {
      await seed(source.storage)
      bundle = medExport(source.storage)
      expect(bundle.format).toBe('medresearch.export')
      expect(bundle.domains).toHaveLength(8)
    } finally {
      await source.shutdown()
    }

    const target = await boot(await freshDbPath())
    try {
      const report = await medImport(target.storage, bundle)
      expect(report.domains).toBe(8)
      expect(report.records).toBeGreaterThan(0)
      expect(medExport(target.storage).domains).toEqual(bundle.domains)
    } finally {
      await target.shutdown()
    }
  })

  it('fails loud when a stored domain version differs from the declaration (FR-21)', async () => {
    const path = await freshDbPath()
    const stamping = await bootContext(path)
    try {
      const future = await stamping.facility.open(futureProjectDomain)
      await future.close()
    } finally {
      await stamping.shutdown()
    }

    const reopened = await bootContext(path)
    try {
      await expect(openMedStorage(reopened.facility)).rejects.toMatchObject({
        name: 'StorageError',
        code: 'version-mismatch',
      })
    } finally {
      await reopened.shutdown()
    }
  })

  it('rejects a bundle whose domain version does not match, without writing', async () => {
    const source = await boot(await freshDbPath())
    let bundle: MedExportBundle
    try {
      await seed(source.storage)
      bundle = medExport(source.storage)
    } finally {
      await source.shutdown()
    }
    bundle.domains[0]!.version = MED_DOMAIN_VERSION + 1

    const target = await boot(await freshDbPath())
    try {
      await expect(medImport(target.storage, bundle)).rejects.toMatchObject({
        name: 'MedStorageError',
        code: 'DOMAIN_VERSION_MISMATCH',
      })
      expect(target.storage.projects.size).toBe(0)
      expect(target.storage.papers.size).toBe(0)
    } finally {
      await target.shutdown()
    }
  })

  it('rejects a malformed bundle and an invalid record without writing', async () => {
    const source = await boot(await freshDbPath())
    let bundle: MedExportBundle
    try {
      await seed(source.storage)
      bundle = medExport(source.storage)
    } finally {
      await source.shutdown()
    }

    const target = await boot(await freshDbPath())
    try {
      await expect(medImport(target.storage, { ...bundle, formatVersion: 99 }))
        .rejects.toMatchObject({ name: 'MedStorageError', code: 'BUNDLE_INVALID' })
      await expect(medImport(target.storage, { ...bundle, domains: [{ name: 'nope', version: 1, tables: {} }] }))
        .rejects.toMatchObject({ name: 'MedStorageError', code: 'DOMAIN_NOT_FOUND' })
      await expect(medImport(target.storage, {
        ...bundle,
        domains: [{ name: 'med_project', version: MED_DOMAIN_VERSION, tables: { med_projects: { x: { id: 'x' } } } }],
      })).rejects.toMatchObject({ name: 'MedStorageError', code: 'RECORD_INVALID' })
      await expect(medImport(target.storage, {
        ...bundle,
        domains: [{ name: 'med_project', version: MED_DOMAIN_VERSION, tables: { no_such_table: {} } }],
      })).rejects.toMatchObject({ name: 'MedStorageError', code: 'TABLE_NOT_FOUND' })
      expect(target.storage.projects.size).toBe(0)
    } finally {
      await target.shutdown()
    }
  })

  it('propagates the backend version-mismatch unchanged', () => {
    expect(new StorageError('version-mismatch', 'x').code).toBe('version-mismatch')
    expect(new MedStorageError('DOMAIN_VERSION_MISMATCH', 'x').code).toBe('DOMAIN_VERSION_MISMATCH')
  })
})

describe('shared med storage handle (SPEC §5, §15)', () => {
  it('serves concurrent callers from one open and releases only at the last close', async () => {
    const booted = await bootContext(await freshDbPath())
    try {
      // The med plugins apply concurrently; each awaits the same open.
      const [first, second] = await Promise.all([
        openMedStorage(booted.facility),
        openMedStorage(booted.facility),
      ])
      expect(first.projects).toBe(second.projects)
      await first.projects.put(PROJECT, project())

      await first.close()
      // The second handle still reads the shared tables.
      expect(second.projects.get(PROJECT)).toMatchObject({ id: PROJECT })

      await second.close()
      // Reference zero released every domain, so the facility opens again and
      // the drained record is still on the medium.
      const reopened = await openMedStorage(booted.facility)
      expect(reopened.projects.get(PROJECT)).toMatchObject({ id: PROJECT })
      await reopened.close()
    } finally {
      await booted.shutdown()
    }
  })

  it('keeps close idempotent per handle', async () => {
    const booted = await bootContext(await freshDbPath())
    try {
      const first = await openMedStorage(booted.facility)
      const second = await openMedStorage(booted.facility)
      await first.close()
      await first.close()
      // A double close on one handle must not release the other's domains.
      expect(second.projects.size).toBe(0)
      await second.close()
    } finally {
      await booted.shutdown()
    }
  })
})
