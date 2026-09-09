import { describe, expect, it } from 'vitest'
import { alignQuote } from '../src/alignment.ts'
import { normalizeParagraph } from '../src/normalize.ts'

const OPTIONS = { tolerance: 0.05, windowSize: 8 }

describe('alignQuote (SPEC §22.3)', () => {
  it('returns FOUND with offsets into the normalized paragraph', () => {
    const paragraph = 'First sentence.  The  intervention reduced pain scores.'
    const result = alignQuote(paragraph, 'intervention reduced pain scores', OPTIONS)
    expect(result.status).toBe('FOUND')
    expect(result.similarity).toBe(1)
    expect(normalizeParagraph(paragraph).slice(result.startOffset, result.endOffset))
      .toBe('intervention reduced pain scores')
  })

  it('locates a quote that only matches after normalization', () => {
    // NFKC expands the ligature; the spec's quote rule maps U+2019 to a double quote.
    const paragraph = 'The \uFB01rst group\u2019s outcome improved.'
    const result = alignQuote(paragraph, 'The first group\u2019s outcome improved.', OPTIONS)
    expect(result.status).toBe('FOUND')
    expect(result.startOffset).toBe(0)
  })

  it('returns PARTIAL for a near match within tolerance', () => {
    const paragraph = 'The treatment group showed a signifcant reduction in pain.'
    const result = alignQuote(paragraph, 'The treatment group showed a significant reduction', OPTIONS)
    expect(result.status).toBe('PARTIAL')
    expect(result.startOffset).toBe(0)
    expect(result.similarity).toBeGreaterThan(0.9)
    expect(result.similarity).toBeLessThan(1)
  })

  it('returns NOT_FOUND when no window is close enough', () => {
    const paragraph = 'The treatment group showed a significant reduction in pain.'
    expect(alignQuote(paragraph, 'an unrelated conclusion about mortality', OPTIONS).status).toBe('NOT_FOUND')
  })

  it('returns NOT_FOUND for an empty quote', () => {
    expect(alignQuote('anything', '   ', OPTIONS).status).toBe('NOT_FOUND')
  })

  it('does not accept a partial match when tolerance is zero', () => {
    const paragraph = 'The treatment group showed a signifcant reduction in pain.'
    const result = alignQuote(paragraph, 'The treatment group showed a significant reduction', {
      tolerance: 0,
      windowSize: 8,
    })
    expect(result.status).toBe('NOT_FOUND')
  })

  it('rejects invalid configuration loudly', () => {
    expect(() => alignQuote('a', 'a', { tolerance: 1.5, windowSize: 0 })).toThrow(/tolerance/)
    expect(() => alignQuote('a', 'a', { tolerance: 0.1, windowSize: -1 })).toThrow(/windowSize/)
    expect(() => alignQuote('a', 'a', { tolerance: 0.1, windowSize: 1.5 })).toThrow(/windowSize/)
  })
})
