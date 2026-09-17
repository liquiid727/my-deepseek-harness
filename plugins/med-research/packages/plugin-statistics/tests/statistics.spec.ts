import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import {
  analysisRunIdSchema,
  datasetIdSchema,
  projectIdSchema,
  type AnalysisPlan,
  type StatisticsRunResult,
  type StatisticsRunner,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { artifactIdSchema } from '@medresearch/dsh-medical-contracts'
import { approvalDecision } from '../src/approval.ts'
import { StatisticsError, StatisticsService, type ArtifactRegistrar } from '../src/service.ts'

const PROJECT = projectIdSchema.parse('project-1')
const DATASET = datasetIdSchema.parse('dataset-1')
const PLAN: AnalysisPlan = {
  objective: 'Assess the association between PONV and pain score',
  outcome: 'pain',
  exposures: ['ponv'],
  covariates: ['age'],
  steps: [{ id: 's1', method: 'logistic regression', reason: 'binary exposure', variables: ['ponv', 'pain'] }],
  assumptions: ['independent observations'],
  warnings: [],
}

const success: StatisticsRunner = {
  execute: async (): Promise<StatisticsRunResult> => ({
    status: 'succeeded',
    stdout: 'ok',
    stderr: '',
    resultJson: { or: 2.1, ci: [1.2, 3.4], p: 0.01 },
    outputs: [],
    runtime: { language: 'python', version: '3.9.6', packages: { statsmodels: '0.14.0' } },
  }),
}

const failure: StatisticsRunner = {
  execute: async (): Promise<StatisticsRunResult> => ({
    status: 'failed',
    stdout: '',
    stderr: 'ZeroDivisionError: division by zero',
    outputs: [],
    runtime: { language: 'python', version: '3.9.6', packages: {} },
  }),
}

async function service(
  runner: StatisticsRunner,
  extra: { artifacts?: ArtifactRegistrar; artifactRoot?: string } = {},
): Promise<StatisticsService> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  await storage.datasets.put(DATASET, {
    id: DATASET, projectId: PROJECT, filename: 'ponv.csv', contentHash: 'sha256:abc', rowCount: 8, columnCount: 4,
    schema: [], createdAt: '2026-01-01T00:00:00.000Z',
  })
  let sequence = 0
  return new StatisticsService({
    storage,
    runner,
    limits: { timeoutMs: 1_000, cpuSeconds: 10, memoryMb: 256, maxOutputBytes: 10_000 },
    allowlist: [],
    now: () => '2026-01-01T00:00:00.000Z',
    newRunId: () => analysisRunIdSchema.parse(`run-${++sequence}`),
    ...extra,
  })
}

