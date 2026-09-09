/**
 * PubMed E-utilities connector (SPEC §19). Owns request shaping, the rate
 * limiter, retry with backoff, pagination, the query-hash cache, and the
 * ESearch → EFetch → normalize → deduplicate flow. Transport is injected as
 * {@link HttpGet} so the connector is exercised against recorded fixtures in
 * tests and against `ctx.web.fetch` in production.
 * @module @medresearch/dsh-plugin-literature/src/pubmed/connector
 */

import { dedupePapers } from '@medresearch/dsh-medical-domain'
import { PubmedError } from './errors.ts'
import { parseEFetch, parseESearch, type PubmedRecord } from './parse.ts'

export type { PubmedRecord } from './parse.ts'

/** One HTTP GET response as the connector needs it. */
export interface HttpGetResponse {
  status: number
  body: string
}

/** Injected transport; `signal` aborts the request. */
export type HttpGet = (url: string, signal?: AbortSignal) => Promise<HttpGetResponse>

/** Connector tunables, all resolved from plugin `Config` by the caller. */
export interface PubmedConnectorOptions {
  /** E-utilities base, without a trailing slash. */
  baseUrl: string
  /** NCBI tool identifier sent with every request. */
  tool: string
  /** NCBI contact address sent with every request. */
  email: string
  /** NCBI API key; raises the documented rate allowance. */
  apiKey?: string
  /** Sustained requests per second the limiter enforces. */
  requestsPerSecond: number
  /** Retries after the first attempt for retryable failures. */
  maxRetries: number
  /** Base delay for exponential backoff, in milliseconds. */
  backoffBaseMs: number
  /** Per-request deadline in milliseconds. */
  timeoutMs: number
  /** ESearch page size. */
  retmax: number
  /** EFetch batch size (NCBI accepts at most a few hundred ids per call). */
  efetchBatchSize: number
  /** Query-hash cache lifetime in milliseconds; `0` disables caching. */
  cacheTtlMs: number
  /** Clock, injectable for deterministic tests. */
  now?: () => number
  /** Sleep, injectable for deterministic rate-limit and backoff tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

/** One search request. */
export interface PubmedSearchRequest {
  query: string
  maxResults: number
  dateFrom?: string
  dateTo?: string
  publicationTypes?: string[]
  languages?: string[]
  signal?: AbortSignal
}

/** Normalized search outcome. */
export interface PubmedSearchResult {
  records: PubmedRecord[]
  /** Total matches PubMed reported, not the returned page length. */
  totalCount: number
  queryTranslation?: string
  /** Non-fatal PubMed messages; the caller surfaces them instead of hiding them. */
  warnings: string[]
}

/** Lightweight connector counters (SPEC §48). */
export interface PubmedMetrics {
  requests: number
  cacheHits: number
  retries: number
  papersFetched: number
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Compose the PubMed term from the query and its optional filters. */
export function buildPubmedTerm(request: Pick<PubmedSearchRequest, 'query' | 'dateFrom' | 'dateTo' | 'publicationTypes' | 'languages'>): string {
  const parts = [`(${request.query})`]
  if (request.dateFrom !== undefined || request.dateTo !== undefined) {
    const from = request.dateFrom ?? '1800'
    const to = request.dateTo ?? '3000'
    parts.push(`("${from}"[Date - Publication] : "${to}"[Date - Publication])`)
  }
  if (request.publicationTypes !== undefined && request.publicationTypes.length > 0) {
    parts.push(`(${request.publicationTypes.map(type => `"${type}"[Publication Type]`).join(' OR ')})`)
  }
  if (request.languages !== undefined && request.languages.length > 0) {
    parts.push(`(${request.languages.map(language => `${language.toLowerCase()}[Language]`).join(' OR ')})`)
  }
  return parts.join(' AND ')
}

/** Split a list into batches of at most `size` items. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size))
  return batches
}

/** PubMed connector over an injected transport. */
export class PubmedConnector {
  private readonly options: PubmedConnectorOptions
  private readonly now: () => number
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>
  private readonly intervalMs: number
  private nextSlot = 0
  private readonly cache = new Map<string, { expiresAt: number; value: PubmedSearchResult }>()
  private readonly counters: PubmedMetrics = { requests: 0, cacheHits: 0, retries: 0, papersFetched: 0 }

  /**
   * @param transport - HTTP GET implementation.
   * @param options - Resolved connector configuration.
   */
  constructor(
    private readonly transport: HttpGet,
    options: PubmedConnectorOptions,
  ) {
    this.options = options
    this.now = options.now ?? (() => Date.now())
    this.sleep = options.sleep ?? defaultSleep
    this.intervalMs = 1000 / options.requestsPerSecond
  }

  /** Current connector counters. */
  metrics(): PubmedMetrics {
    return { ...this.counters }
  }

