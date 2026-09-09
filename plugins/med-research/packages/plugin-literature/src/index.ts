/**
 * Literature plugin entry (SPEC §6, §19). Mounts the PubMed connector over
 * `ctx.web.fetch`, opens the Med Research storage domains, provides
 * `ctx.medLiterature`, and registers the `literature_*` tools.
 * @module @medresearch/dsh-plugin-literature
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
// Type-only: resolves the required ctx.web service declaration.
import type {} from '@deepseek-ai/dsh-web'
import { paperIdSchema, researchQueryIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { resolveLiteratureConfig } from './config.ts'
import type { Config } from './config.ts'
import { PubmedConnector } from './pubmed/connector.ts'
import { LiteratureService } from './service.ts'
import { literatureTools } from './tools.ts'

export { Config } from './config.ts'
export { PubmedConnector, buildPubmedTerm, type PubmedConnectorOptions, type PubmedSearchResult } from './pubmed/connector.ts'
export { LiteratureService } from './service.ts'

/** Cordis plugin name. */
export const name = 'med-literature'
/** The connector needs the web seam; storage carries papers and query plans; tools registers the tools. */
export const inject = ['tools', 'web', 'storageDomain']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medLiterature: LiteratureService
  }
}

/**
 * Mount the literature capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 * @throws Error when `apiKeyEnv` names a variable that is not set.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const resolved = resolveLiteratureConfig(config, key => process.env[key])
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.literature.storage')

  const connector = new PubmedConnector(async (url, signal) => {
    const response = await ctx.web.fetch({ url }, signal)
    return { status: response.statusCode, body: response.body.content }
  }, resolved.pubmed)

  const service = new LiteratureService({
    connector,
    storage,
    defaultMaxResults: resolved.defaultMaxResults,
    now: () => new Date().toISOString(),
    newPaperId: () => paperIdSchema.parse(randomUUID()),
    newResearchQueryId: () => researchQueryIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medLiterature', service), 'med.literature.service')
  for (const tool of literatureTools(service)) ctx.tools.register(tool)
}
