/**
 * Runner plugin entry. Provides `ctx.medRunner` (the {@link StatisticsRunner}
 * seam). The declared isolation level is reported to the caller so the UI can
 * label it honestly (SPEC §36, §65.1).
 * @module @medresearch/dsh-medical-runner-container
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { RestrictedProcessRunner, type IsolationLevel } from './process-runner.ts'

export { RestrictedProcessRunner } from './process-runner.ts'
export type { IsolationLevel, ProcessRunnerOptions } from './process-runner.ts'
export { disallowedImports, importedModules } from './allowlist.ts'

/** Cordis plugin name. */
export const name = 'med-runner-container'

/** Raw plugin configuration. */
export interface Config {
  /** Python interpreter used for analysis code. */
  pythonPath?: string
  /** Declared isolation strength of this provider. */
  isolationLevel?: IsolationLevel
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  pythonPath: z.string().default('python3'),
  isolationLevel: z.union(['restricted-process', 'container'] as const).default('restricted-process'),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    medRunner: RestrictedProcessRunner
  }
}

/**
 * Mount the statistics runner.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 * @throws Error when `container` isolation is requested: this provider runs a
 * restricted subprocess only, and silently accepting the label would downgrade
 * the deployment's declared isolation (SPEC §36).
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as Required<Config>
  if (resolved.isolationLevel === 'container') {
    throw new Error(
      'med-runner-container: isolationLevel "container" is not implemented by this provider; '
      + 'it runs a restricted subprocess. Compose a container provider, or set isolationLevel '
      + '"restricted-process" to accept that weaker isolation explicitly.',
    )
  }
  const runner = new RestrictedProcessRunner({
    pythonPath: resolved.pythonPath,
    isolationLevel: resolved.isolationLevel,
  })
  ctx.effect(() => ctx.provide('medRunner', runner), 'med.runner.service')
}
