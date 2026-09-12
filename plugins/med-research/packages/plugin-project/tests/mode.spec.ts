import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import { projectIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { MODE_TOOL_ALLOWLIST } from '../src/mode.ts'
import { ProjectsService, type ProjectFileStore, type WorkspaceRegistrar } from '../src/service.ts'

interface Boot {
  storage: MedStorage
  close(): Promise<void>
}

const boots: Boot[] = []
afterEach(async () => {
  for (const boot of boots.splice(0)) await boot.close()
})

async function boot(): Promise<Boot> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  const value = {
    storage,
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  }
  boots.push(value)
  return value
}

function service(storage: MedStorage, calls: string[][] = []): ProjectsService {
  const agent = {
    id: 'session-1',
    ctx: {
      tools: {
        restrict(filter: { allow: readonly string[] }) {
          calls.push([...filter.allow])
          return () => { calls.push(['released']) }
        },
      },
    },
  }
  return new ProjectsService({
    storage,
    files: { async write(_path: string, _content: string) {} } satisfies ProjectFileStore,
    workspaces: { async create() { return { id: 'workspace-1' } } } satisfies WorkspaceRegistrar,
    workspaceRoot: '/tmp/med-mode',
    now: () => '2026-01-01T00:00:00.000Z',
    newId: () => projectIdSchema.parse('project-1'),
    agents: { get(id: string) { return id === agent.id ? agent : undefined } },
  })
}

describe('Project workspace Agent Mode (SPEC-R001-S01-003)', () => {
  it('applies a scoped allowlist and audits the selection', async () => {
    const booted = await boot()
    const calls: string[][] = []
    const projects = service(booted.storage, calls)

    await expect(projects.setMode('session-1', 'paper')).resolves.toBe('paper')
    expect(calls[0]).toEqual([...MODE_TOOL_ALLOWLIST.paper])
    expect([...booted.storage.auditLogs.entries()].map(([, row]) => row)).toEqual([
      expect.objectContaining({ action: 'mode.change', sessionId: 'session-1', detail: { mode: 'paper' } }),
    ])
  })

  it('replaces the prior restriction with the selected allowlist', async () => {
    const booted = await boot()
    const calls: string[][] = []
    const projects = service(booted.storage, calls)

    await projects.setMode('session-1', 'paper')
    await projects.setMode('session-1', 'statistics')
    expect(calls).toEqual([
      [...MODE_TOOL_ALLOWLIST.paper],
      [...MODE_TOOL_ALLOWLIST.statistics],
      ['released'],
    ])
  })

  it('reads the latest audited mode after a service restart', async () => {
    const booted = await boot()
    const first = service(booted.storage)
    await first.setMode('session-1', 'statistics')

    const second = service(booted.storage)
    await expect(second.getMode(' session-1 ')).resolves.toBe('statistics')
  })
})
