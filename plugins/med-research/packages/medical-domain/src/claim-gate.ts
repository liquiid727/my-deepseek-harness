/**
 * Citation Gate (SPEC §28, FR-12/FR-13/FR-14). A claim enters the final
 * research answer only when every bound evidence exists, is `VERIFIED`, is
 * locatable, belongs to an existing paper, and still relocates in its source
 * paragraph; and when at least one such supporting evidence exists. Failures
 * are returned as stable reason strings, never as a silent downgrade.
 * @module @medresearch/dsh-medical-domain/src/claim-gate
 */

import type {
  Claim,
  ClaimId,
  Evidence,
  EvidenceId,
  Paper,
  PaperId,
} from '@medresearch/dsh-medical-contracts'

/** Stable reason prefixes emitted by {@link verifyClaim}. */
export const CLAIM_REASONS = {
  /** The claim binds an `evidence_id` that does not exist (FR-12). */
  missingEvidence: 'MISSING_EVIDENCE',
  /** The evidence exists but is not `VERIFIED`. */
  notVerified: 'EVIDENCE_NOT_VERIFIED',
  /** The evidence is not `FOUND`/`PARTIAL`. */
  notLocated: 'EVIDENCE_NOT_LOCATED',
  /** The evidence's paper does not exist. */
  missingPaper: 'MISSING_PAPER',
  /** The stored quote no longer relocates in its paragraph (SPEC §22.3). */
  notRelocatable: 'QUOTE_NOT_RELOCATABLE',
  /** No supporting evidence satisfies every Gate-2 check (FR-13/FR-14). */
  noSupport: 'NO_SUPPORTING_EVIDENCE',
} as const

/** Outcome of the Citation Gate for one claim (SPEC §28). */
export interface ClaimVerificationResult {
  claimId: ClaimId
  passed: boolean
  /** Empty when `passed`; otherwise the ordered, stable failure reasons. */
  reasons: string[]
}

/** Inputs the gate needs; all records are looked up by the caller. */
export interface ClaimGateInput {
  claim: Claim
  evidence: ReadonlyMap<EvidenceId, Evidence>
  papers: ReadonlyMap<PaperId, Paper>
  /**
   * Re-locate the evidence quote in its source paragraph, returning false when
   * it no longer matches under the configured alignment tolerance.
   */
  relocate: (evidence: Evidence) => boolean
}

/**
 * Run the Citation Gate over one claim.
 * @param input - Claim, evidence and paper lookups, and the relocation check.
 * @returns the gate outcome with every failure reason it found.
 */
export function verifyClaim(input: ClaimGateInput): ClaimVerificationResult {
  const reasons: string[] = []
  let supportPassed = 0

  const check = (id: EvidenceId): boolean => {
    const evidence = input.evidence.get(id)
    if (evidence === undefined) {
      reasons.push(`${CLAIM_REASONS.missingEvidence}:${id}`)
      return false
    }
    let ok = true
    if (evidence.supportStatus !== 'VERIFIED') {
      reasons.push(`${CLAIM_REASONS.notVerified}:${id}`)
      ok = false
    }
    if (evidence.locatorStatus !== 'FOUND' && evidence.locatorStatus !== 'PARTIAL') {
      reasons.push(`${CLAIM_REASONS.notLocated}:${id}`)
      ok = false
    }
    if (!input.papers.has(evidence.paperId)) {
      reasons.push(`${CLAIM_REASONS.missingPaper}:${evidence.paperId}`)
      ok = false
    }
    if (ok && !input.relocate(evidence)) {
      reasons.push(`${CLAIM_REASONS.notRelocatable}:${id}`)
      ok = false
    }
    return ok
  }

  for (const id of input.claim.evidenceIds) {
    if (check(id)) supportPassed += 1
  }
  for (const id of input.claim.counterEvidenceIds) {
    check(id)
  }

  if (supportPassed === 0) reasons.push(CLAIM_REASONS.noSupport)
  return { claimId: input.claim.id, passed: reasons.length === 0, reasons }
}
