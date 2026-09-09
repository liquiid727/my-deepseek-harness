/**
 * Plugin configuration for the PubMed connector (SPEC §19). Every deployment-
 * varying value is a validated `Config` field; the only derived value —
 * the sustained request rate — is resolved explicitly from whether an API key
 * is present, never hidden inside the request path.
 * @module @medresearch/dsh-plugin-literature/src/config
 */

import z from '@deepseek-ai/schemastery'
import type { PubmedConnectorOptions } from './pubmed/connector.ts'

/** Raw plugin configuration. */
export interface Config {
  /** E-utilities base URL, without a trailing slash. */
  baseUrl?: string
  /** NCBI tool identifier required by the E-utilities usage policy. */
  tool: string
  /** NCBI contact address required by the E-utilities usage policy. */
  email: string
  /** Environment variable holding the NCBI API key. */
  apiKeyEnv?: string
  /** Sustained requests per second; resolved from the API-key allowance when absent. */
  requestsPerSecond?: number
  /** Retries after the first attempt for retryable failures. */
  maxRetries?: number
  /** Base delay for exponential backoff, in milliseconds. */
  backoffBaseMs?: number
  /** Per-request deadline in milliseconds. */
  timeoutMs?: number
  /** ESearch page size. */
  retmax?: number
  /** EFetch batch size. */
  efetchBatchSize?: number
  /** Query-hash cache lifetime in milliseconds; `0` disables caching. */
  cacheTtlMs?: number
  /** Page cap when a tool call omits `maxResults`. */
  defaultMaxResults?: number
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  baseUrl: z.string().default('https://eutils.ncbi.nlm.nih.gov/entrez/eutils'),
  tool: z.string().required(),
  email: z.string().required(),
  apiKeyEnv: z.string().role('credential-ref'),
  requestsPerSecond: z.number().min(0.1).max(100),
  maxRetries: z.number().step(1).min(0).max(10).default(2),
  backoffBaseMs: z.number().step(1).min(0).default(1_000),
  timeoutMs: z.number().step(1).min(1).default(30_000),
  retmax: z.number().step(1).min(1).max(10_000).default(20),
  efetchBatchSize: z.number().step(1).min(1).max(500).default(200),
  cacheTtlMs: z.number().step(1).min(0).default(3_600_000),
  defaultMaxResults: z.number().step(1).min(1).default(20),
})

/** Effective connector settings after resolution. */
export interface ResolvedLiteratureConfig {
  /** Connector options, including the resolved API key when one is configured. */
  pubmed: PubmedConnectorOptions
  /** Page cap applied when a tool call omits `maxResults`. */
  defaultMaxResults: number
}

/** NCBI's documented allowance without an API key, in requests per second. */
const RATE_WITHOUT_KEY = 3
/** NCBI's documented allowance with an API key, in requests per second. */
const RATE_WITH_KEY = 10

/**
 * Resolve the effective connector settings.
 *
 * The API key is read from the environment variable named by `apiKeyEnv`; a
 * missing variable is not an error (E-utilities works unauthenticated at a
 * lower rate). `requestsPerSecond` is taken from configuration when set,
 * otherwise derived from the presence of a key.
 * @param config - Validated plugin configuration.
 * @param env - Environment lookup; injectable for tests.
 * @returns connector options and the default result cap.
 * @throws Error when `apiKeyEnv` is set but names an empty variable, so a
 * misconfigured key never silently degrades to the unauthenticated rate.
 */
export function resolveLiteratureConfig(
  config: Config,
  env: (name: string) => string | undefined,
): ResolvedLiteratureConfig {
  const resolved = config as Required<Omit<Config, 'apiKeyEnv' | 'requestsPerSecond'>> & Config
  const keyName = config.apiKeyEnv
  const apiKey = keyName === undefined ? undefined : env(keyName)
  if (keyName !== undefined && (apiKey === undefined || apiKey === '')) {
    throw new Error(`no API key for "${keyName}"`)
  }
  const requestsPerSecond = config.requestsPerSecond ?? (apiKey === undefined ? RATE_WITHOUT_KEY : RATE_WITH_KEY)
  return {
    pubmed: {
      baseUrl: resolved.baseUrl,
      tool: resolved.tool,
      email: resolved.email,
      ...apiKey === undefined ? {} : { apiKey },
      requestsPerSecond,
      maxRetries: resolved.maxRetries,
      backoffBaseMs: resolved.backoffBaseMs,
      timeoutMs: resolved.timeoutMs,
      retmax: resolved.retmax,
      efetchBatchSize: resolved.efetchBatchSize,
      cacheTtlMs: resolved.cacheTtlMs,
    },
    defaultMaxResults: resolved.defaultMaxResults,
  }
}
