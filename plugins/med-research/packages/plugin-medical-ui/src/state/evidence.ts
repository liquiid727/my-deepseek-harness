/**
 * Evidence display state (SPEC §44). Derived from the stored evidence, never
 * supplied by the model; `PARTIAL` must be shown as "located but not exact".
 * @module @medresearch/dsh-plugin-medical-ui/src/state/evidence
 */

import type { Evidence } from '@medresearch/dsh-medical-contracts'

/** Every Evidence display state (SPEC §44). */
export type EvidenceUiState =
  | 'FULLTEXT_FOUND' | 'FULLTEXT_PARTIAL' | 'ABSTRACT_FOUND' | 'ABSTRACT_PARTIAL'
  | 'SECONDARY' | 'NOT_FOUND' | 'REJECTED'

/**
 * Derive the display state of one evidence.
 * @param evidence - Stored evidence (locator, support, and source class).
 * @returns the display state.
 */
export function evidenceUiState(
  evidence: Pick<Evidence, 'sourceType' | 'locatorStatus' | 'supportStatus'>,
): EvidenceUiState {
  if (evidence.locatorStatus === 'NOT_FOUND') return 'NOT_FOUND'
  if (evidence.supportStatus === 'REJECTED') return 'REJECTED'
  if (evidence.sourceType === 'secondary_citation') return 'SECONDARY'
  const prefix = evidence.sourceType === 'abstract' ? 'ABSTRACT' : 'FULLTEXT'
  return evidence.locatorStatus === 'FOUND' ? `${prefix}_FOUND` : `${prefix}_PARTIAL`
}
