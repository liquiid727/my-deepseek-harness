/**
 * Evidence plugin entry (SPEC §6, §24–§26). Provides `ctx.medEvidence` and
 * registers the `evidence_*` tools.
 * @module @medresearch/dsh-plugin-evidence
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { evidenceIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import type { Config } from './config.ts'
import { EvidenceService } from './service.ts'
import { evidenceTools } from './tools.ts'

export { Config } from './config.ts'
export { EvidenceError, EvidenceService } from './service.ts'

/** Cordis plugin name. */
export const name = 'med-evidence'
/** Storage carries evidence records; tools registers the tools. */
export const inject = ['tools', 'storageDomain']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medEvidence: EvidenceService
  }
}

/**
 * Mount the evidence capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.evidence.storage')
  const resolved = config as Required<Config>
  const service = new EvidenceService({
    storage,
    alignment: { tolerance: resolved.tolerance, windowSize: resolved.windowSize },
    maxRetrieval: resolved.maxRetrieval,
    now: () => new Date().toISOString(),
    newEvidenceId: () => evidenceIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medEvidence', service), 'med.evidence.service')
  for (const tool of evidenceTools(service)) ctx.tools.register(tool)
}
