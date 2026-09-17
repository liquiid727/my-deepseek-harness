import { afterEach, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { ArtifactService } from '@medresearch/dsh-plugin-artifact'
import { DatasetsService } from '@medresearch/dsh-plugin-dataset'
import { StatisticsService } from '@medresearch/dsh-plugin-statistics'
import { RestrictedProcessRunner } from '@medresearch/dsh-medical-runner-container'

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => { for (const item of booted.splice(0)) await item.close() })

const PROJECT = c.projectIdSchema.parse('project-1')
const DATASET_FIXTURE = new URL('../../plugin-statistics/tests/fixtures/linear.csv', import.meta.url).pathname

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

const ANALYSIS = `import csv, json, math, os
rows = list(csv.DictReader(open(os.environ['MED_DATASET_PATH'])))
xs = [float(r['x']) for r in rows]
ys = [float(r['y']) for r in rows]
n = len(xs); mx = sum(xs)/n; my = sum(ys)/n
slope = sum((x-mx)*(y-my) for x, y in zip(xs, ys)) / sum((x-mx)**2 for x in xs)
intercept = my - slope*mx
out = os.environ['MED_OUTPUT_DIR']
json.dump({'slope': slope, 'intercept': intercept, 'n': n}, open(os.path.join(out, 'result.json'), 'w'))
open(os.path.join(out, 'coefficients.csv'), 'w').write('term,estimate\\nslope,%f\\nintercept,%f\\n' % (slope, intercept))
open(os.path.join(out, 'scatter.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><circle cx="20" cy="60" r="3"/></svg>')
print('ok')
`

describe('Statistics chain (PRD §36 Statistics DoD)', () => {
  it('runs CSV → profile → plan → code → isolated execution → artifact provenance', async () => {
    const storage = await boot()
    let datasetSequence = 0
    let runSequence = 0
    let artifactSequence = 0

    // 1. Upload and profile a real CSV.
    const datasets = new DatasetsService({
      storage, maxBytes: 1024 * 1024, maxRows: 1_000,
      readFile: path => readFile(path, 'utf8'),
      now: () => '2026-01-01T00:00:00.000Z',
      newDatasetId: () => c.datasetIdSchema.parse(`dataset-${++datasetSequence}`),
    })
    const dataset = await datasets.upload({ projectId: PROJECT, fileRef: DATASET_FIXTURE })
    expect(dataset.rowCount).toBe(5)
    expect(dataset.schema.map(column => column.inferredType)).toEqual(['continuous', 'continuous'])

    // 2. Artifact + runner + statistics services over one storage.
    const artifacts = new ArtifactService({
      storage, artifactRoot: '/tmp/med-e2e-artifacts',
      copy: async (from, to) => { await import('node:fs/promises').then(fs => fs.copyFile(from, to)) },
      readBytes: path => readFile(path),
      now: () => '2026-01-01T00:00:00.000Z',
      newArtifactId: () => c.artifactIdSchema.parse(`artifact-${++artifactSequence}`),
    })
    const statistics = new StatisticsService({
      storage,
      runner: new RestrictedProcessRunner({ pythonPath: 'python3', isolationLevel: 'restricted-process' }),
      limits: { timeoutMs: 20_000, cpuSeconds: 10, memoryMb: 512, maxOutputBytes: 50_000 },
      allowlist: [],
      now: () => '2026-01-01T00:00:00.000Z',
      newRunId: () => c.analysisRunIdSchema.parse(`run-${++runSequence}`),
      artifacts,
      artifactRoot: '/tmp/med-e2e-artifacts',
    })

    // 3. Plan (no execution), then code, then approved execution.
    const planned = await statistics.plan({
      projectId: PROJECT, datasetId: dataset.id, question: 'Does x predict y?',
      plan: {
        objective: 'Estimate the linear association between x and y',
        outcome: 'y', exposures: ['x'], covariates: [],
        steps: [{ id: 's1', method: 'ordinary least squares', reason: 'continuous outcome', variables: ['x', 'y'] }],
        assumptions: ['linearity'], warnings: [],
      },
    })
    expect(planned.status).toBe('planned')
    expect(planned.datasetHash).toBe(dataset.contentHash)

    // A planned run cannot execute until code generation approves it.
    await expect(statistics.execute({ analysisRunId: planned.id, datasetPath: DATASET_FIXTURE }))
      .rejects.toThrow(/not approved/)
    const approved = await statistics.generateCode(planned.id, ANALYSIS)
    expect(approved.status).toBe('waiting_approval')
    await statistics.approveCode(planned.id)

    const result = await statistics.execute({ analysisRunId: planned.id, datasetPath: DATASET_FIXTURE })
    expect(result.status).toBe('succeeded')
    expect(result.resultJson).toMatchObject({ slope: 2, intercept: 1, n: 5 })

    // 4. Full provenance and a run-linked artifact.
    const run = statistics.peekRun(planned.id)!
    expect(run.status).toBe('succeeded')
    expect(run.datasetHash).toBe(dataset.contentHash)
    expect(run.codeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(run.runtime).toBe('python')
    expect(run.runtimeVersion).toMatch(/^3\./)
    expect(run.finishedAt).toBeDefined()
    expect(run.artifactIds).toHaveLength(2)

    const records = await Promise.all(run.artifactIds.map(id => artifacts.get(id)))
    const artifact = records.find(item => item?.mimeType === 'text/csv')
    const figure = records.find(item => item?.type === 'figure')
    expect(artifact?.analysisRunId).toBe(planned.id)
    expect(figure?.analysisRunId).toBe(planned.id)
    expect(artifact?.datasetHash).toBe(dataset.contentHash)
    expect(figure?.datasetHash).toBe(dataset.contentHash)
    expect(artifact?.codeHash).toBe(run.codeHash)
    expect(figure?.codeHash).toBe(run.codeHash)
    const exported = Buffer.from(await artifacts.export(artifact!.id, 'csv')).toString()
    expect(exported).toContain('term,estimate')
    const exportedFigure = Buffer.from(await artifacts.export(figure!.id, 'svg')).toString()
    expect(exportedFigure).toContain('<svg')

    // 5. SPEC §49: upload, approval, execution, and export each left one row.
    const audits = [...storage.auditLogs.entries()].map(([, row]) => row)
    expect(audits.map(row => row.action)).toEqual([
      'dataset.upload', 'statistics.approve', 'code.execute', 'artifact.export', 'artifact.export',
    ])
    expect(audits.every(row => row.projectId === PROJECT && row.at === '2026-01-01T00:00:00.000Z')).toBe(true)
    expect(audits[0]!.detail).toEqual({
      datasetId: dataset.id,
      filename: 'linear.csv',
      rowCount: 5,
      columnCount: 2,
    })
  })
})
