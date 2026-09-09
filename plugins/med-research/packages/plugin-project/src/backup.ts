/**
 * Backup and restore commands (SPEC §15.2, FR-21). SPEC requires a
 * `medExport` / `medImport` command or tool as the backup and migration path;
 * these are the human-command half of it, registered as `/med-export` and
 * `/med-import`. Both act on the whole storage handle, so they live with the
 * plugin that opens the shared handle first.
 *
 * Neither command reaches the model. Their outcome is a {@link BackupResult}
 * the command registry logs as `command/run` / `command/done`, and every
 * failure — an unreadable path, malformed JSON, a rejected bundle — is
 * reported verbatim instead of being downgraded (Gate 4).
 * @module @medresearch/dsh-plugin-project/src/backup
 */

import {
  medExport,
  medImport,
  type MedExportBundle,
  type MedStorage,
} from '@medresearch/dsh-medical-storage'

/** Command name for the export half of the backup path (SPEC §15.2). */
export const MED_EXPORT_COMMAND = 'med-export'

/** Command name for the import half of the backup path (SPEC §15.2). */
export const MED_IMPORT_COMMAND = 'med-import'

/** Discovery text of {@link MED_EXPORT_COMMAND}. */
export const MED_EXPORT_DESCRIPTION = 'Write every Med Research storage domain to one JSON backup file'

/** Discovery text of {@link MED_IMPORT_COMMAND}. */
export const MED_IMPORT_DESCRIPTION = 'Validate a Med Research backup file and import every record in it'

/** Free-form input hint advertised for both commands. */
export const MED_BACKUP_INPUT_HINT = '<backup file path>'

/** File access the backup commands need; the plugin supplies `ctx.fs`. */
export interface BackupFiles {
  /**
   * Write a UTF-8 file, creating missing parent directories.
   * @param path - Absolute target path.
   * @param content - Full file content.
   */
  write(path: string, content: string): Promise<void>
  /**
   * Read a UTF-8 file.
   * @param path - Absolute source path.
   * @returns the file content.
   */
  read(path: string): Promise<string>
}

/** Dependencies of the backup commands. */
export interface BackupDeps {
  /** Open shared storage handle covering every declared domain. */
  storage: MedStorage
  /** File access owned by the mounting plugin. */
  files: BackupFiles
}

/** Outcome of one backup command; mirrors the command registry's result union. */
export type BackupResult = { kind: 'success'; text: string } | { kind: 'error'; text: string }

/** Count the records a bundle carries across every table. */
function recordCount(bundle: MedExportBundle): number {
  return bundle.domains.reduce(
    (total, domain) => total + Object.values(domain.tables).reduce((count, table) => count + Object.keys(table).length, 0),
    0,
  )
}

/** Read the one path argument a backup command requires. */
function backupPath(rawInput: string): string | undefined {
  const path = rawInput.trim()
  return path === '' ? undefined : path
}

/**
 * Write the whole store to one JSON bundle.
 *
 * The path is the entire trimmed input; a path with spaces is one argument.
 * @param deps - Storage handle and file access.
 * @param rawInput - Command input naming the backup file.
 * @returns a success naming the file and counts, or the failure verbatim.
 */
export async function runMedExport(deps: BackupDeps, rawInput: string): Promise<BackupResult> {
  const path = backupPath(rawInput)
  if (path === undefined) return { kind: 'error', text: `/${MED_EXPORT_COMMAND} requires a backup file path` }
  try {
    const bundle = medExport(deps.storage)
    await deps.files.write(path, `${JSON.stringify(bundle, null, 2)}\n`)
    return {
      kind: 'success',
      text: `Exported ${bundle.domains.length} domains / ${recordCount(bundle)} records to ${path}`,
    }
  } catch (error) {
    // Every failure here is a user-correctable path or storage fault; the
    // command contract reports it as an error result rather than throwing.
    return { kind: 'error', text: `/${MED_EXPORT_COMMAND} failed: ${messageOf(error)}` }
  }
}

/**
 * Validate a bundle file completely, then import every record it carries.
 *
 * `medImport` rejects the whole bundle before writing anything when the
 * envelope, a domain version, a table, or one record is invalid, so a failed
 * import leaves storage untouched.
 * @param deps - Storage handle and file access.
 * @param rawInput - Command input naming the backup file.
 * @returns a success naming the file and counts, or the failure verbatim.
 */
export async function runMedImport(deps: BackupDeps, rawInput: string): Promise<BackupResult> {
  const path = backupPath(rawInput)
  if (path === undefined) return { kind: 'error', text: `/${MED_IMPORT_COMMAND} requires a backup file path` }
  try {
    const bundle = JSON.parse(await deps.files.read(path)) as MedExportBundle
    const report = await medImport(deps.storage, bundle)
    return {
      kind: 'success',
      text: `Imported ${report.domains} domains / ${report.records} records from ${path}`,
    }
  } catch (error) {
    return { kind: 'error', text: `/${MED_IMPORT_COMMAND} failed: ${messageOf(error)}` }
  }
}

/** Render any thrown value as the one-line diagnostic a command result carries. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
