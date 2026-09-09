/**
 * Project plugin entry (SPEC §6, §32, §15.2). Wires the project service to the
 * fs and workspace capabilities, provides `ctx.medProjects`, registers the
 * `project_*` tools, and registers the `/med-export` and `/med-import` backup
 * commands where a command registry is composed.
 * @module @medresearch/dsh-plugin-project
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
// Type-only: resolves the required ctx.fs and ctx.workspaceRegistry declarations.
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-workspace'
import { projectIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import {
  MED_BACKUP_INPUT_HINT,
  MED_EXPORT_COMMAND,
  MED_EXPORT_DESCRIPTION,
  MED_IMPORT_COMMAND,
  MED_IMPORT_DESCRIPTION,
  runMedExport,
  runMedImport,
  type BackupResult,
} from './backup.ts'
import type { Config } from './config.ts'
import { ProjectsService } from './service.ts'
import { projectTools } from './tools.ts'

export { Config } from './config.ts'
export { MED_EXPORT_COMMAND, MED_IMPORT_COMMAND, runMedExport, runMedImport } from './backup.ts'
export type { BackupDeps, BackupFiles, BackupResult } from './backup.ts'

/** Cordis plugin name. */
export const name = 'med-project'
/** The service needs the fs, workspace, storage, and tool registries. */
export const inject = ['tools', 'fs', 'workspaceRegistry', 'storageDomain']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medProjects: ProjectsService
  }
}

/**
 * Human-command surface the backup path registers into. The registry is a DSH
 * Web/interactive capability, so a headless composition simply has no commands
 * service and the backup path is absent rather than broken.
 */
interface CommandRegistry {
  register(definition: {
    name: string
    description: string
    input?: { hint: string }
    handler: (invocation: { rawInput: string }) => BackupResult | Promise<BackupResult>
  }): () => void
}

/**
 * Mount the project capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.project.storage')

  const files = {
    async write(path: string, content: string) {
      const target = await ctx.fs.resolve(path)
      await ctx.fs.writeText(target, content)
    },
    async read(path: string) {
      const target = await ctx.fs.resolve(path)
      return ctx.fs.readText(target)
    },
  }
  const service = new ProjectsService({
    storage,
    files,
    workspaces: {
      async create(path, title) {
        const workspace = await ctx.workspaceRegistry.create(path, title)
        return { id: String(workspace.id) }
      },
    },
    workspaceRoot: config.workspaceRoot,
    now: () => new Date().toISOString(),
    newId: () => projectIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medProjects', service), 'med.project.service')
  for (const tool of projectTools(service)) ctx.tools.register(tool)

  // Backup and restore are human commands (SPEC §15.2); they exist only where
  // a command registry does, which is the interactive Web composition.
  const commands = ctx.get('commands') as CommandRegistry | undefined
  if (commands !== undefined) {
    const deps = { storage, files }
    for (const [command, description, run] of [
      [MED_EXPORT_COMMAND, MED_EXPORT_DESCRIPTION, runMedExport],
      [MED_IMPORT_COMMAND, MED_IMPORT_DESCRIPTION, runMedImport],
    ] as const) {
      ctx.effect(() => commands.register({
        name: command,
        description,
        input: { hint: MED_BACKUP_INPUT_HINT },
        handler: invocation => run(deps, invocation.rawInput),
      }), `med.project.command.${command}`)
    }
  }
}
