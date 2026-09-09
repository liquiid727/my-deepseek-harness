/**
 * Tool-level coverage of the session→project binding (SPEC §41). The tools are
 * the only writers of `med_session_project`: creating a project binds it, and an
 * explicit `project_get_context` selects and binds it. Each tool is called with
 * the minimal execution context the implementation reads (`exec.agent`).
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { projectIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { ProjectsService, type ProjectFileStore, type WorkspaceRegistrar } from '../src/service.ts'
import { projectTools } from '../src/tools.ts'

interface Envelope {
  ok: boolean
  result?: { project?: { id: string } }
  error?: { code: string }
}

interface Harness {
  storage: MedStorage
  service: ProjectsService
  tools: ToolDefinition[]
  close(): Promise<void>
}

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function harness(): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  const close = async (): Promise<void> => {
    await storage.close()
    await facility.closeAll()
    await backend.close()
  }
  booted.push({ close })

  const files: ProjectFileStore = { async write() {} }
  const workspaces: WorkspaceRegistrar = { async create() { return { id: 'ws-1' } } }
  let sequence = 0
  const service = new ProjectsService({
    storage,
    files,
    workspaces,
    workspaceRoot: '/tmp/med-tools',
    now: () => '2026-01-01T00:00:00.000Z',
    newId: () => projectIdSchema.parse(`project-${++sequence}`),
  })
  return { storage, service, tools: projectTools(service), close }
}

/** The execution context a model-driven call carries: the session-backed agent id. */
const session = (id: string): unknown => ({ agent: { id } })

async function call(tools: ToolDefinition[], name: string, args: unknown, exec: unknown): Promise<Envelope> {
  const tool = tools.find(candidate => candidate.name === name)
  if (tool === undefined) throw new Error(`no tool ${name}`)
  return await tool.execute(args, exec as never) as Envelope
}

describe('project tools bind the session to its project (SPEC §41)', () => {
  it('binds the session to the project it creates', async () => {
    const app = await harness()
    const created = await call(app.tools, 'project_create', { name: 'One' }, session('session-1'))
    expect(created.ok).toBe(true)

    expect(await app.service.sessionProject('session-1')).toEqual({
      sessionId: 'session-1',
      projectId: projectIdSchema.parse('project-1'),
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('writes no binding when the call carries no agent', async () => {
    const app = await harness()
    const created = await call(app.tools, 'project_create', { name: 'One' }, {})
    expect(created.ok).toBe(true)
    expect([...app.storage.sessionProjects.entries()]).toEqual([])
  })

  it('resolves context from the bound project when projectId is omitted', async () => {
    const app = await harness()
    await call(app.tools, 'project_create', { name: 'One' }, session('session-1'))

    const context = await call(app.tools, 'project_get_context', {}, session('session-1'))
    expect(context).toMatchObject({
      ok: true,
      result: { project: { id: 'project-1' } },
    })
  })

  it('selects and rebinds the session when projectId is explicit', async () => {
    const app = await harness()
    await call(app.tools, 'project_create', { name: 'One' }, session('session-1'))
    await call(app.tools, 'project_create', { name: 'Two' }, session('session-1'))
    // The second create already rebound the session; point it back at the first.
    const context = await call(
      app.tools,
      'project_get_context',
      { projectId: 'project-1' },
      session('session-1'),
    )
    expect(context).toMatchObject({ ok: true, result: { project: { id: 'project-1' } } })
    expect((await app.service.sessionProject('session-1'))?.projectId).toBe('project-1')
  })

  it('treats an empty or whitespace projectId as omitted', async () => {
    const app = await harness()
    await call(app.tools, 'project_create', { name: 'One' }, session('session-1'))

    for (const projectId of ['', '   ']) {
      const context = await call(app.tools, 'project_get_context', { projectId }, session('session-1'))
      expect(context, JSON.stringify(projectId)).toMatchObject({
        ok: true,
        result: { project: { id: 'project-1' } },
      })
    }
    // Surrounding whitespace on a real id is trimmed rather than rejected.
    const trimmed = await call(app.tools, 'project_get_context', { projectId: ' project-1 ' }, session('session-2'))
    expect(trimmed).toMatchObject({ ok: true, result: { project: { id: 'project-1' } } })
  })

  it('reports PROJECT_NOT_BOUND when neither an explicit id nor a binding exists', async () => {
    const app = await harness()
    expect(await call(app.tools, 'project_get_context', {}, session('session-1')))
      .toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_BOUND' } })
    expect(await call(app.tools, 'project_get_context', {}, {}))
      .toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_BOUND' } })
  })

  it('reports PROJECT_NOT_FOUND for an explicit id that does not exist', async () => {
    const app = await harness()
    expect(await call(app.tools, 'project_get_context', { projectId: 'ghost' }, session('session-1')))
      .toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' } })
  })
})
