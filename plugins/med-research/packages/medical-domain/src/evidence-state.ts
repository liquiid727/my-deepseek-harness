/**
 * Evidence status machine (SPEC §11, §13.3, §25). Locator status is a
 * deterministic fact about the stored quote; support status is a semantic
 * judgement. The two are stored separately, and the hard constraints are
 * enforced here so every write path shares one rule:
 *
 * - `supportStatus = VERIFIED` requires `locatorStatus ∈ {FOUND, PARTIAL}`.
 * - `locatorStatus = NOT_FOUND` requires `supportStatus = REJECTED`.
 * @module @medresearch/dsh-medical-domain/src/evidence-state
 */

import type { Evidence, LocatorStatus, SupportStatus } from '@medresearch/dsh-medical-contracts'

/** Stable code carried by {@link EvidenceStatusViolation}. */
export const EVIDENCE_STATUS_VIOLATION = 'EVIDENCE_STATUS_VIOLATION'

/** Thrown when a locator/support pair breaks the SPEC §11 hard constraints. */
export class EvidenceStatusViolation extends Error {
  override readonly name = 'EvidenceStatusViolation'
  /** Stable discriminant for callers that must classify the failure. */
  readonly code = EVIDENCE_STATUS_VIOLATION

  /**
   * @param locatorStatus - Locator status of the rejected pair.
   * @param supportStatus - Support status of the rejected pair.
   */
  constructor(
    readonly locatorStatus: LocatorStatus,
    readonly supportStatus: SupportStatus,
  ) {
    super(
      `evidence status pair locatorStatus=${locatorStatus} / supportStatus=${supportStatus} `
      + 'violates SPEC §11: VERIFIED requires FOUND or PARTIAL, and NOT_FOUND requires REJECTED',
    )
  }
}

/**
 * Report whether a locator/support pair is legal.
 * @param locatorStatus - Deterministic locator outcome.
 * @param supportStatus - Semantic support outcome.
 * @returns true when the pair satisfies the hard constraints.
 */
export function isValidEvidenceStatusPair(locatorStatus: LocatorStatus, supportStatus: SupportStatus): boolean {
  switch (locatorStatus) {
    case 'NOT_FOUND':
      return supportStatus === 'REJECTED'
    case 'FOUND':
    case 'PARTIAL':
      return true
  }
}

/**
 * Reject an illegal locator/support pair loudly.
 * @param locatorStatus - Deterministic locator outcome.
 * @param supportStatus - Semantic support outcome.
 * @throws EvidenceStatusViolation when the pair breaks the hard constraints.
 */
export function assertEvidenceStatusPair(locatorStatus: LocatorStatus, supportStatus: SupportStatus): void {
  if (!isValidEvidenceStatusPair(locatorStatus, supportStatus)) {
    throw new EvidenceStatusViolation(locatorStatus, supportStatus)
  }
}

/**
 * Apply the persistence rule to a requested support status. A `NOT_FOUND`
 * locator always resolves to `REJECTED`; otherwise the requested status
 * stands. The returned pair is always legal.
 * @param locatorStatus - Deterministic locator outcome.
 * @param requested - Support status requested by the verifier.
 * @returns the support status to persist.
 */
export function applyLocatorResult(locatorStatus: LocatorStatus, requested: SupportStatus): SupportStatus {
  switch (locatorStatus) {
    case 'NOT_FOUND':
      return 'REJECTED'
    case 'FOUND':
    case 'PARTIAL':
      switch (requested) {
        case 'PENDING':
        case 'VERIFIED':
        case 'REJECTED':
          return requested
      }
  }
}

/** Stable reason prefixes explaining why an evidence is not qualified. */
export const EVIDENCE_QUALIFICATION_REASONS = {
  /** The record was withdrawn by the user (interfaces.md §Reader, Note and Evidence). */
  withdrawn: 'EVIDENCE_WITHDRAWN',
  /** `sourceType = secondary_citation`; a secondary record never supports a claim directly. */
  secondary: 'EVIDENCE_SECONDARY',
  /** The locator failed; `NOT_FOUND` can never qualify. */
  notLocated: 'EVIDENCE_NOT_LOCATED',
  /** A `PARTIAL` locator carries no exact matched span, so it degrades to `NOT_FOUND`. */
  partialWithoutAnchor: 'EVIDENCE_PARTIAL_WITHOUT_ANCHOR',
  /** The semantic verdict is not `VERIFIED`. */
  notVerified: 'EVIDENCE_NOT_VERIFIED',
  /** The relation is the `UNCERTAIN` placeholder, which never supports a claim. */
  uncertain: 'EVIDENCE_RELATION_UNCERTAIN',
} as const

/** Reason prefix carried by {@link EVIDENCE_QUALIFICATION_REASONS}. */
export type EvidenceQualificationReason =
  (typeof EVIDENCE_QUALIFICATION_REASONS)[keyof typeof EVIDENCE_QUALIFICATION_REASONS]

/**
 * Decide whether one evidence may support a claim (interfaces.md §Reader, Note
 * and Evidence): it must be un-withdrawn, readable, located (`FOUND` or a
 * `PARTIAL` with exact matched anchors), semantically `VERIFIED`, carry a
 * directional `SUPPORT`/`AGAINST` relation, and not be a secondary citation.
 *
 * This is the single qualification rule; the claim gate, the writing service,
 * and the UI projections all read it instead of restating it.
 * @param evidence - Stored evidence record.
 * @returns the qualification reasons; empty means qualified.
 */
export function evidenceQualificationReasons(evidence: Evidence): EvidenceQualificationReason[] {
  const reasons: EvidenceQualificationReason[] = []
  if (evidence.withdrawnAt !== undefined) reasons.push(EVIDENCE_QUALIFICATION_REASONS.withdrawn)
  if (evidence.sourceType === 'secondary_citation') reasons.push(EVIDENCE_QUALIFICATION_REASONS.secondary)
  if (evidence.locatorStatus === 'NOT_FOUND') reasons.push(EVIDENCE_QUALIFICATION_REASONS.notLocated)
  if (evidence.locatorStatus === 'PARTIAL' && (evidence.matchedAnchors ?? []).length === 0) {
    reasons.push(EVIDENCE_QUALIFICATION_REASONS.partialWithoutAnchor)
  }
  if (evidence.supportStatus !== 'VERIFIED') reasons.push(EVIDENCE_QUALIFICATION_REASONS.notVerified)
  if (evidence.relation === 'UNCERTAIN') reasons.push(EVIDENCE_QUALIFICATION_REASONS.uncertain)
  return reasons
}

/**
 * Report whether one evidence may support a claim.
 * @param evidence - Stored evidence record.
 * @returns true when no qualification reason applies.
 */
export function isQualifiedEvidence(evidence: Evidence): boolean {
  return evidenceQualificationReasons(evidence).length === 0
}
