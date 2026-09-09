# @medresearch/dsh-plugin-evidence

English | [中文](README.zh.md)

## Summary

Evidence retrieval, deterministic location, and semantic verdict application (SPEC §24–§26). Provides `ctx.medEvidence` and registers `evidence_retrieve` / `evidence_save` / `evidence_verify` / `evidence_list_for_claim`. Locator status is computed from the paragraph; the model never supplies it, and a `NOT_FOUND` quote can never become `VERIFIED`.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `tolerance` | `0.05` | Max edit distance / window length for `PARTIAL` |
| `windowSize` | `8` | Max window-length deviation from the quote |
| `maxRetrieval` | `10` | Cap on retrieval units per call |

## Model Experience

- `evidence_retrieve` returns ranked chunks (ids + text) inside the project library; V1 is BM25 over chunks, vectors are P1.
- `evidence_save` returns the stored evidence with `locatorStatus` and `supportStatus`; provenance (`extractorVersion`/`extractorModel`/`promptVersion`) is required.
- `evidence_verify` applies the model's verdict, but `NOT_FOUND` always resolves to `REJECTED`.
- Results are JSON text blocks.

## Known Limitations and Deferred Work

- Retrieval is BM25 only; vector search and reranking are P1 (SPEC §24).
- Secondary-citation detection is not automatic: `sourceType` must be supplied by the caller (P1).
- `candidate.reason` from SPEC §25 has no field in the §11 Evidence model and is therefore not persisted; reported as an open question.
- `listForClaim` reads binding rows and fails loud when a binding names a missing evidence.
