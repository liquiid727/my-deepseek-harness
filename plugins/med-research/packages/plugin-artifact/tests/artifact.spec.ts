import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import {
  analysisRunIdSchema,
  artifactIdSchema,
  datasetIdSchema,
  projectIdSchema,
  type AnalysisRun,
  type AnalysisRunStatus,
} from '@medresearch/dsh-medical-contracts'
import { MED_ARTIFACT_EXPORT_PATH } from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { artifactExportResponse } from '../src/index.ts'
import { ArtifactError, ArtifactService } from '../src/service.ts'

const PROJECT = projectIdSchema.parse('project-1')
const RUN = analysisRunIdSchema.parse('run-1')
const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })

async function boot(): Promise<{ storage: MedStorage; service: ArtifactService; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'med-artifact-'))
  dirs.push(root)
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  let sequence = 0
  return {
    storage,
    root,
    service: new ArtifactService({
      storage,
      artifactRoot: root,
      copy: async (from, to) => { await copyFile(from, to) },
      readBytes: async path => readFile(path),
      now: () => '2026-01-01T00:00:00.000Z',
      newArtifactId: () => artifactIdSchema.parse(`artifact-${++sequence}`),
    }),
  }
}

function run(status: AnalysisRunStatus): AnalysisRun {
  return {
    id: RUN, projectId: PROJECT, datasetId: datasetIdSchema.parse('dataset-1'), datasetHash: 'sha256:data',
    question: 'q', analysisPlan: { objective: 'o', exposures: [], covariates: [], steps: [], assumptions: [], warnings: [] },
    language: 'python', generatedCode: 'print(1)', codeHash: 'sha256:code', runtime: 'python', runtimeVersion: '3.9.6',
    packageVersions: {}, status, artifactIds: [], createdAt: '2026-01-01T00:00:00.000Z',
  }
}

async function outputFile(root: string, name: string, content: string): Promise<string> {
  const path = join(root, name)
  await writeFile(path, content)
  return path
}

describe('ArtifactService (SPEC §38, Gate 5)', () => {
  it('links a figure to its succeeded run and exports the stored bytes', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const png = await outputFile(app.root, 'plot.png', 'PNGDATA')
    const svg = await outputFile(app.root, 'plot.svg', '<svg/>')

    const artifacts = await app.service.register({
      projectId: PROJECT,
      analysisRunId: RUN,
      outputs: [
        { type: 'figure', path: png, mimeType: 'image/png' },
        { type: 'figure', path: svg, mimeType: 'image/svg+xml' },
      ],
    })
    expect(artifacts).toHaveLength(2)
    expect(artifacts.every(artifact => artifact.analysisRunId === RUN)).toBe(true)
    expect(artifacts[0]!.datasetHash).toBe('sha256:data')
    expect(artifacts[0]!.codeHash).toBe('sha256:code')

    const stored = await app.service.get(artifacts[0]!.id)
    expect(stored).toEqual(artifacts[0])
    expect(Buffer.from(await app.service.export(artifacts[0]!.id, 'png')).toString()).toBe('PNGDATA')
    expect(Buffer.from(await app.service.export(artifacts[1]!.id, 'svg')).toString()).toBe('<svg/>')
  })

  it('serves artifact bytes over the authenticated export route (SPEC §30)', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const png = await outputFile(app.root, 'plot.png', 'PNGDATA')
    const [artifact] = await app.service.register({
      projectId: PROJECT, analysisRunId: RUN,
      outputs: [{ type: 'figure', path: png, mimeType: 'image/png' }],
    })

    const url = (query: string): string => `http://host${MED_ARTIFACT_EXPORT_PATH}?${query}`
    const ok = await artifactExportResponse(app.service, new Request(url(`id=${artifact!.id}&format=png`)))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await ok.arrayBuffer()).toString()).toBe('PNGDATA')

    expect((await artifactExportResponse(app.service, new Request(url(`id=${artifact!.id}&format=pdf`)))).status).toBe(400)
    expect((await artifactExportResponse(app.service, new Request(url('id=artifact-nope&format=png')))).status).toBe(404)
  })

  it('refuses to link an artifact to a run that did not succeed (Gate 5)', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('failed'))
    await expect(app.service.register({
      projectId: PROJECT, analysisRunId: RUN,
      outputs: [{ type: 'figure', path: join(app.root, 'x.png'), mimeType: 'image/png' }],
    })).rejects.toMatchObject({ code: 'RUN_NOT_SUCCEEDED' })
  })

  it('fails loud for a missing run, missing artifact, and format mismatch', async () => {
    const app = await boot()
    await expect(app.service.register({
      projectId: PROJECT, analysisRunId: analysisRunIdSchema.parse('ghost'), outputs: [],
    })).rejects.toBeInstanceOf(ArtifactError)
    await expect(app.service.get(artifactIdSchema.parse('ghost'))).resolves.toBeUndefined()
    await expect(app.service.export(artifactIdSchema.parse('ghost'), 'png'))
      .rejects.toMatchObject({ code: 'ARTIFACT_NOT_FOUND' })

    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const png = await outputFile(app.root, 'a.png', 'X')
    const [artifact] = await app.service.register({
      projectId: PROJECT, analysisRunId: RUN,
      outputs: [{ type: 'figure', path: png, mimeType: 'image/png' }],
    })
    await expect(app.service.export(artifact!.id, 'csv')).rejects.toMatchObject({ code: 'FORMAT_MISMATCH' })
  })

  it('rejects figure outputs outside the PRD PNG/SVG export contract', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const figure = await outputFile(app.root, 'plot.webp', 'WEBP')
    await expect(app.service.register({
      projectId: PROJECT,
      analysisRunId: RUN,
      outputs: [{ type: 'figure', path: figure, mimeType: 'image/webp' }],
    })).rejects.toMatchObject({ code: 'FIGURE_FORMAT_UNSUPPORTED' })
    expect([...app.storage.artifacts.entries()]).toEqual([])
  })

  it('rejects a figure whose extension disagrees with its MIME type', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const mislabeled = await outputFile(app.root, 'plot.txt', '<svg/>')
    await expect(app.service.register({
      projectId: PROJECT,
      analysisRunId: RUN,
      outputs: [{ type: 'figure', path: mislabeled, mimeType: 'image/svg+xml' }],
    })).rejects.toMatchObject({ code: 'FIGURE_FORMAT_UNSUPPORTED' })
  })

  it('preflights every output before creating any partial artifacts', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const png = await outputFile(app.root, 'plot.png', 'PNGDATA')
    const bad = await outputFile(app.root, 'plot.webp', 'WEBP')
    await expect(app.service.register({
      projectId: PROJECT,
      analysisRunId: RUN,
      outputs: [
        { type: 'figure', path: png, mimeType: 'image/png' },
        { type: 'figure', path: bad, mimeType: 'image/webp' },
      ],
    })).rejects.toMatchObject({ code: 'FIGURE_FORMAT_UNSUPPORTED' })
    expect([...app.storage.artifacts.entries()]).toEqual([])
  })

  it('traces every registered artifact back to a succeeded run', async () => {
    const app = await boot()
    await app.storage.analysisRuns.put(RUN, run('succeeded'))
    const file = await outputFile(app.root, 't.csv', 'a,b\n1,2\n')
    const [artifact] = await app.service.register({
      projectId: PROJECT, analysisRunId: RUN,
      outputs: [{ type: 'table', path: file, mimeType: 'text/csv' }],
    })
    const linked = app.storage.analysisRuns.get(artifact!.analysisRunId!)
    expect(linked?.status).toBe('succeeded')
  })
})
