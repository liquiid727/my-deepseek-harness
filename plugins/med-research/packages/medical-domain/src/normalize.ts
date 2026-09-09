/**
 * Paragraph normalization (SPEC §22.3). The output is the offset base for
 * every evidence span: `PaperParagraph.text` stores this value, and
 * `startOffset`/`endOffset` are character offsets into it. The order below is
 * fixed by the spec because later steps depend on earlier ones (line-end
 * dehyphenation must run before whitespace folding erases the newline).
 * @module @medresearch/dsh-medical-domain/src/normalize
 */

const LIGATURES: Readonly<Record<string, string>> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
}

const QUOTES = /[\u2018\u2019\u201C\u201D]/gu
const DASHES = /[\u2013\u2014]/gu
const SOFT_HYPHEN = /\u00AD/gu
/** A hyphen at end of line plus the newline (and surrounding horizontal space) folds away. */
const LINE_END_HYPHEN = /-[ \t]*\r?\n[ \t]*/gu
const WHITESPACE = /[\s\u00A0]+/gu

/**
 * Normalize one paragraph for storage and matching.
 *
 * Steps, in this exact order: NFKC; delete soft hyphens and fold line-end
 * hyphens; expand ligatures; unify quotes and dashes; collapse whitespace
 * (including newlines, tabs, and NBSP) to single spaces; trim. Case is not
 * changed — case-insensitive comparison belongs to the comparison step.
 * @param raw - Paragraph text as extracted from the document.
 * @returns the normalized text; idempotent, so re-normalizing a stored
 * paragraph is safe.
 */
export function normalizeParagraph(raw: string): string {
  let text = raw.normalize('NFKC')
  text = text.replace(SOFT_HYPHEN, '')
  text = text.replace(LINE_END_HYPHEN, '')
  text = text.replace(/[\uFB00-\uFB04]/gu, ligature => LIGATURES[ligature] ?? ligature)
  text = text.replace(QUOTES, '"')
  text = text.replace(DASHES, '-')
  text = text.replace(WHITESPACE, ' ')
  return text.trim()
}
