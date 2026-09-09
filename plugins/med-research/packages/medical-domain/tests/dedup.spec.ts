import { describe, expect, it } from 'vitest'
import { dedupePapers, normalizeDoi, paperIdentityKey, type PaperIdentity } from '../src/dedup.ts'

/** Minimal identity record; de-duplication only reads the identity fields. */
function paper(fields: PaperIdentity): PaperIdentity {
  return fields
}

describe('paperIdentityKey (SPEC §20 priority)', () => {
  it('prefers PMID over DOI, PMCID, and title', () => {
    const key = paperIdentityKey(paper({
      title: 'A title',
      pmid: '12345',
      doi: '10.1/abc',
      pmcid: 'PMC1',
      publicationDate: '2020',
    }))
    expect(key).toBe('pmid:12345')
  })

  it('falls back to DOI, then PMCID, then title+year', () => {
    expect(paperIdentityKey(paper({ title: 'A title', doi: '10.1/ABC' }))).toBe('doi:10.1/abc')
    expect(paperIdentityKey(paper({ title: 'A title', pmcid: 'PMC9' }))).toBe('pmcid:pmc9')
    expect(paperIdentityKey(paper({ title: 'A  Title!', publicationDate: '2020-05-01' })))
      .toBe('title:a title!|2020')
  })

  it('normalizes DOI prefixes and case', () => {
    expect(normalizeDoi(' https://doi.org/10.1000/XYZ ')).toBe('10.1000/xyz')
    expect(normalizeDoi('doi:10.1000/XYZ')).toBe('10.1000/xyz')
  })

  it('normalizes whitespace inside the title fallback', () => {
    expect(paperIdentityKey(paper({ title: 'A\u00A0title\nwith   space', publicationDate: '1999' })))
      .toBe('title:a title with space|1999')
  })
})

describe('dedupePapers (FR-4)', () => {
  it('keeps the first record and reports the dropped duplicate', () => {
    const first = paper({ title: 'First', pmid: '1' })
    const second = paper({ title: 'Second', pmid: '1' })
    const result = dedupePapers([first, second])
    expect(result.papers).toEqual([first])
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0]).toMatchObject({ key: 'pmid:1', kept: first, dropped: second })
  })

  it('matches across identifier kinds when the shared identifier is the same', () => {
    const byDoi = paper({ title: 'One', doi: '10.1/x' })
    const byDoiLater = paper({ title: 'Two', doi: 'https://doi.org/10.1/X' })
    const result = dedupePapers([byDoi, byDoiLater])
    expect(result.papers).toEqual([byDoi])
  })

  it('treats records with different identifiers and titles as distinct', () => {
    const a = paper({ title: 'Alpha', pmid: '1' })
    const b = paper({ title: 'Beta', pmid: '2' })
    const c = paper({ title: 'Gamma', publicationDate: '2001' })
    expect(dedupePapers([a, b, c]).papers).toHaveLength(3)
  })

  it('preserves input order of the kept records', () => {
    const a = paper({ title: 'A', pmid: '1' })
    const b = paper({ title: 'B', pmid: '2' })
    const aDuplicate = paper({ title: 'A again', pmid: '1' })
    const result = dedupePapers([a, b, aDuplicate])
    expect(result.papers).toEqual([a, b])
  })
})
