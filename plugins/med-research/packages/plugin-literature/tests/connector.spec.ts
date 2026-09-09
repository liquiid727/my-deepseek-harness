import { describe, expect, it } from 'vitest'
import {
  PubmedConnector,
  buildPubmedTerm,
  type PubmedConnectorOptions,
} from '../src/pubmed/connector.ts'
import { efetch, esearchPage, fixture, ReplayTransport } from './helpers/replay-transport.ts'

/** One synthetic article; used for the edge cases a live query cannot pin down. */
function xmlArticle(pmid: string, options: { doi?: string; abstract?: string } = {}): string {
  const ids = [
    `<ArticleId IdType="pubmed">${pmid}</ArticleId>`,
    ...options.doi === undefined ? [] : [`<ArticleId IdType="doi">${options.doi}</ArticleId>`],
  ].join('')
  const abstract = options.abstract === undefined
    ? ''
    : `<Abstract><AbstractText Label="RESULTS">${options.abstract}</AbstractText></Abstract>`
  return '<PubmedArticle><MedlineCitation>'
    + `<PMID Version="1">${pmid}</PMID>`
    + `<Article><ArticleTitle>Title ${pmid}</ArticleTitle>${abstract}</Article>`
    + `</MedlineCitation><PubmedData><ArticleIdList>${ids}</ArticleIdList></PubmedData></PubmedArticle>`
}

function xmlSet(...articles: string[]): string {
  return `<PubmedArticleSet>${articles.join('')}</PubmedArticleSet>`
}

function esearch(count: number, ids: string[]): string {
  return JSON.stringify({ esearchresult: { count: String(count), idlist: ids } })
}

function connector(transport: ReplayTransport, overrides: Partial<PubmedConnectorOptions> = {}): PubmedConnector {
  const base: PubmedConnectorOptions = {
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    tool: 'med-research-workspace',
    email: 'medresearch@example.com',
    requestsPerSecond: 1e9,
    maxRetries: 2,
    backoffBaseMs: 10,
    timeoutMs: 5_000,
    retmax: 20,
    efetchBatchSize: 200,
    cacheTtlMs: 0,
    sleep: async () => {},
  }
  return new PubmedConnector(
    (url, signal) => transport.get(url, signal),
    { ...base, ...overrides } as PubmedConnectorOptions,
  )
}

