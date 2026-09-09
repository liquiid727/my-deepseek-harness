import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseJats } from '../src/jats.ts'
import { assemblePdfDocument } from '../src/pdf.ts'
import { inferSectionType } from '../src/sections.ts'

const fixture = (): string => readFileSync(new URL('./fixtures/jats/europepmc-fulltext.xml', import.meta.url), 'utf8')

describe('parseJats (SPEC §22.1)', () => {
  it('parses a real Europe PMC article into ordered sections', () => {
    const parsed = parseJats(fixture())
    expect(parsed.status).toBe('READY')
    const titles = parsed.sections.map(section => section.title)
    expect(titles).toContain('Introduction')
    expect(titles.some(title => /method/i.test(title))).toBe(true)
    expect(parsed.sections.find(section => section.title === 'Introduction')?.paragraphs.length).toBeGreaterThan(0)
    expect(parsed.sections.every(section => section.paragraphs.every(paragraph => paragraph.text === paragraph.text.trim())))
      .toBe(true)
  })

  it('reports ABSTRACT_ONLY when only the abstract parsed', () => {
    const xml = '<article><front><article-meta><abstract><p>Only the abstract.</p></abstract></article-meta></front></article>'
    const parsed = parseJats(xml)
    expect(parsed.status).toBe('ABSTRACT_ONLY')
    expect(parsed.warnings).toContain('only the abstract parsed')
  })

  it('reports PARTIAL when structure exists without paragraphs', () => {
    const xml = '<article><body><sec><title>Introduction</title></sec></body></article>'
    expect(parseJats(xml).status).toBe('PARTIAL')
  })

  it('reports FAILED for invalid or non-JATS input instead of throwing', () => {
    expect(parseJats('<not-xml').status).toBe('FAILED')
    expect(parseJats('<root><a/></root>').status).toBe('FAILED')
  })

  it('classifies section titles and defaults unknown ones to other', () => {
    expect(inferSectionType('Materials and methods')).toBe('methods')
    expect(inferSectionType('RESULTS')).toBe('results')
    expect(inferSectionType('Discussion')).toBe('discussion')
    expect(inferSectionType('Data Availability')).toBe('other')
  })
})

describe('assemblePdfDocument (SPEC §22.2)', () => {
  it('approximates blank-line paragraphs with page numbers and normalizes them', () => {
    const parsed = assemblePdfDocument({
      pages: [
        { page: 1, text: 'The \uFB01rst block\u2019s text.\n\nSecond   block-\nline text.' },
        { page: 2, text: 'Third block.' },
      ],
    })
    expect(parsed.status).toBe('READY')
    const paragraphs = parsed.sections[0]!.paragraphs
    expect(paragraphs.map(paragraph => paragraph.page)).toEqual([1, 1, 2])
    expect(paragraphs[0]!.text).toBe('The first block"s text.')
    expect(paragraphs[1]!.text).toBe('Second blockline text.')
  })

  it('reports PARTIAL when a page failed to extract', () => {
    const parsed = assemblePdfDocument({
      pages: [{ page: 1, text: 'Page one text.' }, { page: 2, text: '', failed: true }],
    })
    expect(parsed.status).toBe('PARTIAL')
    expect(parsed.warnings.some(warning => warning.includes('pages failed'))).toBe(true)
  })

  it('reports FAILED when no text was extracted', () => {
    expect(assemblePdfDocument({ pages: [] }).status).toBe('FAILED')
    expect(assemblePdfDocument({ pages: [{ page: 1, text: '   ' }] }).status).toBe('FAILED')
  })
})
