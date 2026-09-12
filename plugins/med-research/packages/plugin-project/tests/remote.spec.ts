/**
 * Remote surface of the project service (SPEC §30, §32). The test boots the
 * real Typert registry and Gateway and calls through the SRC discovery path, so
 * it fails if a method loses its `@Remote` marker, its `typertRemote` binding,
 * or a wire parameter name drifts from the client contract.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { projectIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { ProjectsService, type ProjectFileStore, type WorkspaceRegistrar } from '../src/service.ts'

interface RemoteHarness {
  ctx: Context
  service: ProjectsService
  close(): Promise<void>
}

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function openStorage(): Promise<{ storage: MedStorage; close(): Promise<void> }> {
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

async function remoteHarness(): Promise<RemoteHarness> {
  const boot = await openStorage()
  booted.push(boot)
  const files: ProjectFileStore = { async write() {} }
  const workspaces: WorkspaceRegistrar = { async create() { return { id: 'ws-1' } } }
  let sequence = 0
  const service = new ProjectsService({
    storage: boot.storage,
    files,
    workspaces,
    workspaceRoot: '/tmp/med-remote',
    now: () => '2026-01-01T00:00:00.000Z',
    newId: () => projectIdSchema.parse(`project-${++sequence}`),
  })
  const ctx = new Context()
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(TypertGatewayService)
  const dispose = ctx.provide('medProjects', service)
  return {
    ctx,
    service,
    async close() {
      dispose()
      await boot.close()
    },
  }
}

describe('medProjects Remote surface (SPEC §30, §32)', () => {
  it('marks the whole published interface and binds the medProjects namespace', async () => {
    const app = await remoteHarness()
    expect(app.service.typertRemote.namespace).toBe('medProjects')
    expect(remoteMethods(app.service).map(marker => marker.method).sort())
      .toEqual(['create', 'delete', 'get', 'getMode', 'list', 'overview', 'savePaper', 'setMode', 'update'])
  })

  it('creates and lists through the Gateway SRC path', async () => {
    const app = await remoteHarness()
    const created = await app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'create',
      args: { input: { name: 'PONV', researchQuestion: 'PONV 与术后疼痛是否相关？' } },
    }) as { id: string; name: string; workspacePath: string }

    expect(created.name).toBe('PONV')
    expect(created.workspacePath).toBe('/tmp/med-remote/ponv-project1')

    const listed = await app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'list',
      args: {},
    }) as unknown[]
    expect(listed).toHaveLength(1)

    const read = await app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'get',
      args: { id: created.id },
    }) as { id: string }
    expect(read.id).toBe(created.id)

    const overview = await app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'overview',
      args: { id: created.id },
    }) as { projectId: string; papers: number }
    expect(overview).toMatchObject({ projectId: created.id, papers: 0 })

    await expect(app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'setMode',
      args: { sessionId: 'session-1', mode: 'paper' },
    })).resolves.toBe('paper')
    await expect(app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'getMode',
      args: { sessionId: 'session-1' },
    })).resolves.toBe('paper')
  })

  it('rejects an endpoint outside the published surface', async () => {
    const app = await remoteHarness()
    await expect(app.ctx.typertGateway.invoke({
      namespace: 'medProjects',
      method: 'dropAll',
      args: {},
    })).rejects.toMatchObject({ code: 'gateway/invocation-unavailable' })
  })
})
