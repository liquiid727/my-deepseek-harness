/**
 * Full-text plugin entry (SPEC §21). Provides `ctx.medFulltext` over
 * `ctx.web.fetch`. Registers no tool: `paper_resolve_fulltext` is the
 * model-facing surface, and it calls this service.
 * @module @medresearch/dsh-plugin-fulltext
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: resolves the required ctx.web service declaration.
import type {} from '@deepseek-ai/dsh-web'
import type { Config } from './config.ts'
import { FulltextResolver } from './resolver.ts'

export { Config } from './config.ts'

/** Cordis plugin name. */
export const name = 'med-fulltext'
/** Resolution needs the web seam. */
export const inject = ['web']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medFulltext: FulltextResolver
  }
}

/**
 * Mount the full-text resolver.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as Required<Config>
  const resolver = new FulltextResolver({
    europePmcBaseUrl: resolved.europePmcBaseUrl,
    async fetchText(url, signal) {
      const response = await ctx.web.fetch({ url }, signal)
      return { status: response.statusCode, body: response.body.content }
    },
  })
  ctx.effect(() => ctx.provide('medFulltext', resolver), 'med.fulltext.service')
}
