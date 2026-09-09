# @medresearch/dsh-medical-domain

English | [中文](README.zh.md)

## Summary

`@medresearch/dsh-medical-domain` is the pure logic layer of the Med Research Workspace: paragraph normalization, quote alignment, the evidence status machine, paper de-duplication, and the Citation Gate. It has no DSH dependency and performs no IO, so the same functions run in host plugins, tests, and (later) worker processes. Every deployment-varying tunable is a parameter, never a module constant.

## Scope

| Module | Responsibility | Spec |
|---|---|---|
| `normalize.ts` | `normalizeParagraph` — the fixed six-step normalization that produces the offset base | §22.3 |
| `alignment.ts` | `alignQuote` — exact → `FOUND`, sliding-window edit distance → `PARTIAL`, else `NOT_FOUND` | §22.3 |
| `evidence-state.ts` | `assertEvidenceStatusPair` / `applyLocatorResult` — `VERIFIED ⇒ FOUND|PARTIAL`, `NOT_FOUND ⇒ REJECTED` | §11 |
| `dedup.ts` | `paperIdentityKey` / `dedupePapers` — PMID → DOI → PMCID → normalized(title + year) | §20, FR-4 |
| `claim-gate.ts` | `verifyClaim` — the SPEC §28 Citation Gate with stable reason codes | §28, FR-12–FR-14 |

`AlignmentOptions.tolerance` and `.windowSize` are required arguments; the domain layer supplies no default, so the owning plugin must resolve them from a validated `Config` (AGENTS.md §4).

## Model Experience

### What the model sees

Nothing directly. The functions return machine-readable results; a model sees them only when an owning plugin puts them in a tool result or a logged session event.

### Token effect

Zero on its own.

### KV Cache effect

Independent.

## Known Limitations and Deferred Work

- `alignQuote` scans window lengths in `[quote.length - windowSize, quote.length + windowSize]` with a bounded Levenshtein distance; very large paragraphs with a large `windowSize` cost more, so the plugin that wires it must pick a bounded configuration.
- `verifyClaim` treats "semantic direction correct" as the stored `supportStatus === 'VERIFIED'`; the semantic judgement itself belongs to the verifier (model + human Gold Set, SPEC §53) and is out of scope here.
- Normalization follows SPEC §22.3 literally, including mapping `’` to `"`; a quote typed with an ASCII apostrophe therefore only matches after the same normalization.
- `package.json` exports `src/index.ts` (source plane); the published `lib/` build lands in phase 8.
