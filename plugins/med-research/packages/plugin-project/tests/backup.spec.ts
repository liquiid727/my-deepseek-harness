/**
 * Backup command coverage (SPEC §15.2, FR-21). The commands are exercised over
 * a real storage handle and an in-memory file seam, so a bundle written by
 * `/med-export` must import through `/med-import` record-for-record, and every
 * rejection must leave the target store untouched.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import { projectIdSchema } from '@medresearch/dsh-medical-contracts'
import {
  medExport,
  openMedStorage,
  type MedExportBundle,
  type MedStorage,
} from '@medresearch/dsh-medical-storage'
import {
  MED_EXPORT_COMMAND,
  MED_IMPORT_COMMAND,
  runMedExport,
  runMedImport,
  type BackupFiles,
} from '../src/backup.ts'
import { ProjectsService, type ProjectFileStore, type WorkspaceRegistrar } from '../src/service.ts'

interface Booted {
  storage: MedStorage
  close(): Promise<void>
}

const booted: Booted[] = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

async function openStorage(): Promise<Booted> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  const boot = {
    storage,
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  }
  booted.push(boot)
  return boot
}

/** In-memory file seam shared by both commands. */
function memoryFiles(): BackupFiles & { written: Map<string, string> } {
  const written = new Map<string, string>()
  return {
    written,
    async write(path, content) {
      written.set(path, content)
    },
    async read(path) {
      const content = written.get(path)
      if (content === undefined) throw new Error(`ENOENT: no such file '${path}'`)
      return content
    },
  }
}

/** Create one project through the real service so the store is not empty. */
async function seedProject(storage: MedStorage, name: string): Promise<string> {
  const noFiles: ProjectFileStore = { async write() {} }
  const noWorkspaces: WorkspaceRegistrar = { async create() { return { id: 'ws-1' } } }
  const service = new ProjectsService({
    storage,
    files: noFiles,
    workspaces: noWorkspaces,
    workspaceRoot: '/tmp/med-backup',
    now: () => '2026-01-01T00:00:00.000Z',
    newId: () => projectIdSchema.parse('project-1'),
  })
  const project = await service.create({ name })
  return project.id
}

describe('backup commands (SPEC §15.2, FR-21)', () => {
  it('exports a portable bundle and imports every record into an empty store', async () => {
    const source = await openStorage()
    const id = await seedProject(source.storage, 'PONV')
    const files = memoryFiles()

    const exported = await runMedExport({ storage: source.storage, files }, '/backup/med.json')
    expect(exported.kind).toBe('success')
    expect(exported.text).toContain('/backup/med.json')
    const bundle = JSON.parse(files.written.get('/backup/med.json')!) as MedExportBundle
    expect(bundle.format).toBe('medresearch.export')
    expect(bundle.domains.map(domain => domain.name)).toContain('med_project')

    const target = await openStorage()
    const imported = await runMedImport({ storage: target.storage, files }, '/backup/med.json')
    // Two records: the project and the audit row its creation appended.
    expect(imported).toEqual({
      kind: 'success',
      text: 'Imported 11 domains / 2 records from /backup/med.json',
    })
    expect(target.storage.projects.get(projectIdSchema.parse(id))).toEqual(
      source.storage.projects.get(projectIdSchema.parse(id)),
    )
    expect([...target.storage.auditLogs.entries()].map(([, row]) => row.action)).toEqual(['project.create'])
  })

  it('takes the whole trimmed input as one path', async () => {
    const source = await openStorage()
    const files = memoryFiles()
    const path = '/backup/med research 2026.json'
    const exported = await runMedExport({ storage: source.storage, files }, `  ${path}  `)
    expect(exported.kind).toBe('success')
    expect(files.written.has(path)).toBe(true)
  })

  it('requires an explicit path for both commands', async () => {
    const boot = await openStorage()
    const files = memoryFiles()
    const deps = { storage: boot.storage, files }

    expect(await runMedExport(deps, '   ')).toEqual({
      kind: 'error',
      text: `/${MED_EXPORT_COMMAND} requires a backup file path`,
    })
    expect(await runMedImport(deps, '')).toEqual({
      kind: 'error',
      text: `/${MED_IMPORT_COMMAND} requires a backup file path`,
    })
    expect(files.written.size).toBe(0)
  })

  it('reports an unreadable backup path verbatim', async () => {
    const boot = await openStorage()
    const result = await runMedImport({ storage: boot.storage, files: memoryFiles() }, '/missing.json')
    expect(result).toEqual({
      kind: 'error',
      text: `/${MED_IMPORT_COMMAND} failed: ENOENT: no such file '/missing.json'`,
    })
  })

  it('reports malformed JSON verbatim and writes nothing', async () => {
    const boot = await openStorage()
    const files = memoryFiles()
    await files.write('/broken.json', '{ not json')

    const result = await runMedImport({ storage: boot.storage, files }, '/broken.json')
    expect(result.kind).toBe('error')
    expect(result.text).toContain(`/${MED_IMPORT_COMMAND} failed:`)
    expect(emptyTables(boot.storage)).toBe(true)
  })

  it('rejects a bundle whose domain version differs and leaves the target untouched', async () => {
    const source = await openStorage()
    await seedProject(source.storage, 'PONV')
    const files = memoryFiles()
    await runMedExport({ storage: source.storage, files }, '/backup/med.json')
    const bundle = JSON.parse(files.written.get('/backup/med.json')!) as MedExportBundle
    const first = bundle.domains[0]!
    bundle.domains[0] = { ...first, version: first.version + 1 }
    await files.write('/backup/stale.json', JSON.stringify(bundle))

    const target = await openStorage()
    const result = await runMedImport({ storage: target.storage, files }, '/backup/stale.json')
    expect(result.kind).toBe('error')
    expect(result.text).toContain("domain 'med_project' is declared v1 but the bundle carries v2")
    expect(emptyTables(target.storage)).toBe(true)
  })

  it('rejects a bundle naming an undeclared domain and leaves the target untouched', async () => {
    const boot = await openStorage()
    const files = memoryFiles()
    const bundle = medExport(boot.storage)
    await files.write('/backup/unknown.json', JSON.stringify({
      ...bundle,
      domains: [...bundle.domains, { name: 'med_ghost', version: 1, tables: {} }],
    }))

    const result = await runMedImport({ storage: boot.storage, files }, '/backup/unknown.json')
    expect(result.kind).toBe('error')
    expect(result.text).toContain('med_ghost')
  })
})

/** Whether every declared table in the store is empty. */
function emptyTables(storage: MedStorage): boolean {
  return medExport(storage).domains.every(
    domain => Object.values(domain.tables).every(table => Object.keys(table).length === 0),
  )
}
