/**
 * Full-text resolution (SPEC §21). V1 resolves the machine-readable channel
 * from the paper's PMCID and falls back to `abstract_only` or `unavailable`
 * with the paper's own metadata; it never claims a channel it did not check.
 * `unavailable` is a real outcome, not an error.
 * @module @medresearch/dsh-plugin-fulltext/src/resolver
 */

import type { FulltextResolution, MedFulltextService, Paper } from '@medresearch/dsh-medical-contracts'

/** One HTTP GET result as the resolver needs it. */
export interface FetchTextResult {
  status: number
  body: string
}

/** Injected transport. */
export type FetchText = (url: string, signal?: AbortSignal) => Promise<FetchTextResult>

/** Resolver tunables. */
export interface FulltextResolverOptions {
  /** Europe PMC REST base, without a trailing slash. */
  europePmcBaseUrl: string
  /** Injected transport. */
  fetchText: FetchText
}

/** Full-text resolution over the allowed machine-readable channels. */
export class FulltextResolver implements MedFulltextService {
  /**
   * @param options - Base URL and transport.
   */
  constructor(private readonly options: FulltextResolverOptions) {}

  /**
   * Resolve one paper's full text.
   * @param paper - Paper whose identifiers drive the channel choice.
   * @returns `available` with a machine-readable URL, `abstract_only` when the
   * machine-readable channel is absent or unreachable but an abstract exists,
   * otherwise `unavailable`.
   */
  async resolve(paper: Paper): Promise<FulltextResolution> {
    const fallback: FulltextResolution = paper.abstract === undefined || paper.abstract.trim() === ''
      ? { status: 'unavailable' }
      : { status: 'abstract_only' }
    if (paper.pmcid === undefined || paper.pmcid.trim() === '') return fallback

    const url = `${this.options.europePmcBaseUrl}/${paper.pmcid.trim()}/fullTextXML`
    const response = await this.options.fetchText(url)
    if (response.status !== 200 || response.body.trim() === '') return fallback
    return { status: 'available', source: 'europe_pmc', url, machineReadable: true }
  }
}
