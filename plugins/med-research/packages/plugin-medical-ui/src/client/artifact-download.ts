/**
 * Artifact download URL (SPEC §30, §38). Artifact bytes cannot ride the JSON
 * Remote envelope, so the browser downloads them from the authenticated exact
 * Fetch route the artifact plugin registers.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/artifact-download
 */

import {
  MED_ARTIFACT_EXPORT_PATH,
  MED_ARTIFACT_FORMATS,
  type MedArtifactFormat,
} from '@medresearch/dsh-medical-contracts/src/routes.ts'

/**
 * Build the download URL for one artifact export.
 * @param id - artifact identity.
 * @param format - export format the route accepts.
 * @returns the same-origin URL.
 */
export function artifactExportUrl(id: string, format: string): string {
  const normalized = (MED_ARTIFACT_FORMATS as readonly string[]).includes(format)
    ? format as MedArtifactFormat
    : 'json'
  return `${MED_ARTIFACT_EXPORT_PATH}?id=${encodeURIComponent(id)}&format=${encodeURIComponent(normalized)}`
}
