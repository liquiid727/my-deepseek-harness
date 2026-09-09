# @medresearch/dsh-plugin-literature

English | [中文](README.zh.md)

## Summary

PubMed discovery for the Med Research Workspace. Provides `ctx.medLiterature`, registers `literature_plan_query` / `literature_search_pubmed` / `literature_get_paper`, and owns the NCBI E-utilities connector: request shaping, rate limiting, retry with backoff, pagination, a query-hash cache, XML/JSON parsing, and paper de-duplication. PMID and DOI always come from the PubMed response; the model never supplies them.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `tool` | required | NCBI tool identifier |
| `email` | required | NCBI contact address |
| `apiKeyEnv` | — | Environment variable holding the NCBI API key |
| `requestsPerSecond` | derived: 10 with a key, 3 without | Sustained request rate |
| `maxRetries` | `2` | Retries after the first attempt |
| `backoffBaseMs` | `1000` | Exponential backoff base |
| `timeoutMs` | `30000` | Per-request deadline |
| `retmax` | `20` | ESearch page size |
| `efetchBatchSize` | `200` | EFetch batch size |
| `cacheTtlMs` | `3600000` | Query-hash cache lifetime; `0` disables |
| `defaultMaxResults` | `20` | Page cap when a tool omits `maxResults` |

`apiKeyEnv` set but unset in the environment fails loud (`no API key for "…"`); it never silently falls back to the unauthenticated rate.

## Model Experience

- `literature_plan_query` returns the stored `ResearchQuery`; it issues no network request, so nothing reaches PubMed before the user confirms (FR-2).
- `literature_search_pubmed` returns `{ ok, result: { query, papers, totalCount, warnings, partialReason? } }`; a connector failure returns `{ ok: false, error: { code, retryable } }` instead of an empty list.
- `literature_get_paper` returns the stored paper or `PAPER_NOT_FOUND`.
- Every result is a JSON text block; papers carry connector-assigned `pmid`/`doi`.

## Known Limitations and Deferred Work

- The query plan is produced by the agent; the plugin never calls an LLM (see `docs/decisions/2026-09-08-phase2-literature-and-project.md`).
- The API key is read from the environment only; the credentials-service path is not wired yet.
- The cache is per-process memory; it is not shared across host processes.
- Europe PMC, Unpaywall, and OpenAlex resolvers are P1 (SPEC §21) and absent here.
- `papers` are persisted on every search; there is no retention policy yet.
