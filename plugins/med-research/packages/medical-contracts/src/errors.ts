/**
 * Error model shared by every Med Research surface (SPEC §46). `code` is the
 * stable discriminant callers switch on; `message` is diagnostic prose.
 * `partialDataAvailable` tells a UI whether the failure still has usable
 * partial results — it never licenses inventing the missing ones.
 * @module @medresearch/dsh-medical-contracts/src/errors
 */

import { z } from 'zod'

/** Every stable error code in V1 (SPEC §46). */
export const DOMAIN_ERROR_CODES = [
  'PUBMED_RATE_LIMIT',
  'PUBMED_TIMEOUT',
  'PUBMED_HTTP_ERROR',
  'PUBMED_MALFORMED_RESPONSE',
  'PROJECT_NOT_FOUND',
  'PROJECT_NOT_BOUND',
  'PAPER_NOT_FOUND',
  'FULLTEXT_NOT_AVAILABLE',
  'FULLTEXT_LICENSE_BLOCKED',
  'PDF_PARSE_PARTIAL',
  'PDF_PARSE_FAILED',
  'EVIDENCE_NOT_FOUND',
  'PARAGRAPH_NOT_FOUND',
  'EVIDENCE_QUOTE_MISMATCH',
  'CLAIM_UNSUPPORTED',
  'DATASET_PARSE_FAILED',
  'DATASET_TOO_LARGE',
  'DATASET_NOT_FOUND',
  'STATISTICS_PLAN_INVALID',
  'CODE_EXECUTION_TIMEOUT',
  'CODE_EXECUTION_FAILED',
  'BUDGET_EXCEEDED',
  'DOMAIN_VERSION_MISMATCH',
  'ARTIFACT_NOT_FOUND',
  'ARTIFACT_RUN_NOT_SUCCEEDED',
] as const

/** Stable error code carried by a {@link DomainError}. */
export const domainErrorCodeSchema = z.enum(DOMAIN_ERROR_CODES)
/** Stable error code carried by a {@link DomainError}. */
export type DomainErrorCode = z.infer<typeof domainErrorCodeSchema>

/** Machine-readable failure returned across tool and RPC boundaries (SPEC §46). */
export const domainErrorSchema = z.strictObject({
  code: domainErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  /** True when a caller may still use partial results; the missing part stays missing. */
  partialDataAvailable: z.boolean(),
  source: z.string().optional(),
  details: z.unknown().optional(),
})
/** Machine-readable failure returned across tool and RPC boundaries (SPEC §46). */
export type DomainError = z.infer<typeof domainErrorSchema>