describe('PubmedConnector (SPEC §55)', () => {
  it('normalizes real EFetch records for a known PMID set', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, fixture('esearch-ponv.json')),
      efetch(fixture('efetch-batch.xml')),
    ])
    const result = await connector(transport).search({ query: 'PONV postoperative pain', maxResults: 2 })

    expect(result.totalCount).toBe(9713)
    expect(result.records).toHaveLength(2)
    const first = result.records[0]!
    expect(first.pmid).toBe('42705006')
    expect(first.doi).toBe('10.1016/j.jclinane.2026.112309')
    expect(first.source).toBe('pubmed')
    expect(first.sourceUrl).toBe('https://pubmed.ncbi.nlm.nih.gov/42705006/')
    expect(first.title).toContain('perioperative vitamin C')
    expect(first.journal).toBe('Journal of clinical anesthesia')
    expect(first.publicationDate).toBe('2026-09-07')
    expect(first.authors.length).toBeGreaterThan(0)
    expect(first.authors[0]!.name).toContain('Xiong')
    expect(first.abstract).toContain('OBJECTIVE:')
    expect(first.fulltextStatus).toBe('abstract_only')
    expect(result.records[1]!.meshTerms).toContain('Postoperative Pain')
    expect(first.keywords).toContain('Vitamin C')
  })

  it('returns an empty result without inventing records or calling EFetch', async () => {
    const transport = new ReplayTransport([esearchPage(0, fixture('esearch-empty.json'))])
    const result = await connector(transport).search({ query: 'zzzqxnonexistenttermzzz', maxResults: 5 })

    expect(result.totalCount).toBe(0)
    expect(result.records).toEqual([])
    expect(transport.calls.filter(url => url.includes('/efetch.fcgi'))).toHaveLength(0)
  })

  it('surfaces a malformed query as an empty page plus PubMed warnings', async () => {
    const transport = new ReplayTransport([esearchPage(0, fixture('esearch-malformed.json'))])
    const result = await connector(transport).search({ query: 'AND[', maxResults: 5 })

    expect(result.totalCount).toBe(0)
    expect(result.records).toEqual([])
    expect(result.warnings).toContain('No items found.')
  })

  it('maps HTTP 429 to PUBMED_RATE_LIMIT after retrying with backoff', async () => {
    const delays: number[] = []
    const transport = new ReplayTransport([
      { test: url => url.pathname.endsWith('/esearch.fcgi'), status: 429 },
    ])
    const client = connector(transport, {
      maxRetries: 2,
      backoffBaseMs: 10,
      sleep: async (ms) => { delays.push(ms) },
    })

    await expect(client.search({ query: 'x', maxResults: 1 })).rejects.toMatchObject({
      name: 'PubmedError',
      code: 'PUBMED_RATE_LIMIT',
      retryable: true,
    })
    expect(transport.count).toBe(3)
    expect(delays).toEqual([10, 20])
  })

  it('maps a hanging request to PUBMED_TIMEOUT', async () => {
    const transport = new ReplayTransport([
      { test: url => url.pathname.endsWith('/esearch.fcgi'), delayMs: 1_000 },
    ])
    const client = connector(transport, { timeoutMs: 5, maxRetries: 1, backoffBaseMs: 1 })

    await expect(client.search({ query: 'x', maxResults: 1 })).rejects.toMatchObject({
      name: 'PubmedError',
      code: 'PUBMED_TIMEOUT',
      retryable: true,
    })
    expect(transport.count).toBe(2)
  })

  it('does not retry a non-retryable HTTP error', async () => {
    const transport = new ReplayTransport([
      { test: url => url.pathname.endsWith('/esearch.fcgi'), status: 400 },
    ])
    await expect(connector(transport).search({ query: 'x', maxResults: 1 })).rejects.toMatchObject({
      code: 'PUBMED_HTTP_ERROR',
      retryable: false,
    })
    expect(transport.count).toBe(1)
  })

  it('de-duplicates repeated records across the fetched batch', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, esearch(2, ['111', '222'])),
      efetch(xmlSet(
        xmlArticle('111', { doi: '10.1/a', abstract: 'First abstract' }),
        xmlArticle('111', { doi: '10.1/a', abstract: 'First abstract' }),
      )),
    ])
    const result = await connector(transport).search({ query: 'x', maxResults: 2 })
    expect(result.records.map(record => record.pmid)).toEqual(['111'])
  })

  it('keeps a record with no DOI and no abstract, marking full text unavailable', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, esearch(1, ['333'])),
      efetch(xmlSet(xmlArticle('333'))),
    ])
    const result = await connector(transport).search({ query: 'x', maxResults: 1 })
    expect(result.records).toHaveLength(1)
    expect(result.records[0]!.doi).toBeUndefined()
    expect(result.records[0]!.abstract).toBeUndefined()
    expect(result.records[0]!.fulltextStatus).toBe('unavailable')
  })

  it('paginates up to the requested cap at the page boundary', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, esearch(3, ['1', '2'])),
      esearchPage(2, esearch(3, ['3'])),
      efetch(xmlSet(xmlArticle('1'), xmlArticle('2'), xmlArticle('3'))),
    ])
    const result = await connector(transport, { retmax: 2 }).search({ query: 'x', maxResults: 3 })

    expect(result.records.map(record => record.pmid)).toEqual(['1', '2', '3'])
    expect(transport.calls.filter(url => url.includes('/esearch.fcgi'))).toHaveLength(2)
    expect(transport.calls.filter(url => url.includes('/efetch.fcgi'))).toHaveLength(1)
  })

  it('caches by query hash and reports the cache hit', async () => {
    const transport = new ReplayTransport([
      esearchPage(0, fixture('esearch-ponv.json')),
      efetch(fixture('efetch-batch.xml')),
    ])
    const client = connector(transport, { cacheTtlMs: 60_000 })
    const first = await client.search({ query: 'PONV postoperative pain', maxResults: 2 })
    const second = await client.search({ query: 'PONV postoperative pain', maxResults: 2 })

    expect(second).toEqual(first)
    expect(transport.count).toBe(2)
    expect(client.metrics().cacheHits).toBe(1)
  })

  it('sends tool, email, and API key, and composes filters into the term', async () => {
    const transport = new ReplayTransport([esearchPage(0, esearch(0, []))])
    await connector(transport, { apiKey: 'secret-key' }).search({
      query: 'pain',
      maxResults: 1,
      dateFrom: '2020',
      dateTo: '2024',
      publicationTypes: ['Review'],
      languages: ['english'],
    })

    const url = new URL(transport.calls[0]!)
    expect(url.searchParams.get('tool')).toBe('med-research-workspace')
    expect(url.searchParams.get('email')).toBe('medresearch@example.com')
    expect(url.searchParams.get('api_key')).toBe('secret-key')
    expect(url.searchParams.get('term')).toBe(
      '(pain) AND ("2020"[Date - Publication] : "2024"[Date - Publication]) '
      + 'AND ("Review"[Publication Type]) AND (english[Language])',
    )
  })

  it('composes the bare term when no filters are given', () => {
    expect(buildPubmedTerm({ query: '"PONV"[Title/Abstract]' })).toBe('("PONV"[Title/Abstract])')
  })
})
