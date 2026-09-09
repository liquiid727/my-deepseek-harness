/**
 * PDF text assembly (SPEC §22.2). Page text arrives from an injected
 * extractor; this module only approximates paragraphs (blank-line blocks) and
 * reports the parse status. A page that failed to extract makes the document
 * `PARTIAL`, never silently `READY`.
 * @module @medresearch/dsh-plugin-paper/src/pdf
 */

import { normalizeParagraph } from '@medresearch/dsh-medical-domain'
import type { ParsedDocument, ParsedParagraph } from './document.ts'

/** One extracted PDF page; `failed` marks an extractor error for that page. */
export interface PdfPage {
  page: number
  text: string
  failed?: boolean
}

/** Result of extracting text from a PDF. */
export interface PdfExtraction {
  pages: PdfPage[]
}

/**
 * Approximate paragraphs from one page: blank-line-separated blocks, each
 * normalized. Single newlines inside a block are folded by normalization.
 * @param page - Extracted page.
 * @returns paragraphs tagged with their page number.
 */
function paragraphsOfPage(page: PdfPage): ParsedParagraph[] {
  if (page.failed === true) return []
  return page.text
    .split(/\n\s*\n/u)
    .map(block => normalizeParagraph(block))
    .filter(text => text !== '')
    .map(text => ({ text, page: page.page }))
}

/**
 * Assemble a parsed document from extracted PDF pages.
 * @param extraction - Pages in order, each flagged when extraction failed.
 * @returns one `other` section with page-tagged paragraphs and the status:
 * `FAILED` when nothing was extracted, `PARTIAL` when any page is missing or
 * empty, `READY` otherwise.
 */
export function assemblePdfDocument(extraction: PdfExtraction): ParsedDocument {
  const paragraphs = extraction.pages.flatMap(paragraphsOfPage)
  const warnings: string[] = []
  const failed = extraction.pages.filter(page => page.failed === true).map(page => page.page)
  const empty = extraction.pages.filter(page => page.failed !== true && page.text.trim() === '').map(page => page.page)
  if (failed.length > 0) warnings.push(`pages failed to extract: ${failed.join(', ')}`)
  if (empty.length > 0) warnings.push(`pages with no text: ${empty.join(', ')}`)

  const status = extraction.pages.length === 0 || paragraphs.length === 0
    ? 'FAILED'
    : failed.length > 0 || empty.length > 0 ? 'PARTIAL' : 'READY'
  return {
    status,
    sections: paragraphs.length === 0 ? [] : [{ title: '', type: 'other', paragraphs }],
    warnings,
  }
}