  private buildUrl(path: string, params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams({ db: 'pubmed', tool: this.options.tool, email: this.options.email })
    if (this.options.apiKey !== undefined && this.options.apiKey !== '') search.set('api_key', this.options.apiKey)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value))
    }
    return `${this.options.baseUrl}/${path}?${search.toString()}`
  }

  /** Reserve a rate-limiter slot and wait for it. */
  private async acquireSlot(signal?: AbortSignal): Promise<void> {
    const now = this.now()
    const wait = Math.max(0, this.nextSlot - now)
    this.nextSlot = Math.max(now, this.nextSlot) + this.intervalMs
    if (wait > 0) await this.sleep(wait, signal)
  }

  /** One rate-limited, timed, retried GET returning the response body. */
  private async request(url: string, signal?: AbortSignal): Promise<string> {
    for (let attempt = 0; ; attempt += 1) {
      await this.acquireSlot(signal)
      this.counters.requests += 1
      const timeout = new AbortController()
      const timer = setTimeout(() => { timeout.abort(new PubmedError('PUBMED_TIMEOUT', `PubMed request timed out after ${this.options.timeoutMs} ms`, true)) }, this.options.timeoutMs)
      const combined = signal === undefined ? timeout.signal : AbortSignal.any([signal, timeout.signal])
      try {
        const response = await this.transport(url, combined)
        if (response.status === 429) {
          throw new PubmedError('PUBMED_RATE_LIMIT', 'PubMed returned 429 (rate limit)', true, { status: response.status })
        }
        if (response.status >= 500) {
          throw new PubmedError('PUBMED_HTTP_ERROR', `PubMed returned ${response.status}`, true, { status: response.status })
        }
        if (response.status !== 200) {
          throw new PubmedError('PUBMED_HTTP_ERROR', `PubMed returned ${response.status}`, false, { status: response.status })
        }
        return response.body
      } catch (error) {
        if (signal?.aborted === true) throw signal.reason
        const failure = timeout.signal.aborted
          ? new PubmedError('PUBMED_TIMEOUT', `PubMed request timed out after ${this.options.timeoutMs} ms`, true)
          : error
        if (failure instanceof PubmedError && failure.retryable && attempt < this.options.maxRetries) {
          this.counters.retries += 1
          await this.sleep(this.options.backoffBaseMs * 2 ** attempt, signal)
          continue
        }
        throw failure
      } finally {
        clearTimeout(timer)
      }
    }
  }

  private cacheKey(request: PubmedSearchRequest): string {
    return JSON.stringify({
      query: request.query,
      maxResults: request.maxResults,
      dateFrom: request.dateFrom ?? null,
      dateTo: request.dateTo ?? null,
      publicationTypes: request.publicationTypes ?? [],
      languages: request.languages ?? [],
    })
  }

  /**
   * Search PubMed and return normalized, de-duplicated records.
   *
   * Pagination follows ESearch `retstart` until `maxResults` or the reported
   * count is reached; EFetch runs in bounded batches. A failed request throws
   * a {@link PubmedError}; it never returns an empty list in place of a failure.
   * @param request - Query, filters, and result cap.
   * @returns records plus the total match count and PubMed warnings.
   */
  async search(request: PubmedSearchRequest): Promise<PubmedSearchResult> {
    const key = this.cacheKey(request)
    const cached = this.cache.get(key)
    if (cached !== undefined && cached.expiresAt > this.now()) {
      this.counters.cacheHits += 1
      return cached.value
    }
    const term = buildPubmedTerm(request)
    const pageSize = Math.max(1, Math.min(this.options.retmax, request.maxResults))
    const first = parseESearch(await this.request(
      this.buildUrl('esearch.fcgi', { term, retmax: pageSize, retstart: 0, retmode: 'json', sort: 'relevance' }),
      request.signal,
    ))
    const limit = Math.min(request.maxResults, first.count)
    const ids = [...first.ids]
    while (ids.length < limit) {
      const size = Math.min(pageSize, limit - ids.length)
      const page = parseESearch(await this.request(
        this.buildUrl('esearch.fcgi', { term, retmax: size, retstart: ids.length, retmode: 'json', sort: 'relevance' }),
        request.signal,
      ))
      if (page.ids.length === 0) break
      ids.push(...page.ids)
    }

    const uniqueIds = [...new Set(ids)].slice(0, limit)
    const records: PubmedRecord[] = []
    for (const batch of chunk(uniqueIds, Math.max(1, this.options.efetchBatchSize))) {
      const xml = await this.request(
        this.buildUrl('efetch.fcgi', { id: batch.join(','), retmode: 'xml', rettype: 'abstract' }),
        request.signal,
      )
      records.push(...parseEFetch(xml))
    }
    this.counters.papersFetched += records.length

    const result: PubmedSearchResult = {
      records: dedupePapers(records).papers,
      totalCount: first.count,
      ...first.queryTranslation === undefined ? {} : { queryTranslation: first.queryTranslation },
      warnings: first.warnings,
    }
    if (this.options.cacheTtlMs > 0) {
      this.cache.set(key, { expiresAt: this.now() + this.options.cacheTtlMs, value: result })
    }
    return result
  }

  /**
   * Fetch one paper by PMID.
   * @param pmid - PubMed identifier from a prior search or user input.
   * @param signal - Abort signal.
   * @returns the record, or `undefined` when PubMed has no such PMID.
   */
  async fetchByPmid(pmid: string, signal?: AbortSignal): Promise<PubmedRecord | undefined> {
    const xml = await this.request(
      this.buildUrl('efetch.fcgi', { id: pmid, retmode: 'xml', rettype: 'abstract' }),
      signal,
    )
    const records = parseEFetch(xml)
    this.counters.papersFetched += records.length
    return records[0]
  }
}
