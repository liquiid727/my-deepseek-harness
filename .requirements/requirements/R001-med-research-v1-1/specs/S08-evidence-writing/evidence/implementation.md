# Implementation Evidence — S08 Evidence-based Writing and Export

- Entry: PRD R001
- Spec: SPEC-R001-S08 / 1.1.0 / e4e3eaf3775d5bd8c6a16df56f4be21401280ba5ba2ef8d2ec96e3ab228aa54c
- Status: implementation advanced in this round; NOT accepted. Generation, revalidation, translation integrity and the three export formats now exist; model quality, browser evidence, independent QA and medical review are missing.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/plugin-writing/src/service.ts` — `generate`, `validate`, `translate` and `export` rewritten around the spec behaviours.
- `packages/plugin-writing/src/draft-actions.ts` (new) — S08 contributions to the S06 Draft-editor registry.
- `packages/plugin-writing/src/index.ts` — provides the draft-editor actions.
- `packages/plugin-writing/tests/service.spec.ts` (new, 20 cases).
- `packages/medical-contracts/src/knowledge.ts` — `draftStatusSchema` becomes `DRAFT | REVIEWABLE | EXPORTED`.

## Implemented behavior

- **Grounded generation (SPEC-R001-S08-001).** Every medical fact carries its internal Evidence references and takes the citation index from the S04-style first-appearance numbering rather than inventing one. Unsupported, stale, uncertain, or secondary evidence produces an explicit insufficiency entry in a Limitations block — never a definite statement — while the supported path still generates. Insufficiency is a reported business result, not a substitute for the positive path.
- **Revalidation and the Draft lifecycle (SPEC-R001-S08-001).** An edit that changes a fact, drops a reference, or un-references a fact returns the revision to `DRAFT` and blocks the completion export; heading/formatting-only edits keep verification. A stale citation is never preserved through a hidden old reference. `DRAFT → REVIEWABLE → EXPORTED` is now representable: the contract enum gained `EXPORTED` and a successful complete export records it.
- **Translation integrity (SPEC-R001-S08-002).** Blocks are compared pairwise, so heading count and block count changes are caught; within each block the numeric, unit, symbol and citation tokens are compared deterministically and a difference is reported as a translation mismatch. The source Draft and any existing translation are never overwritten.
- **Deterministic export (SPEC-R001-S08-003).** Every field comes from persisted Paper metadata. A missing title raises `METADATA_INCOMPLETE`; a missing author or year is omitted per format rules and reported in warnings. Papers are de-duplicated in the selected order. Braces, newlines and Markdown characters are escaped. RIS uses `TY/AU/TI/JO/PY/DO/UR/ER`, BibTeX is an `article` entry with a stable `paper-<id>` key, and Markdown emits the citation index, bibliography and source links. `complete` requires a `REVIEWABLE` draft with still-resolvable citations and raises `CITATION_STALE` otherwise, publishing nothing; `preview` is explicitly marked incomplete and keeps its missing reasons. A bibliography-only export does not require a claim but still uses only real metadata.

## Spec deviations

- `generate` composes the body from the verified evidence text and the user's outline rather than from a model writing pass; the model turn that produces prose is not wired, so the "Literature Review Writer" skill's prose quality is unmeasured.
- `translate` validates a supplied translation. It does not itself call a translation model, and the bilingual pair is retained by not overwriting storage rather than by a dedicated dual-text field.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-writing
  → Test Files 1 passed (1) / Tests 20 passed (20)
     (supported / conflicting / missing evidence, citation stability, edits that
      re-enter DRAFT, un-referencing blocking REVIEWABLE, bilingual number / unit /
      symbol / citation preservation, mismatched translation, three export formats,
      missing-title METADATA_INCOMPLETE, missing author/year omitted + warned,
      escaping, dedupe order, CITATION_STALE on complete export, preview marked
      incomplete)
pnpm exec vitest run packages/medical-e2e/tests/composition.spec.ts
  → Test Files 1 passed (1) / Tests 7 passed (7)
     (asserts ctx.medDraftEditorActions.missing() === [] and the four ids)
pnpm run typecheck
  → exit 0
```

## Checks skipped

- Unsupported Claim Rate on the Gold Set and the medical reviewer's sampled-Draft check — no dataset, no reviewer, no model credentials.
- Browser coverage for editor, citation inspector, translation, incomplete preview, export and narrow viewport — not executed.
- Independent QA.

## Known limitations / residual risk

- Draft and translation quality depend on the model turn that is not wired in this environment; only the grounding, revalidation and export machinery are machine-verified.
- The `EXPORTED` status is written by the writing service, while S06 owns the Draft record. The lifecycle is correct in the composed profile but crosses the package boundary, which is worth noting for review.

## Intentionally untouched

- The DSH checkout, S06 Draft storage ownership, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty. Acceptance stays `blocked`.
