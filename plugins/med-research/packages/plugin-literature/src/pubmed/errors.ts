/**
 * Failure vocabulary of the PubMed connector (SPEC §19, §46). Codes are stable
 * so the tool layer can surface `{ code, retryable }` to the model instead of
 * a prose blob; a failed request never degrades into an empty result list.
 * @module @medresearch/dsh-plugin-literature/src/pubmed/errors
 */

/** Stable connector failure codes. */
export type PubmedErrorCode =
  | 'PUBMED_RATE_LIMIT'
  | 'PUBMED_TIMEOUT'
  | 'PUBMED_HTTP_ERROR'
  | 'PUBMED_MALFORMED_RESPONSE'

/** Thrown by the connector; `retryable` says whether a later attempt may succeed. */
export class PubmedError extends Error {
  override readonly name = 'PubmedError'

  /**
   * @param code - Stable discriminant.
   * @param message - Diagnostic detail naming the request that failed.
   * @param retryable - Whether the same request may succeed later.
   * @param details - Optional structured context (status, url).
   */
  constructor(
    readonly code: PubmedErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) {
    super(message)
  }
}
