/**
 * Backup and migration path for business data (SPEC §15.2, FR-21). Export
 * snapshots every declared table; import validates the whole bundle — format,
 * domain versions, table names, and every record — before writing anything, so
 * a rejected import leaves storage untouched. A domain whose stored version
 * differs from the declaration is never silently accepted.
 * @module @medresearch/dsh-medical-storage/src/export-import
 */

import type { DomainSpec } from '@deepseek-ai/dsh-storage-domain'
import { medDomainByName, medDomains } from './domains.ts'
import type { MedStorage, OpenedDomain } from './repository.ts'

/** Discriminant of an export bundle. */
export const MED_EXPORT_FORMAT = 'medresearch.export'

/** Format version of the bundle envelope itself; independent of domain versions. */
export const MED_EXPORT_FORMAT_VERSION = 1

/** One domain's records, keyed by table then record key. */
export interface MedDomainExport {
  name: string
  version: number
  tables: Record<string, Record<string, unknown>>
}

/** Portable snapshot of all business data. */
export interface MedExportBundle {
  format: typeof MED_EXPORT_FORMAT
  formatVersion: number
  exportedAt: string
  domains: MedDomainExport[]
}

/** Counts written by one successful import. */
export interface MedImportReport {
  domains: number
  records: number
}

/** Stable failure codes of the storage library. */
export type MedStorageErrorCode =
  | 'BUNDLE_INVALID'
  | 'DOMAIN_NOT_FOUND'
  | 'DOMAIN_VERSION_MISMATCH'
  | 'TABLE_NOT_FOUND'
  | 'RECORD_INVALID'

/** Thrown when a bundle cannot be exported or imported as declared. */
export class MedStorageError extends Error {
  override readonly name = 'MedStorageError'

  /**
   * @param code - Stable discriminant for the failure class.
   * @param message - Diagnostic detail naming the offending domain, table, or key.
   * @param details - Optional structured context for the caller.
   */
  constructor(
    readonly code: MedStorageErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

/**
 * Snapshot every declared table into a portable bundle.
 * @param storage - Open storage handle.
 * @returns the bundle, stamped with the export time.
 * @throws MedStorageError when a declared domain is not open.
 */
export function medExport(storage: MedStorage): MedExportBundle {
  const domains: MedDomainExport[] = []
  for (const spec of medDomains) {
    const view = storage.opened.get(spec.name)
    if (view === undefined) {
      throw new MedStorageError('DOMAIN_NOT_FOUND', `domain '${spec.name}' is declared but not open`)
    }
    const tables: Record<string, Record<string, unknown>> = {}
    for (const table of view.tables) {
      tables[table] = Object.fromEntries(view.snapshot(table))
    }
    domains.push({ name: spec.name, version: spec.version, tables })
  }
  return {
    format: MED_EXPORT_FORMAT,
    formatVersion: MED_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    domains,
  }
}

/** Validate one domain section and return the declaration it targets. */
function validatedSpec(entry: MedDomainExport): DomainSpec {
  const spec = medDomainByName(entry.name)
  if (spec === undefined) {
    throw new MedStorageError('DOMAIN_NOT_FOUND', `bundle names undeclared domain '${entry.name}'`)
  }
  if (entry.version !== spec.version) {
    throw new MedStorageError(
      'DOMAIN_VERSION_MISMATCH',
      `domain '${entry.name}' is declared v${spec.version} but the bundle carries v${entry.version}`,
      { declared: spec.version, bundled: entry.version },
    )
  }
  return spec
}

/**
 * Import a bundle produced by {@link medExport}.
 *
 * The full bundle is validated before the first write: envelope format, domain
 * versions, table names, and every record against its declared schema. On any
 * failure nothing is written.
 * @param storage - Open storage handle.
 * @param bundle - Bundle to import.
 * @returns counts of domains and records written.
 * @throws MedStorageError for every rejection class it documents.
 */
export async function medImport(storage: MedStorage, bundle: MedExportBundle): Promise<MedImportReport> {
  if (bundle === null || typeof bundle !== 'object'
    || bundle.format !== MED_EXPORT_FORMAT
    || bundle.formatVersion !== MED_EXPORT_FORMAT_VERSION
    || !Array.isArray(bundle.domains)) {
    throw new MedStorageError(
      'BUNDLE_INVALID',
      `bundle must be format '${MED_EXPORT_FORMAT}' version ${MED_EXPORT_FORMAT_VERSION}`,
    )
  }

  const validated: Array<{ view: OpenedDomain; table: string; key: string; record: unknown }> = []
  for (const entry of bundle.domains) {
    const spec = validatedSpec(entry)
    const view = storage.opened.get(spec.name)
    if (view === undefined) {
      throw new MedStorageError('DOMAIN_NOT_FOUND', `domain '${spec.name}' is declared but not open`)
    }
    for (const [table, records] of Object.entries(entry.tables)) {
      const tableSpec = spec.tables[table]
      if (tableSpec === undefined) {
        throw new MedStorageError('TABLE_NOT_FOUND', `domain '${spec.name}' has no table '${table}'`)
      }
      for (const [key, record] of Object.entries(records)) {
        const parsed = tableSpec.valueSchema.safeParse(record)
        if (!parsed.success) {
          throw new MedStorageError(
            'RECORD_INVALID',
            `record '${key}' in '${spec.name}.${table}' fails its schema`,
            parsed.error.issues,
          )
        }
        validated.push({ view, table, key, record: parsed.data })
      }
    }
  }

  for (const { view, table, key, record } of validated) {
    await view.put(table, key, record)
  }
  return { domains: bundle.domains.length, records: validated.length }
}
