/**
 * Audit-row validation (SPEC §49, AGENTS.md §2.8). The domain medium does not
 * enforce a table's value schema on write, so the audit writer must: an
 * operation that is not in the contract must be rejected rather than stored as
 * a row no consumer can classify.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import { AUDIT_ACTIONS_REQUIRED_BY_SKILLS } from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'

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

describe('audit writer validation (SPEC §49)', () => {
  it('writes a declared action and reads it back', async () => {
    const storage = await boot()
    const writer = createAuditWriter({ storage, now: () => '2026-01-01T00:00:00.000Z' })
    const row = await writer.append({ action: 'skill.revoke', detail: { skillId: 's1' } })
    expect(row).toMatchObject({ action: 'skill.revoke', at: '2026-01-01T00:00:00.000Z' })
    expect(storage.auditLogs.get(row.id)).toEqual(row)
  })

  it('rejects an action that is not in the contract instead of storing it', async () => {
    const storage = await boot()
    const writer = createAuditWriter({ storage, now: () => '2026-01-01T00:00:00.000Z' })
    await expect(writer.append({ action: 'skill.invented' as never, detail: {} })).rejects.toThrow()
    expect(storage.auditLogs.size).toBe(0)
  })

  it('declares every audit action the skill lifecycle needs', async () => {
    // Keeps the contract enum and the service audit map from drifting apart:
    // the service types its audits as `AuditAction`, so a missing entry is a
    // compile error as well as a rejected write.
    const storage = await boot()
    const writer = createAuditWriter({ storage, now: () => '2026-01-01T00:00:00.000Z' })
    for (const action of AUDIT_ACTIONS_REQUIRED_BY_SKILLS) {
      await expect(writer.append({ action, detail: {} })).resolves.toMatchObject({ action })
    }
  })
})
