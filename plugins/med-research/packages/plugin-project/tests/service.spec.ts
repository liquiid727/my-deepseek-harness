import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import FsLocal from '@deepseek-ai/dsh-fs-local'
import { paperIdSchema, projectIdSchema, type Project } from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { parseProjectFile, projectJsonPath } from '../src/project-file.ts'
import { ProjectsService, ProjectError, type ProjectFileStore, type WorkspaceRegistrar } from '../src/service.ts'

interface Harness {
  service: ProjectsService
  storage: MedStorage
  writes: Array<{ path: string; content: string }>
  workspaces: Array<{ path: string; title: string }>
  close(): Promise<void>
}

async function bootStorage(): Promise<{ storage: MedStorage; close(): Promise<void> }> {
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

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function harness(workspaceRoot: string): Promise<Harness> {
  const boot = await bootStorage()
  booted.push(boot)
  const writes: Harness['writes'] = []
  const workspaces: Harness['workspaces'] = []
  const files: ProjectFileStore = {
    async write(path, content) {
      writes.push({ path, content })
    },
  }
  const registrar: WorkspaceRegistrar = {
    async create(path, title) {
      workspaces.push({ path, title })
      return { id: 'ws-1' }
    },
  }
  let sequence = 0
  const service = new ProjectsService({
    storage: boot.storage,
    files,
    workspaces: registrar,
    workspaceRoot,
    now: () => '2026-01-01T00:00:00.000Z',
    newId: () => projectIdSchema.parse(`project-${++sequence}`),
  })
  return { service, storage: boot.storage, writes, workspaces, close: boot.close }
}

describe('ProjectsService (SPEC §32)', () => {
  it('creates the record, the project.json mirror, and the workspace binding', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'PONV', researchQuestion: 'PONV 与疼痛？' })

    expect(project.workspacePath).toBe('/tmp/root/ponv-project1')
    expect(app.writes).toHaveLength(1)
    expect(app.writes[0]!.path).toBe(projectJsonPath(project.workspacePath))
    expect(parseProjectFile(app.writes[0]!.content)).toEqual(project)
    expect(app.workspaces).toEqual([{ path: project.workspacePath, title: 'PONV' }])
    expect(app.storage.projects.get(project.id)).toEqual(project)
  })

  it('reads, lists, and counts project records', async () => {
    const app = await harness('/tmp/root')
    const created = await app.service.create({ name: 'One' })
    expect(await app.service.get(created.id)).toEqual(created)
    expect(await app.service.list()).toEqual([created])
    const overview = await app.service.overview(created.id)
    expect(overview).toEqual({
      projectId: created.id,
      questions: 0,
      papers: 0,
      evidences: 0,
      datasets: 0,
      analyses: 0,
      charts: 0,
    })
  })

  it('fails loud when the project does not exist', async () => {
    const app = await harness('/tmp/root')
    const missing = projectIdSchema.parse('nope')
    await expect(app.service.overview(missing)).rejects.toBeInstanceOf(ProjectError)
    await expect(app.service.update(missing, { name: 'x' })).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    await expect(app.service.delete(missing)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })

  it('deletes one project and audits the deletion (SPEC §49)', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    await app.service.delete(project.id)
    expect(await app.service.get(project.id)).toBeUndefined()
    expect([...app.storage.auditLogs.entries()].map(([, row]) => row.action))
      .toEqual(['project.create', 'project.delete'])
  })

  it('binds a session to a project and replaces the binding (SPEC §41)', async () => {
    const app = await harness('/tmp/root')
    const first = await app.service.create({ name: 'One' })
    const second = await app.service.create({ name: 'Two' })
    expect(await app.service.sessionProject('session-1')).toBeUndefined()

    await expect(app.service.bindSession('session-1', projectIdSchema.parse('ghost')))
      .rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })

    const binding = await app.service.bindSession('session-1', first.id)
    expect(binding).toEqual({
      sessionId: 'session-1',
      projectId: first.id,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(await app.service.sessionProject('session-1')).toEqual(binding)

    const rebound = await app.service.bindSession('session-1', second.id)
    expect(rebound.projectId).toBe(second.id)
    expect(app.storage.sessionProjects.get('session-1')).toEqual(rebound)
  })

  it('saves an existing paper and rejects an unknown one', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    const paper = {
      id: paperIdSchema.parse('paper-1'),
      pmid: '123',
      title: 'A paper',
      authors: [{ name: 'A. Author' }],
      publicationTypes: [],
      meshTerms: [],
      keywords: [],
      source: 'pubmed' as const,
      fulltextStatus: 'abstract_only' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await app.storage.papers.put(paper.id, paper)

    const membership = await app.service.savePaper(project.id, paper.id)
    expect(membership).toEqual({ projectId: project.id, paperId: paper.id, savedAt: '2026-01-01T00:00:00.000Z' })
    expect((await app.service.overview(project.id)).papers).toBe(1)

    await expect(app.service.savePaper(project.id, paperIdSchema.parse('ghost')))
      .rejects.toMatchObject({ code: 'PAPER_NOT_FOUND' })
  })
})

describe('ProjectsService over the real filesystem backend', () => {
  it('writes <workspace>/.medresearch/project.json to disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'med-project-'))

    const ctx = new Context()
    await ctx.plugin(Storage)
    const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
    ctx.storage.backend.register('sqlite', backend)
    const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
    ctx.storage.mount('domain', facility)
    const storage = await openMedStorage(facility)
    booted.push({ close: async () => { await storage.close(); await facility.closeAll(); await backend.close() } })

    const fsCtx = new Context()
    await fsCtx.plugin(FsLocal, { cwd: root })

    const service = new ProjectsService({
      storage,
      files: {
        async write(path, content) {
          const target = await fsCtx.fs.resolve(path)
          await fsCtx.fs.writeText(target, content)
        },
      },
      workspaces: { create: async () => ({ id: 'ws-1' }) },
      workspaceRoot: root,
      now: () => '2026-01-01T00:00:00.000Z',
      newId: () => projectIdSchema.parse('abc-123-def'),
    })

    const project = await service.create({ name: 'On disk' })
    const text = await readFile(projectJsonPath(project.workspacePath), 'utf8')
    const parsed: Project = parseProjectFile(text)
    expect(parsed.id).toBe(project.id)
    expect(parsed.workspacePath).toBe(project.workspacePath)
    await rm(root, { recursive: true, force: true })
  })
})
