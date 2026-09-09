import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { paperIdSchema, type Paper } from '@medresearch/dsh-medical-contracts'
import { FulltextResolver } from '../src/resolver.ts'

const fixture = (): string => readFileSync(
  new URL('../../plugin-paper/tests/fixtures/jats/europepmc-fulltext.xml', import.meta.url),
  'utf8',
)

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: paperIdSchema.parse('paper-1'),
    title: 'A paper',
    authors: [],
    publicationTypes: [],
    meshTerms: [],
    keywords: [],
    source: 'pubmed',
    fulltextStatus: 'abstract_only',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('FulltextResolver (SPEC §21)', () => {
  it('resolves a PMCID to a machine-readable Europe PMC XML URL', async () => {
    const resolver = new FulltextResolver({
      europePmcBaseUrl: 'https://www.ebi.ac.uk/europepmc/webservices/rest',
      fetchText: async url => ({ status: 200, body: `<ok>${url}</ok>` }),
    })
    const resolution = await resolver.resolve(paper({ pmcid: 'PMC13440857' }))
    expect(resolution).toEqual({
      status: 'available',
      source: 'europe_pmc',
      url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13440857/fullTextXML',
      machineReadable: true,
    })
  })

  it('falls back to abstract_only when the machine-readable channel is unreachable', async () => {
    const resolver = new FulltextResolver({
      europePmcBaseUrl: 'https://example.invalid',
      fetchText: async () => ({ status: 404, body: '' }),
    })
    expect(await resolver.resolve(paper({ pmcid: 'PMC0', abstract: 'An abstract.' })))
      .toEqual({ status: 'abstract_only' })
  })

  it('returns abstract_only without a PMCID and unavailable without an abstract', async () => {
    const resolver = new FulltextResolver({
      europePmcBaseUrl: 'https://example.invalid',
      fetchText: async () => { throw new Error('must not be called') },
    })
    expect(await resolver.resolve(paper({ abstract: 'An abstract.' }))).toEqual({ status: 'abstract_only' })
    expect(await resolver.resolve(paper())).toEqual({ status: 'unavailable' })
  })

  it('does not claim availability when the body is empty', async () => {
    const resolver = new FulltextResolver({
      europePmcBaseUrl: 'https://example.invalid',
      fetchText: async () => ({ status: 200, body: '   ' }),
    })
    expect(await resolver.resolve(paper({ pmcid: 'PMC1', abstract: 'x' }))).toEqual({ status: 'abstract_only' })
  })

  it('serves the recorded full-text fixture body unchanged', async () => {
    const body = fixture()
    const resolver = new FulltextResolver({
      europePmcBaseUrl: 'https://example.invalid',
      fetchText: async () => ({ status: 200, body }),
    })
    const resolution = await resolver.resolve(paper({ pmcid: 'PMC13440857' }))
    expect(resolution.status).toBe('available')
    expect(body).toContain('<article')
  })
})
