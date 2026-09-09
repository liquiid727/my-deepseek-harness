/**
 * Exact Fetch routes the Med Research Web surface owns (SPEC §30, §38). A
 * binary response cannot ride the JSON Remote envelope, so artifact bytes are
 * served over a dedicated authenticated route; host and client share this
 * constant so the path cannot drift.
 * @module @medresearch/dsh-medical-contracts/src/routes
 */

/** Authenticated download route for one artifact's bytes. */
export const MED_ARTIFACT_EXPORT_PATH = '/api/medArtifact.export'

/** Formats `medArtifacts/export` accepts (SPEC §38). */
export const MED_ARTIFACT_FORMATS = ['png', 'svg', 'csv', 'json'] as const

/** One export format. */
export type MedArtifactFormat = (typeof MED_ARTIFACT_FORMATS)[number]

/** Media type of each export format. */
export const MED_ARTIFACT_CONTENT_TYPES: Record<MedArtifactFormat, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  json: 'application/json',
}