describe('StatisticsService (SPEC §34–§37)', () => {
  it('persists a plan as planned and does not execute', async () => {
    const app = await service(success)
    const run = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'PONV vs pain?', plan: PLAN })
    expect(run.status).toBe('planned')
    expect(run.datasetHash).toBe('sha256:abc')
    expect(run.generatedCode).toBe('')
  })

  it('requires an approved run before execution', async () => {
    const app = await service(success)
    const run = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'q', plan: PLAN })
    await expect(app.execute({ analysisRunId: run.id, datasetPath: '/tmp/ponv.csv' })).rejects.toThrow(/not approved/)
  })

  it('uses the stable planning code when execution names an unknown run', async () => {
    const app = await service(success)
    await expect(app.execute({ analysisRunId: 'missing-run' as never, datasetPath: '/tmp/ponv.csv' }))
      .rejects.toMatchObject({ name: 'StatisticsError', code: 'STATISTICS_PLAN_INVALID' })
  })

  it('reports a stable planning error when code generation is repeated', async () => {
    const app = await service(success)
    const planned = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'q', plan: PLAN })
    await app.generateCode(planned.id, 'print("ok")')

    await expect(app.generateCode(planned.id, 'print("again")')).rejects.toMatchObject({
      name: 'StatisticsError',
      code: 'STATISTICS_PLAN_INVALID',
      details: { analysisRunId: planned.id, status: 'waiting_approval' },
    } satisfies Partial<StatisticsError>)
  })

  it('records full provenance on a successful run', async () => {
    const app = await service(success)
    const planned = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'q', plan: PLAN })
    await app.generateCode(planned.id, 'print("ok")')
    await app.approveCode(planned.id)
    const result = await app.execute({ analysisRunId: planned.id, datasetPath: '/tmp/ponv.csv' })

    expect(result.status).toBe('succeeded')
    const stored = (await app.peekRun(planned.id))!
    expect(stored.status).toBe('succeeded')
    expect(stored.resultJson).toEqual({ or: 2.1, ci: [1.2, 3.4], p: 0.01 })
    expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(stored.runtimeVersion).toBe('3.9.6')
    expect(stored.packageVersions).toEqual({ statsmodels: '0.14.0' })
    expect(stored.finishedAt).toBeDefined()
  })

  it('keeps code and stderr and stores no result on failure (FR-20)', async () => {
    const app = await service(failure)
    const planned = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'q', plan: PLAN })
    await app.generateCode(planned.id, '1/0')
    await app.approveCode(planned.id)
    const result = await app.execute({ analysisRunId: planned.id, datasetPath: '/tmp/ponv.csv' })

    expect(result.status).toBe('failed')
    const stored = (await app.peekRun(planned.id))!
    expect(stored.status).toBe('failed')
    expect(stored.generatedCode).toBe('1/0')
    expect(stored.stderr).toContain('ZeroDivisionError')
    expect(stored.resultJson).toBeUndefined()
  })
})

describe('artifact registration (Gate 5)', () => {
  it('links a succeeded run\'s outputs to artifact records', async () => {
    const registered: Array<{ analysisRunId: string }> = []
    const artifacts: ArtifactRegistrar = {
      register: async (input) => {
        registered.push({ analysisRunId: input.analysisRunId })
        return input.outputs.map((output, index) => ({
          id: artifactIdSchema.parse(`artifact-${index + 1}`),
          projectId: input.projectId,
          analysisRunId: input.analysisRunId,
          type: output.type,
          mimeType: output.mimeType,
          storageKey: '/tmp/artifacts/x',
          metadata: {},
          createdAt: '2026-01-01T00:00:00.000Z',
        }))
      },
    }
    const app = await service({
      ...success,
      execute: async () => ({
        status: 'succeeded', stdout: '', stderr: '',
        resultJson: { or: 2 }, outputs: [{ type: 'figure', path: '/tmp/x.png', mimeType: 'image/png' }],
        runtime: { language: 'python', version: '3.9.6', packages: {} },
      }),
    }, { artifacts, artifactRoot: '/tmp/artifacts' })

    const planned = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'q', plan: PLAN })
    await app.generateCode(planned.id, 'print(1)')
    await app.approveCode(planned.id)
    await app.execute({ analysisRunId: planned.id, datasetPath: '/tmp/ponv.csv' })

    expect(registered).toEqual([{ analysisRunId: planned.id }])
    expect(app.peekRun(planned.id)!.artifactIds).toEqual(['artifact-1'])
  })

  it('does not register artifacts for a failed run', async () => {
    let calls = 0
    const app = await service(failure, {
      artifacts: { register: async () => { calls += 1; return [] } },
      artifactRoot: '/tmp/artifacts',
    })
    const planned = await app.plan({ projectId: PROJECT, datasetId: DATASET, question: 'q', plan: PLAN })
    await app.generateCode(planned.id, '1/0')
    await app.approveCode(planned.id)
    await app.execute({ analysisRunId: planned.id, datasetPath: '/tmp/ponv.csv' })
    expect(calls).toBe(0)
    expect(app.peekRun(planned.id)!.artifactIds).toEqual([])
  })
})

describe('approval policy (SPEC §40)', () => {
  it('asks before statistics_execute and allows every other tool', () => {
    expect(approvalDecision('statistics_execute')).toMatchObject({ kind: 'ask' })
    expect(approvalDecision('statistics_plan')).toEqual({ kind: 'allow' })
    expect(approvalDecision('paper_get')).toEqual({ kind: 'allow' })
  })
})
