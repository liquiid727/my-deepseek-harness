/**
 * Target-owned focus identity for the Papers view (SPEC §42.3: `openView`
 * carries an opaque focus the addressed view owns). The Evidence view encodes
 * one from a stored evidence record so a citation opens the exact paragraph
 * span; the Papers view decodes it and highlights that span.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/focus
 */

import type { ClaimId, DocumentId, PaperId, ParagraphId } from '@medresearch/dsh-medical-contracts'

/** Where one citation points inside a paper. */
export interface PaperFocus {
  /** Paper to open. */
  readonly paperId: PaperId
  /** Document holding the span; absent opens the paper without a body location. */
  readonly documentId?: DocumentId
  /** Paragraph holding the span. */
  readonly paragraphId?: ParagraphId
  /** Start offset into the paragraph's normalized text. */
  readonly startOffset?: number
  /** End offset (exclusive) into the paragraph's normalized text. */
  readonly endOffset?: number
}

/** Segment separator; ids and offsets never contain it. */
const SEPARATOR = '|'

/** Every segment in wire order: paper, document, paragraph, start, end. */
const SEGMENTS = 5

/**
 * Encode one focus identity.
 * @param focus - the paper and optional span.
 * @returns the opaque focus string `openView` carries.
 */
export function encodePaperFocus(focus: PaperFocus): string {
  return [
    focus.paperId,
    focus.documentId ?? '',
    focus.paragraphId ?? '',
    focus.startOffset === undefined ? '' : String(focus.startOffset),
    focus.endOffset === undefined ? '' : String(focus.endOffset),
  ].join(SEPARATOR)
}

/** Parse one non-negative integer segment. */
function offsetOf(value: string): number | undefined | null {
  if (value === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Decode one focus identity.
 * @param value - the opaque focus string from `viewRequest`.
 * @returns the parsed focus, or undefined when the string is not a paper focus.
 */
export function decodePaperFocus(value: string): PaperFocus | undefined {
  const parts = value.split(SEPARATOR)
  if (parts.length !== SEGMENTS) return undefined
  const [paperId, documentId = '', paragraphId = '', start = '', end = ''] = parts
  if (paperId === undefined || paperId === '') return undefined
  const startOffset = offsetOf(start)
  const endOffset = offsetOf(end)
  if (startOffset === null || endOffset === null) return undefined
  if (startOffset !== undefined && endOffset !== undefined && endOffset < startOffset) return undefined
  return {
    paperId: paperId as PaperId,
    ...documentId === '' ? {} : { documentId: documentId as DocumentId },
    ...paragraphId === '' ? {} : { paragraphId: paragraphId as ParagraphId },
    ...startOffset === undefined ? {} : { startOffset },
    ...endOffset === undefined ? {} : { endOffset },
  }
}

/**
 * Encode the Evidence section of the Research page as a focus identity. The
 * Evidence list is a section of that page, not a View of its own, so the only
 * way to address it from the outside is through the opaque focus.
 * @param claimId - Claim whose evidence to show; absent opens the section empty.
 * @returns the opaque focus string `openView` carries.
 */
export function encodeClaimFocus(claimId?: ClaimId): string {
  return `claim:${claimId ?? ''}`
}

/**
 * Decode a Claim focus identity.
 * @param value - the opaque focus string from `viewRequest`.
 * @returns the claim id when present, or undefined when the string is not a
 *   claim focus (a research question, for instance).
 */
export function decodeClaimFocus(value: string): { readonly claimId?: ClaimId } | undefined {
  if (!value.startsWith('claim:')) return undefined
  const id = value.slice('claim:'.length)
  return id === '' ? {} : { claimId: id as ClaimId }
}

/** The page segments the research View hosts (0917 图 2 的检索流 与 图 4 的证据与笔记). */
export const MED_PAGE_SEGMENTS = ['search', 'evidence'] as const

/** One page segment of the research View. */
export type MedPageSegment = (typeof MED_PAGE_SEGMENTS)[number]

/**
 * Address one page segment of the research View. 0917 gives 证据与笔记 its own
 * page, but the View roster is fixed at the five navigation entries, so the
 * page is a segment and the L2 tree reaches it through this focus.
 * @param segment - which segment to show.
 * @returns the opaque focus string `openView` carries.
 */
export function encodePageFocus(segment: MedPageSegment): string {
  return `page:${segment}`
}

/**
 * Decode a page-segment focus identity.
 * @param value - the opaque focus string from `viewRequest`.
 * @returns the segment, or undefined when the string addresses something else.
 */
export function decodePageFocus(value: string): MedPageSegment | undefined {
  if (!value.startsWith('page:')) return undefined
  const segment = value.slice('page:'.length)
  return (MED_PAGE_SEGMENTS as readonly string[]).includes(segment) ? segment as MedPageSegment : undefined
}
