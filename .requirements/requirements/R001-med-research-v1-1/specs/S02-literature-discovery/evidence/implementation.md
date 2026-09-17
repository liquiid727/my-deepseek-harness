# Implementation Evidence - S02 Literature Discovery

- Entry: PRD R001
- Spec: SPEC-R001-S02 / 2.1.0 / 79809d3272192f4fb499282875e200016dc1c7daa01aefa3b729aa749c72d1f6
- Status: implementation advanced in this round; NOT accepted. Structural checks pass; retrieval-quality thresholds, browser evidence, independent QA and medical review are missing.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/plugin-literature/src/service.ts` — rewritten: real filter trace, Study Type / Full Text / language filtering, injectable AI rerank with explicit degradation, frozen search runs with opaque cursor paging, counter/related provenance.
- `packages/plugin-literature/src/tools.ts` — the new search inputs and result metadata.
- `packages/plugin-literature/tests/literature-gaps.spec.ts` (new), `tests/dedup.spec.ts` (new).
- `packages/medical-e2e/tests/*` — `researchQueryRevision` call sites made type-correct.

## Implemented behavior

- **Filter trace records real exclusion reasons (SPEC §8).** Each frozen candidate carries `included` plus the reasons it was excluded by year, Study Type, or Full Text. The previous implementation emitted a synthetic `TOP_20_CAP` marker indexed by position, which could not explain an exclusion at all.
- **Study Type and Full Text filters.** Study Type compares against PubMed publication types and reports unknown values as `STUDY_TYPE_UNKNOWN` rather than silently passing them; Full Text is `ANY` / `AVAILABLE`, where `AVAILABLE` requires a resolved readable source and an Abstract alone does not qualify.
- **AI rerank with explicit degradation.** The reranker is an injectable capability, so tests drive its success and each failure path. The result carries `degraded` and a `degradationReason`; an invalid model, duplicate ids, or a missing score degrades the whole ranking to lexical order and says so — it never falls back silently.
- **Frozen search runs and cursor paging (SPEC §8).** `search` freezes at most 100 unique candidates with their filter trace and original rank, persists the run, and returns a page plus an opaque `nextCursor`. Paging resolves against the same frozen run, so turning a page can never widen the network query. PubMed's `totalCount` and the local `localCandidateCount` are reported separately.
- **Approval gating on every network path.** `search`, `counterSearch` and `relatedSearch` all refuse without a current approved plan revision for the same Project; editing a plan clears its approval. Counter and related searches carry their own provenance, and related searches additionally carry relationship/source/query identity.
- **Dedup.** `tests/dedup.spec.ts` pins the spec order — exact PMID, normalized DOI, normalized title plus publication year — including that the same title in a different year is not merged.

## Spec deviations

- Related Papers reuse the declared literature connector rather than a separate PubMed related-link connector; the result still carries relationship/source/query identity, but the connector itself is not a distinct declared capability.
- The rerank capability is injected but not yet supplied by the profile, so the live profile runs lexical order and reports it as degraded rather than pretending to be AI-ranked.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-literature
  → Test Files 4 passed (4) / Tests 45 passed (45)
pnpm run typecheck
  → exit 0
```

## Checks skipped

- Recall@20 / Precision@20 / Counter Evidence Miss Rate — the thresholds and the Gold Set are not frozen, and there are no model credentials.
- Browser evidence for query edit/approval, results, partial, empty, failure and narrow viewport against `asset/搜索研究.png` — not executed.
- Live NCBI calls — the suite runs on recorded fixtures only.

## Known limitations / residual risk

- Retrieval quality is unmeasured: the spec makes Recall@20, Precision@20 and Counter Evidence Miss Rate blocking, and none can be computed without a reviewer-frozen dataset.
- The AI rerank is contract-complete but has no producer in the composed profile, so `degraded: true` is the expected live state today.

## Intentionally untouched

- The PubMed connector internals, the DSH checkout, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty. Acceptance stays `blocked`.
