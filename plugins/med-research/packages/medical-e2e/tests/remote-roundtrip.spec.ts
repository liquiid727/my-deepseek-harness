/**
 * Client-to-host round trip for the project Remote surface. The browser client
 * built by `createMedRemote` calls the Gateway's real `/api` interceptor, so the
 * endpoint names, named arguments, success values, and error envelopes are
 * proven against the live host service rather than a hand-written stub.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { projectIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { ProjectsService, type ProjectFileStore, type WorkspaceRegistrar } from '@medresearch/dsh-plugin-project/src/service.ts'
import { createMedRemote, MedRemoteError, type RemoteCaller, type RemoteCallResult } from '@medresearch/dsh-plugin-medical-ui/src/client/remote.ts'

type RpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RemoteCallResult>

/** Minimal Connection host half: retains the `/api` interceptor the Gateway registers. */
class FakeConnectionService extends Service {
  handler: RpcHandler | undefined

  constructor(ctx: Context) {
    super(ctx, 'connection')
  }

  get rpc() {
    const owner = this.ctx
    return {
      intercept: (
        _channel: string,
        _matches: (endpoint: string) => boolean,
        handler: RpcHandler,
      ) =>
        owner.effect(() => {
          this.handler = handler
          return () => { this.handler = undefined }
        }),
    }
  }

  requestRejection(): undefined {
    return undefined
  }
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

/** The browser caller under test: the real Gateway interceptor over the real service. */
async function roundTrip(): Promise<RemoteCaller> {
  const boot = await openStorage()
  booted.push(boot)
  const files: ProjectFileStore = { async write() {} }
  const workspaces: WorkspaceRegistrar = { async create() { return { id: 'ws-1' } } }
  let sequence = 0
  const service = new ProjectsService({
    storage: boot.storage,
    files,
    workspaces,
    workspaceRoot: '/tmp/med-roundtrip',
    now: () => '2026-01-01T00:00:00.000Z',
    newId: () => projectIdSchema.parse(`project-${++sequence}`),
  })
  const ctx = new Context()
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(FakeConnectionService)
  await ctx.plugin(TypertGatewayService)
  ctx.provide('medProjects', service)
  const connection = ctx.get('connection') as unknown as FakeConnectionService
  const handler = connection.handler
  if (handler === undefined) throw new Error('Gateway did not register its /api interceptor')
  return {
    call: (channel, endpoint, payload, signal) => handler(endpoint, payload, signal ?? new AbortController().signal),
  }
}

describe('med Remote round trip (SPEC §30, §32)', () => {
  it('creates, lists, reads, and counts through the browser client', async () => {
    const remote = createMedRemote(await roundTrip())
    const created = await remote.projects.create({ name: 'PONV', researchQuestion: 'PONV 与术后疼痛是否相关？' })

    expect(created.name).toBe('PONV')
    expect(created.workspacePath).toBe('/tmp/med-roundtrip/ponv-project1')
    await expect(remote.projects.list()).resolves.toEqual([created])
    await expect(remote.projects.get(created.id)).resolves.toEqual(created)
    await expect(remote.projects.overview(created.id)).resolves.toMatchObject({
      projectId: created.id,
      papers: { status: 'counted', value: 0 },
      analyses: { status: 'counted', value: 0 },
    })
    await expect(remote.projects.update(created.id, { name: 'PONV 2026' }))
      .resolves.toMatchObject({ id: created.id, name: 'PONV 2026' })
    await expect(remote.projects.delete(created.id)).resolves.toBeUndefined()
    await expect(remote.projects.get(created.id)).resolves.toBeUndefined()
  })

  it('carries a host business failure back as a coded error envelope', async () => {
    const remote = createMedRemote(await roundTrip())
    const failure = await remote.projects.overview('project-missing' as never).catch(error => error)
    expect(failure).toBeInstanceOf(MedRemoteError)
    expect(failure).toMatchObject({ code: 'gateway/internal' })
    expect(failure.message).toMatch(/no project project-missing/)
  })
})
