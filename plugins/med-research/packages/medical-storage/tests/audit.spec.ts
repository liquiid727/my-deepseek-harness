/**
 * Audit writer coverage (SPEC §49). The writer is the only producer of
 * `med_audit_logs` rows: it owns row identity and stamps the injected clock,
 * so every service that appends gets the same record contract.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, openMedStorage, type MedStorage } from '../src/index.ts'

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function boot(): Promise<MedStorage> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  booted.push({
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  })
  return storage
}

const AT = '2026-01-01T00:00:00.000Z'

describe('audit writer (SPEC §49)', () => {
  it('appends one row per audited operation with the injected clock', async () => {
    const storage = await boot()
    const audit = createAuditWriter({ storage, now: () => AT })

    const row = await audit.append({
      action: 'project.create',
      projectId: c.projectIdSchema.parse('project-1'),
      detail: { name: 'PONV' },
    })

    expect(row).toMatchObject({
      action: 'project.create',
      projectId: 'project-1',
      at: AT,
      detail: { name: 'PONV' },
    })
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(storage.auditLogs.get(row.id)).toEqual(row)
    expect([...storage.auditLogs.entries()]).toHaveLength(1)
  })

  it('omits project and session when the operation has neither and defaults detail', async () => {
    const storage = await boot()
    const audit = createAuditWriter({ storage, now: () => AT })

    const row = await audit.append({ action: 'artifact.export' })

    expect(row.projectId).toBeUndefined()
    expect(row.sessionId).toBeUndefined()
    expect(row.detail).toEqual({})
  })

  it('keeps rows append-only and gives each a distinct id', async () => {
    const storage = await boot()
    const audit = createAuditWriter({ storage, now: () => AT })

    const first = await audit.append({ action: 'code.execute', detail: { analysisRunId: 'run-1' } })
    const second = await audit.append({ action: 'code.execute', detail: { analysisRunId: 'run-2' } })

    expect(first.id).not.toBe(second.id)
    expect([...storage.auditLogs.entries()].map(([, row]) => row.detail))
      .toEqual([{ analysisRunId: 'run-1' }, { analysisRunId: 'run-2' }])
  })

  it('records the session that caused the operation when one is in scope', async () => {
    const storage = await boot()
    const audit = createAuditWriter({ storage, now: () => AT })

    const row = await audit.append({ action: 'dataset.upload', sessionId: 'session-1' })

    expect(row.sessionId).toBe('session-1')
  })
})
