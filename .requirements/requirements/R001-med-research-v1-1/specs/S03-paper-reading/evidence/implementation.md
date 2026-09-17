# Implementation Evidence - S03 Paper Reading

- Entry: PRD R001
- Spec: SPEC-R001-S03 / 2.1.0 / d94d55975c100da1c28fa503b93dd61888c582b3dccac635aba5f0e731be5ff4
- Status: implementation advanced in this round; NOT accepted. The Reader action registry and the structured summary now exist; browser evidence, independent QA and medical review are missing.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/medical-contracts/src/services.ts` — `PaperSummary` gains `fields` and the `PAPER_SUMMARY_FIELD_KEYS` list; `MedPapersService.summary` now takes `projectId` so a summary field can carry a project-scoped anchor; new `SelectionAction` / `SelectionActionRequest` / `SelectionActionResult` / `MedSelectionActionsService`.
- `packages/medical-domain/src/selection-actions.ts` (new) — `SelectionActionRegistry`, `REQUIRED_READER_ACTIONS`, `REQUIRED_DRAFT_EDITOR_ACTIONS`.
- `packages/medical-domain/src/index.ts` — exports the registry.
- `packages/plugin-paper/src/service.ts` — `summary` rewritten around the spec field list; new `summaryFieldSections`.
- `packages/plugin-paper/src/reader-actions.ts` (new) — the two S03-owned reader actions.
- `packages/plugin-paper/src/index.ts` — provides `medReaderActions` and requires the six reader action ids.
- `packages/plugin-paper/src/tools.ts` — `paper_summary` gains `projectId`.
- `packages/plugin-paper/tests/summary.spec.ts` (new, 5 cases).
- `packages/medical-domain/tests/selection-actions.spec.ts` (new, 8 cases).
- `packages/plugin-medical-ui/src/client/remote.ts` — `summary` signature; `medReaderActions` is available to the client half.

## Implemented behavior

- **Reader action registry (SPEC-R001-S03-004, interfaces.md).** S03 owns the registry (`medReaderActions`); a contribution declares a stable id, order, dictionary label key, and whether it needs a selection; `register` returns the disposer; `invoke` reports `SUCCEEDED | FAILED | CANCELLED` with an opaque reference. S03 requires the six ids a V1 profile must carry, so a profile that lacks one reports a *dependency diagnostic* through `missing()` instead of rendering a dead control. Verified in the real composition: all six ids are present.
- **Structured summary (SPEC-R001-S03-002).** `summary` now covers the spec's field list in the spec's order — research question, study design, population, sample size, intervention/exposure, comparator, outcome, methods, statistics, key results, effect size, conclusion, limitations, bias, project relevance, references. A field the document does not report is emitted with the literal `未报告` and `reported: false` (and listed in `missingFields`); a reported field carries the exact paragraph anchor it came from. The three-minute mode emits the five fields the spec names in the spec's order, and the one-sentence mode is derived from the source text.
- **Selection commands refuse unlocatable input.** `reader.save-evidence` refuses a selection without a stored paragraph instead of saving an unverifiable quote, and a quote the locator cannot place is reported as failed rather than accepted.

## Spec deviations

- `summary` now takes `projectId`. The anchor type is project-scoped, so the previous signature could not express a valid anchor at all; the alternative (guessing the project from memberships) would have been dishonest when a paper is saved in more than one project.
- Field extraction matches on section titles. That is deliberately conservative: an unusual layout yields `未报告` rather than a guess. A model-backed extractor can replace `summaryFieldSections` without changing the contract. Effect sizes are therefore only reported when the document has a results-style section.
- The reader action registry is a domain-level registry rather than a DSH client slot; the client half consumes it through the service, which keeps the contribution direction one-way as interfaces.md requires.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-paper
  → Test Files 4 passed (4) / Tests 19 passed (19)
     (tests/summary.spec.ts 5 new cases: field list and order, values + anchors,
      unreported marker without a guess, three-minute order, one-sentence text)
pnpm exec vitest run packages/medical-domain
  → Test Files 7 passed (7) / Tests 49 passed (49)
     (tests/selection-actions.spec.ts 8 new cases: ordering, selection filter,
      dispose + restore, idempotent dispose, unknown/selection-required errors,
      required-id diagnostics, required id list)
pnpm exec vitest run packages/medical-e2e/tests/composition.spec.ts
  → Test Files 1 passed (1) / Tests 7 passed (7)
     (asserts ctx.medReaderActions.missing() === [] and the exact six ids)
pnpm run typecheck
  → exit 0
```

## Checks skipped

- Browser evidence for the full Reader and the Research right-hand Reader at 1672×941, 1440×900 and 390×844, including selection toolbar placement, zoom, reading modes, stale anchor and abstract-only states — not executed.
- Reader PDF/PMC parse-failure and translation-failure screens — not executed.
- Independent QA and medical review.

## Known limitations / residual risk

- The summary is a deterministic section-title projection, not a model extractor; several spec fields (sample size, effect size, bias) will read `未报告` for most documents until a model-backed pass exists.
- The selection toolbar and its keyboard equivalent are a client concern and were not re-verified in a browser this round.

## Intentionally untouched

- The DSH checkout, the full-text resolver, PDF/JATS parsers, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty. Acceptance stays `blocked`.
