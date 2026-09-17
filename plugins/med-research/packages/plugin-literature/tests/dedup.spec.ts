import { describe, expect, it } from 'vitest'
import { dedupePapers, normalizeDoi, paperIdentityKey, type PaperIdentity } from '@medresearch/dsh-medical-domain'

/** Build a minimal identity record; only the five keys the key reads matter. */
function id(over: Partial<PaperIdentity>): PaperIdentity {
  return { title: over.title ?? '', ...over }
}

describe('paperIdentityKey (SPEC §8 order: PMID → DOI → title+year)', () => {
  it('keys on exact PMID before anything else', () => {
    const a = id({ pmid: '1', title: 'A', publicationDate: '2020' })
    const b = id({ pmid: '1', title: 'Completely different title', publicationDate: '1999' })
    expect(paperIdentityKey(a)).toBe(paperIdentityKey(b))
    expect(paperIdentityKey(a)).toBe('pmid:1')
  })

  it('falls back to normalized DOI (resolver prefix stripped, lowercased) when PMID absent', () => {
    const variants = [
      '10.1000/xyz',
      'doi:10.1000/xyz',
      'https://doi.org/10.1000/xyz',
      'HTTPS://DX.DOI.ORG/10.1000/XYZ',
    ]
    const keys = variants.map(doi => paperIdentityKey(id({ title: 'T', publicationDate: '2020', doi })))
    for (const key of keys) expect(key).toBe('doi:10.1000/xyz')
    expect(normalizeDoi('  DoI:10.1000/XYZ ')).toBe('10.1000/xyz')
  })

  it('falls back to normalized title + publication year when PMID and DOI absent', () => {
    const a = id({ title: 'Same Title', publicationDate: '2021-05-01' })
    const b = id({ title: 'same title', publicationDate: '2021' })
    expect(paperIdentityKey(a)).toBe(paperIdentityKey(b))
    expect(paperIdentityKey(a)).toContain('title:')
    expect(paperIdentityKey(a)).toContain('2021')
  })

  it('does NOT merge two records that share a title but differ in year', () => {
    const a = id({ title: 'Same Title', publicationDate: '2020' })
    const b = id({ title: 'Same Title', publicationDate: '2021' })
    expect(paperIdentityKey(a)).not.toBe(paperIdentityKey(b))
  })
})

describe('dedupePapers (SPEC §8)', () => {
  it('keeps the first occurrence and reports the dropped duplicate', () => {
    const kept = id({ pmid: '1', title: 'A', publicationDate: '2020' })
    const dropped = id({ pmid: '1', title: 'B', publicationDate: '2020' })
    const result = dedupePapers([kept, dropped])
    expect(result.papers).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0]!.kept).toBe(kept)
    expect(result.duplicates[0]!.dropped).toBe(dropped)
  })

  it('does not merge the same title across different years', () => {
    const result = dedupePapers([
      id({ title: 'Same Title', publicationDate: '2020' }),
      id({ title: 'Same Title', publicationDate: '2021' }),
    ])
    expect(result.papers).toHaveLength(2)
  })
})
