import { describe, expect, it } from 'vitest'
import { normalizeParagraph } from '../src/normalize.ts'

describe('normalizeParagraph (SPEC §22.3)', () => {
  it('applies NFKC before anything else', () => {
    expect(normalizeParagraph('\uFF21\uFF22\uFF23')).toBe('ABC')
    expect(normalizeParagraph('\u2460')).toBe('1')
    expect(normalizeParagraph('10\u33A1')).toBe('10m2')
  })

  it('deletes soft hyphens', () => {
    expect(normalizeParagraph('co\u00ADoperate')).toBe('cooperate')
  })

  it('folds a line-end hyphen and the newline into the word', () => {
    expect(normalizeParagraph('well-\nbeing')).toBe('wellbeing')
    expect(normalizeParagraph('non- \n steroidal')).toBe('nonsteroidal')
    expect(normalizeParagraph('multi-\r\nline')).toBe('multiline')
  })

  it('expands ligatures that NFKC leaves alone', () => {
    expect(normalizeParagraph('\uFB00\uFB01\uFB02\uFB03\uFB04')).toBe('fffiflffiffl')
  })

  it('unifies quotes and dashes', () => {
    expect(normalizeParagraph('\u2018a\u2019 \u201Cb\u201D')).toBe('"a" "b"')
    expect(normalizeParagraph('1\u20132\u20143')).toBe('1-2-3')
  })

  it('collapses every whitespace class to one space and trims', () => {
    expect(normalizeParagraph('  a\t\n  b\u00A0c  ')).toBe('a b c')
    expect(normalizeParagraph('\n\n')).toBe('')
  })

  it('preserves case', () => {
    expect(normalizeParagraph('DNA and RNA')).toBe('DNA and RNA')
  })

  it('is idempotent', () => {
    const raw = ' \uFB01rst-\n second\u2019s\u00AD line \u2014 done '
    const once = normalizeParagraph(raw)
    expect(normalizeParagraph(once)).toBe(once)
  })
})
