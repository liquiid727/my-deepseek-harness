/**
 * Quote location against a normalized paragraph (SPEC §22.3). Exact match
 * yields `FOUND`; a sliding window within the configured edit-distance
 * tolerance yields `PARTIAL`; otherwise `NOT_FOUND`. Every returned offset is
 * relative to the paragraph's normalized text.
 * @module @medresearch/dsh-medical-domain/src/alignment
 */

import type { LocatorStatus } from '@medresearch/dsh-medical-contracts'
import { normalizeParagraph } from './normalize.ts'

/**
 * Alignment tunables. Both are deployment-varying and must come from a
 * validated `Config` (SPEC §13.3); the domain layer never supplies a default.
 */
export interface AlignmentOptions {
  /** Maximum accepted edit distance divided by the window length, in `[0, 1]`. */
  tolerance: number
  /** Maximum difference between a candidate window's length and the quote's, in characters. */
  windowSize: number
}

/** Outcome of locating one quote. */
export interface AlignmentResult {
  status: LocatorStatus
  /** Present exactly when `status` is `FOUND` or `PARTIAL`. */
  startOffset?: number
  /** Exclusive end offset; present exactly when `startOffset` is. */
  endOffset?: number
  /** `1` for an exact match; `1 - distance / windowLength` for a partial one. */
  similarity?: number
}

/**
 * Bounded Levenshtein distance. Returns `max + 1` as soon as no path can stay
 * within `max`, which keeps a sliding-window scan over long paragraphs cheap.
 * @param a - First string.
 * @param b - Second string.
 * @param max - Largest distance of interest.
 * @returns the edit distance when it is at most `max`, otherwise `max + 1`.
 */
function boundedDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const m = b.length
  let prev = new Array<number>(m + 1)
  let curr = new Array<number>(m + 1)
  for (let j = 0; j <= m; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    let rowMin = curr[0]!
    const from = Math.max(1, i - max)
    const to = Math.min(m, i + max)
    for (let j = from; j <= to; j += 1) {
      const substitution = prev[j - 1]! + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)
      const deletion = prev[j]! + 1
      const insertion = curr[j - 1]! + 1
      const value = Math.min(substitution, deletion, insertion)
      curr[j] = value
      if (value < rowMin) rowMin = value
    }
    for (let j = to + 1; j <= m; j += 1) curr[j] = max + 1
    if (rowMin > max) return max + 1
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[m]!
}

/**
 * Locate a quote inside one paragraph.
 *
 * Both inputs are normalized first, so a raw extracted quote and an already
 * normalized paragraph are both accepted. An empty quote is never locatable.
 * @param paragraph - Paragraph text; normalization is idempotent.
 * @param quote - Candidate quote to locate.
 * @param options - Tolerance and window size, resolved from configuration.
 * @returns the locator status with offsets into the normalized paragraph.
 * @throws RangeError when `tolerance` is outside `[0, 1]` or `windowSize` is
 * not a non-negative integer — misconfiguration must fail loud.
 */
export function alignQuote(paragraph: string, quote: string, options: AlignmentOptions): AlignmentResult {
  if (!Number.isFinite(options.tolerance) || options.tolerance < 0 || options.tolerance > 1) {
    throw new RangeError(`alignment tolerance must be within [0, 1], got ${options.tolerance}`)
  }
  if (!Number.isInteger(options.windowSize) || options.windowSize < 0) {
    throw new RangeError(`alignment windowSize must be a non-negative integer, got ${options.windowSize}`)
  }

  const text = normalizeParagraph(paragraph)
  const needle = normalizeParagraph(quote)
  if (needle.length === 0) return { status: 'NOT_FOUND' }

  const exact = text.indexOf(needle)
  if (exact >= 0) {
    return { status: 'FOUND', startOffset: exact, endOffset: exact + needle.length, similarity: 1 }
  }

  const maxDistance = Math.floor(options.tolerance * needle.length)
  let best: { start: number; end: number; similarity: number } | undefined
  for (let delta = -options.windowSize; delta <= options.windowSize; delta += 1) {
    const windowLength = needle.length + delta
    if (windowLength < 1 || windowLength > text.length) continue
    const lastStart = text.length - windowLength
    for (let start = 0; start <= lastStart; start += 1) {
      const distance = boundedDistance(text.slice(start, start + windowLength), needle, maxDistance)
      if (distance > maxDistance) continue
      const normalizedDistance = distance / Math.max(windowLength, needle.length)
      if (normalizedDistance > options.tolerance) continue
      const similarity = 1 - normalizedDistance
      if (best === undefined || similarity > best.similarity
        || (similarity === best.similarity && start < best.start)) {
        best = { start, end: start + windowLength, similarity }
      }
    }
  }

  if (best === undefined) return { status: 'NOT_FOUND' }
  return { status: 'PARTIAL', startOffset: best.start, endOffset: best.end, similarity: best.similarity }
}
