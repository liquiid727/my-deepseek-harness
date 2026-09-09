/**
 * Artifact download URL (SPEC §30, §38). The card links the browser at the
 * authenticated route, so the path and the accepted formats are pinned here.
 */

import { describe, expect, it } from 'vitest'
import { MED_ARTIFACT_EXPORT_PATH } from '@medresearch/dsh-medical-contracts'
import { artifactExportUrl } from '../src/client/artifact-download.ts'

describe('artifact export URL (SPEC §30)', () => {
  it('targets the shared route with the artifact id and format', () => {
    expect(artifactExportUrl('artifact-1', 'png'))
      .toBe(`${MED_ARTIFACT_EXPORT_PATH}?id=artifact-1&format=png`)
  })

  it('encodes the id and falls back to json for an unknown format', () => {
    expect(artifactExportUrl('a b/c', 'pdf'))
      .toBe(`${MED_ARTIFACT_EXPORT_PATH}?id=a%20b%2Fc&format=json`)
  })
})
