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
      updatedAt: '2026-01-01T00:00:00.000Z',
      papers: { status: 'counted', value: 0 },
      evidences: { status: 'counted', value: 0 },
      notes: { status: 'counted', value: 0 },
      documents: { status: 'counted', value: 0 },
      datasets: { status: 'counted', value: 0 },
      sessions: { status: 'counted', value: 0 },
      tasks: { status: 'counted', value: 0 },
      analyses: { status: 'counted', value: 0 },
      charts: { status: 'counted', value: 0 },
    })
  })

  it('reports growth inside the trailing window and no delta beside an empty domain', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    // Two notes: one inside the window, one older than it, and one soft-deleted.
    const note = (id: string, createdAt: string, deletedAt?: string) => ({
      id,
      projectId: project.id,
      scope: 'project' as const,
      title: id,
      content: 'body',
      version: 1,
      createdAt,
      updatedAt: createdAt,
      ...(deletedAt === undefined ? {} : { deletedAt }),
    })
    await app.storage.notes.put('note-recent' as never, note('note-recent', '2025-12-31T00:00:00.000Z') as never)
    await app.storage.notes.put('note-old' as never, note('note-old', '2025-01-01T00:00:00.000Z') as never)
    await app.storage.notes.put('note-deleted' as never, note('note-deleted', '2025-12-31T00:00:00.000Z', '2025-12-31T00:00:00.000Z') as never)

    const overview = await app.service.overview(project.id)
    // The harness clock is fixed at 2026-01-01, so the 30-day window opens on
    // 2025-12-02: the recent note is inside it, the January one is not, and the
    // soft-deleted note is not a note the user can open.
    expect(overview.notes).toEqual({ status: 'counted', value: 2, delta: { value: 1, windowDays: 30 } })
    // Empty domains report a total and nothing else.
    expect(overview.evidences).toEqual({ status: 'counted', value: 0 })
    // Domains whose records carry no timestamp never report a delta.
    expect(overview.analyses).toEqual({ status: 'counted', value: 0 })
  })

  it('reports an unavailable domain instead of zero when a storage read fails', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    const failing = new Map()
    const original = app.storage.evidences.entries.bind(app.storage.evidences)
    ;(app.storage.evidences as unknown as { entries: () => IterableIterator<never> }).entries = () => {
      void original()
      throw new Error('domain read failed')
    }
    const overview = await app.service.overview(project.id)
    expect(overview.evidences).toEqual({ status: 'unavailable' })
    expect(overview.papers).toEqual({ status: 'counted', value: 0 })
  })

  it('rejects a duplicate project name before any write', async () => {
    const app = await harness('/tmp/root')
    await app.service.create({ name: 'One' })
    const writesBefore = app.writes.length
    await expect(app.service.create({ name: '  one  ' }))
      .rejects.toMatchObject({ code: 'PROJECT_DUPLICATE' })
    expect(app.writes).toHaveLength(writesBefore)
  })

  it('archives and restores a project under the same identity (SPEC-R001-S01-001)', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    const archived = await app.service.archive(project.id)
    expect(archived.status).toBe('archived')
    expect(parseProjectFile(app.writes.at(-1)!.content).status).toBe('archived')
    await expect(app.service.update(project.id, { name: 'Renamed' }))
      .rejects.toMatchObject({ code: 'PROJECT_BUSY' })
    await expect(app.service.archive(project.id))
      .rejects.toMatchObject({ code: 'PROJECT_BUSY' })
    const restored = await app.service.restore(project.id)
    expect(restored.id).toBe(project.id)
    expect(restored.status).toBe('active')
    expect(restored.workspacePath).toBe(project.workspacePath)
    expect([...app.storage.auditLogs.entries()].map(([, row]) => row.action))
      .toEqual(['project.create', 'project.archive', 'project.restore'])
  })

  it('fails loud when the project does not exist', async () => {
    const app = await harness('/tmp/root')
    const missing = projectIdSchema.parse('nope')
    await expect(app.service.overview(missing)).rejects.toBeInstanceOf(ProjectError)
    await expect(app.service.update(missing, { name: 'x' })).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    await expect(app.service.delete(missing)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })

  it('rejects invalid project input before writing any state', async () => {
    const app = await harness('/tmp/root')
    await expect(app.service.create({ name: '   ' })).rejects.toThrow()
    expect(app.writes).toHaveLength(0)
    expect(app.workspaces).toHaveLength(0)
    expect(await app.service.list()).toEqual([])
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

  it('selects a project through the client seam and audits the switch', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    const binding = await app.service.selectProject('session-9', project.id)
    expect(binding.projectId).toBe(project.id)
    expect(app.storage.sessionProjects.get('session-9')).toEqual(binding)
    expect((await app.service.sessions(project.id)).map(row => row.sessionId)).toEqual(['session-9'])
    expect([...app.storage.auditLogs.entries()].map(([, row]) => row.action))
      .toEqual(['project.create', 'project.select'])
  })

  it('rejects a stale expectedVersion with no partial write', async () => {
    const app = await harness('/tmp/root')
    const project = await app.service.create({ name: 'One' })
    await expect(app.service.update(project.id, { name: 'Renamed' }, 'stale-token'))
      .rejects.toMatchObject({ code: 'PROJECT_VERSION_CONFLICT' })
    expect(app.storage.projects.get(project.id)?.name).toBe('One')
    expect(app.writes).toHaveLength(1)
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
    expect((await app.service.overview(project.id)).papers)
      .toEqual({ status: 'counted', value: 1, delta: { value: 1, windowDays: 30 } })

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
