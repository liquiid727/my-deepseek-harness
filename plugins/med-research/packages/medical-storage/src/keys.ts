/**
 * Composite key builders for the link tables. Link rows have no identity of
 * their own, so the key is the pair encoded with a separator that cannot occur
 * in a branded id (`|`); the record still carries both ids, which keeps the
 * row self-describing when read back.
 * @module @medresearch/dsh-medical-storage/src/keys
 */

import type { ClaimId, DatasetId, EvidenceId, PaperId, ProjectId } from '@medresearch/dsh-medical-contracts'

/**
 * Key of one `med_paper_sources` row.
 * @param paperId - Owning paper.
 * @param source - Connector name.
 * @param sourceId - Connector-assigned record id.
 * @returns the composite key.
 */
export function paperSourceKey(paperId: PaperId, source: string, sourceId: string): string {
  return `${paperId}|${source}|${sourceId}`
}

/**
 * Key of one `med_project_papers` row.
 * @param projectId - Owning project.
 * @param paperId - Saved paper.
 * @returns the composite key.
 */
export function projectPaperKey(projectId: ProjectId, paperId: PaperId): string {
  return `${projectId}|${paperId}`
}

/**
 * Key of one `med_claim_evidences` row.
 * @param claimId - Owning claim.
 * @param evidenceId - Bound evidence.
 * @returns the composite key.
 */
export function claimEvidenceKey(claimId: ClaimId, evidenceId: EvidenceId): string {
  return `${claimId}|${evidenceId}`
}

/**
 * Key of one `med_dataset_columns` row.
 * @param datasetId - Owning dataset.
 * @param columnName - Column name as it appears in the file.
 * @returns the composite key.
 */
export function datasetColumnKey(datasetId: DatasetId, columnName: string): string {
  return `${datasetId}|${columnName}`
}
