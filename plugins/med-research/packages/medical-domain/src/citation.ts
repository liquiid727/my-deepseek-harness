/**
 * Backend citation serializer (SPEC §29, FR-15). The model never writes a
 * citation number or identifier: it emits claims with `evidence_id`s, and this
 * function assigns `[n]` in first-appearance order and maps each index to
 * `evidence_id → paper_id`.
 * @module @medresearch/dsh-medical-domain/src/citation
 */

import type { Evidence, EvidenceId, PaperId } from '@medresearch/dsh-medical-contracts'

/** One claim with its serialized citation indices. */
export interface SerializedClaim {
  text: string
  /** Supporting citation indices, in first-appearance order. */
  citations: number[]
  /** Counter-evidence citation indices. */
  counterCitations: number[]
}

/** One citation index and the records it resolves to. */
export interface CitationRef {
  index: number
  evidenceId: EvidenceId
  paperId: PaperId
}

/** Serialized answer: claims plus the citation table. */
export interface SerializedAnswer {
  claims: SerializedClaim[]
  citations: CitationRef[]
}

/** Input claim shape. */
export interface ClaimToSerialize {
  text: string
  evidenceIds: readonly EvidenceId[]
  counterEvidenceIds?: readonly EvidenceId[]
}

/** Thrown when a claim names an evidence that does not exist (FR-12). */
export class CitationError extends Error {
  override readonly name = 'CitationError'

  /**
   * @param evidenceId - The unknown evidence id.
   */
  constructor(readonly evidenceId: string) {
    super(`claim cites unknown evidence ${evidenceId}`)
  }
}

/**
 * Assign citation indices to claims.
 * @param claims - Verified claims, in answer order.
 * @param evidenceById - Lookup of every evidence the claims may cite.
 * @returns the claims with indices plus the `index → evidence_id → paper_id` table.
 * @throws CitationError when a claim cites an unknown evidence.
 */
export function serializeCitations(
  claims: readonly ClaimToSerialize[],
  evidenceById: ReadonlyMap<EvidenceId, Evidence>,
): SerializedAnswer {
  const indexByEvidence = new Map<EvidenceId, number>()
  const citations: CitationRef[] = []
  const assign = (id: EvidenceId): number => {
    const existing = indexByEvidence.get(id)
    if (existing !== undefined) return existing
    const evidence = evidenceById.get(id)
    if (evidence === undefined) throw new CitationError(id)
    const index = citations.length + 1
    indexByEvidence.set(id, index)
    citations.push({ index, evidenceId: id, paperId: evidence.paperId })
    return index
  }

  return {
    claims: claims.map(claim => ({
      text: claim.text,
      citations: claim.evidenceIds.map(assign),
      counterCitations: (claim.counterEvidenceIds ?? []).map(assign),
    })),
    citations,
  }
}
