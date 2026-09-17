/**
 * Papers-view focus identity (SPEC §42.3). The Evidence view encodes a citation
 * target and the Papers view decodes it, so the round trip and the rejection of
 * malformed strings are pinned here.
 */

import { describe, expect, it } from 'vitest'
import { decodeClaimFocus, decodePaperFocus, encodeClaimFocus, encodePaperFocus } from '../src/client/focus.ts'

describe('paper focus identity (SPEC §42.3)', () => {
  it('round-trips a full span and a paper-only focus', () => {
    const span = {
      paperId: 'paper-1' as never,
      documentId: 'document-1' as never,
      paragraphId: 'paragraph-1' as never,
      startOffset: 12,
      endOffset: 34,
    }
    expect(decodePaperFocus(encodePaperFocus(span))).toEqual(span)
    expect(decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })))
      .toEqual({ paperId: 'paper-1' })
  })

  it('rejects a focus without a paper id or with a malformed offset', () => {
    expect(decodePaperFocus('')).toBeUndefined()
    expect(decodePaperFocus('paper-1')).toBeUndefined()
    expect(decodePaperFocus('paper-1|document-1|paragraph-1|nope|34')).toBeUndefined()
    expect(decodePaperFocus('paper-1|document-1|paragraph-1|34|12')).toBeUndefined()
    expect(decodePaperFocus('|document-1|paragraph-1|1|2')).toBeUndefined()
  })
})

describe('claim focus identity (Evidence section)', () => {
  it('round-trips a claim and the section-only form', () => {
    expect(decodeClaimFocus(encodeClaimFocus('claim-1' as never))).toEqual({ claimId: 'claim-1' })
    expect(decodeClaimFocus(encodeClaimFocus())).toEqual({})
  })

  it('leaves a research question and a paper focus alone', () => {
    expect(decodeClaimFocus('PONV risk factors')).toBeUndefined()
    expect(decodeClaimFocus(encodePaperFocus({ paperId: 'paper-1' as never }))).toBeUndefined()
  })
})
