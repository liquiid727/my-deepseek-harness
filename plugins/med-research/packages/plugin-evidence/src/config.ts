/**
 * Evidence plugin configuration. Alignment tolerance and window size are the
 * SPEC §13.3 knobs; retrieval cap bounds one `evidence_retrieve` call.
 * @module @medresearch/dsh-plugin-evidence/src/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin configuration. */
export interface Config {
  /** Maximum edit distance divided by window length, in `[0, 1]`. */
  tolerance?: number
  /** Maximum difference between candidate window length and quote length. */
  windowSize?: number
  /** Maximum retrieval units returned by one call. */
  maxRetrieval?: number
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  tolerance: z.number().min(0).max(1).default(0.05),
  windowSize: z.number().step(1).min(0).max(64).default(8),
  maxRetrieval: z.number().step(1).min(1).max(200).default(10),
})
