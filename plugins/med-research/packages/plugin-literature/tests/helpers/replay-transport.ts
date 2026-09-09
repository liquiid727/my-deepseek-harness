/**
 * Deterministic HTTP double for connector tests. It stands in for the network
 * boundary only: request shaping, pagination, retry, rate limiting, parsing,
 * and de-duplication all run as production code.
 * @module @medresearch/dsh-plugin-literature/tests/helpers/replay-transport
 */

import { readFileSync } from 'node:fs'
import type { HttpGetResponse } from '../../src/pubmed/connector.ts'

/** One canned response keyed by a URL predicate. */
export interface ReplayRoute {
  /** Matches the request URL. */
  test: (url: URL) => boolean
  /** Response body. */
  body?: string
  /** HTTP status; defaults to 200. */
  status?: number
  /** Delay before responding, used to exercise the request deadline. */
  delayMs?: number
}

/** Read one recorded fixture beside this suite. */
export function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/pubmed/${name}`, import.meta.url), 'utf8')
}

/** Replays {@link ReplayRoute} responses and records every requested URL. */
export class ReplayTransport {
  /** URLs requested, in order. */
  readonly calls: string[] = []

  /**
   * @param routes - Routes tried in order; the first match answers.
   */
  constructor(private readonly routes: ReplayRoute[]) {}

  /** Number of requests made. */
  get count(): number {
    return this.calls.length
  }

  async get(url: string, signal?: AbortSignal): Promise<HttpGetResponse> {
    this.calls.push(url)
    const parsed = new URL(url)
    const route = this.routes.find(candidate => candidate.test(parsed))
    if (route === undefined) throw new Error(`no replay route for ${url}`)
    if (route.delayMs !== undefined) await this.delay(route.delayMs, signal)
    return { status: route.status ?? 200, body: route.body ?? '' }
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms)
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(signal.reason)
      }, { once: true })
    })
  }
}

/** A route matching one ESearch `retstart` value. */
export function esearchPage(retstart: number, body: string): ReplayRoute {
  return {
    test: url => url.pathname.endsWith('/esearch.fcgi') && url.searchParams.get('retstart') === String(retstart),
    body,
  }
}

/** A route matching any EFetch call. */
export function efetch(body: string): ReplayRoute {
  return { test: url => url.pathname.endsWith('/efetch.fcgi'), body }
}
