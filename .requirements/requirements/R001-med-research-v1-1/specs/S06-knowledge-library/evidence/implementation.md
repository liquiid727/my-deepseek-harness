# Implementation Evidence — S06 Knowledge and Library

- Entry: PRD R001
- Spec: SPEC-R001-S06 / 1.1.0 / e601d8bd2a367d7c5e1755b32b3cb690c63f0e65319d00ccf1433e53f43eb5a1
- Status: implementation advanced in this round; NOT accepted. Structural checks pass; browser, independent QA and medical review are missing.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/medical-contracts/src/knowledge.ts` — `draftStatusSchema` becomes the spec lifecycle `DRAFT | REVIEWABLE | EXPORTED`; new `KnowledgeSearchResult.matchedField`; new `ProjectRagCandidate` / `ProjectRagAnswer`.
- `packages/medical-contracts/src/services.ts` — `MedKnowledgeService` gains `rag`, `memberships`; `setDraftStatus` is narrowed to `'DRAFT'`; new `SelectionAction` / `MedSelectionActionsService` (shared with S03).
- `packages/plugin-knowledge/src/service.ts` — Project RAG, explicit library scopes, tag-aware search with matched field, draft gating.
- `packages/plugin-knowledge/src/index.ts` — `knowledge_rag`, `knowledge_draft_invalidate` tools; provides `medDraftEditorActions`.
- `packages/plugin-knowledge/tests/knowledge.spec.ts` (new, 18 cases).
- `packages/plugin-knowledge/package.json` — adds the `dsh-medical-domain` workspace dependency.

## Implemented behavior

- **Project RAG (SPEC-R001-S06-004).** The corpus is the current Project's paper paragraphs, `VERIFIED` + located + un-withdrawn Evidence, and Notes. It is derived on every call from current storage rather than cached, so removing a membership immediately removes those sources from future answers; while a rebuild would be in progress there is no stale index to answer from. The answer carries `corpusVersion` (SHA-256 over the sorted corpus member identities), scored candidates, and citations; with no qualifying material it returns `INSUFFICIENT` with an explicit reason. Notes can locate a source but are excluded from `citations`, because a note is not a citable medical fact.
- **Library scopes (SPEC-R001-S06-001).** `currentProject` (default) shows only this Project's saved papers; `myLibrary` aggregates across accessible Projects; `uploaded` shows locally uploaded sources. The aggregation happens only under the explicit scope, so the default cannot widen by accident. `memberships(paperId)` exposes the per-row membership the spec requires.
- **Search (SPEC-R001-S06-003).** Results report the field that produced the match (title / author / PMID / abstract / note / tag / draft) and a tag match surfaces the objects the tag is attached to. An empty query returns the scope's listing instead of scanning the corpus.
- **Draft gating (SPEC-R001-S06-004).** `setDraftStatus` accepts only `DRAFT`. `REVIEWABLE` and `EXPORTED` are produced by S08 validation and export after every fact is re-verified; accepting them from a caller would let a client assert support it never proved. This was a real defect: the previous signature accepted any status.
- **Tag lifecycle (SPEC-R001-S06-002).** Names are trimmed and compared case-folded within one Project; rename keeps the identity; deleting a tag removes only the tag and its links.

## Spec deviations

- `Note` storage remains owned by S03 as the spec requires; this package aggregates Notes rather than storing a second copy.
- The knowledge index is computed on demand rather than maintained as a materialized FTS index. The spec allows this ("索引可重建，不是唯一数据源") and it is what makes membership removal immediately effective, but it means the `INDEX_REBUILDING` state is never reached in V1.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-knowledge
  → Test Files 1 passed (1) / Tests 18 passed (18)
     (default/myLibrary/uploaded scopes, memberships, matched-field search,
      empty-query listing, cross-project exclusion, tag matches,
      RAG answered/insufficient/corpus-version change/membership removal/
      unverified evidence excluded, setDraftStatus gating, draft revision
      conflict, tag rename+delete, duplicate tag, unknown project)
pnpm exec vitest run packages/medical-e2e/tests/composition.spec.ts
  → Test Files 1 passed (1) / Tests 7 passed (7)
pnpm run typecheck
  → exit 0
```

## Checks skipped

- Browser coverage for empty / populated / search / filter / detail / partial / narrow / keyboard / zh-en — not executed.
- Independent QA and medical review.

## Known limitations / residual risk

- RAG relevance is a lexical term count. It is honest and explainable but not a semantic ranker; the spec requires lexical FTS as the mandatory baseline only.
- The `setDraftStatus` narrowing is a breaking contract change; every caller was updated in this workspace, but any out-of-tree consumer must be updated too.

## Intentionally untouched

- The DSH checkout, S03 Note storage, the runner, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty. Acceptance stays `blocked`.
