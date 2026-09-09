/**
 * Full-text resolver configuration.
 * @module @medresearch/dsh-plugin-fulltext/src/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin configuration. */
export interface Config {
  /** Europe PMC REST base, without a trailing slash. */
  europePmcBaseUrl?: string
  /** Request deadline in milliseconds. */
  timeoutMs?: number
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  europePmcBaseUrl: z.string().default('https://www.ebi.ac.uk/europepmc/webservices/rest'),
  timeoutMs: z.number().step(1).min(1).default(30_000),
})
