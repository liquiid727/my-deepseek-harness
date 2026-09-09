/**
 * Paper plugin configuration.
 * @module @medresearch/dsh-plugin-paper/src/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin configuration. */
export interface Config {
  /** Cap on paragraphs returned by `paper_search_content`. */
  maxSearchResults?: number
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  maxSearchResults: z.number().step(1).min(1).default(50),
})
