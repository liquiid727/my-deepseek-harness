/**
 * Shared shapes of a parsed document. `text` is always the normalized
 * paragraph text produced by `normalizeParagraph`, so it is the offset base
 * for every evidence span (SPEC §10, §22.3).
 * @module @medresearch/dsh-plugin-paper/src/document
 */

import type { ParseStatus, SectionType } from '@medresearch/dsh-medical-contracts'

/** One parsed paragraph with its source page when the format has pages. */
export interface ParsedParagraph {
  text: string
  page?: number
}

/** One parsed section in document order. */
export interface ParsedSection {
  title: string
  type: SectionType
  paragraphs: ParsedParagraph[]
}

/** Outcome of parsing one document. */
export interface ParsedDocument {
  status: ParseStatus
  sections: ParsedSection[]
  /** Non-fatal parser messages; the caller stores them with the document. */
  warnings: string[]
}
