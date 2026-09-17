# Implementation Evidence - S05 Reproducible Statistics

- Entry: PRD R001
- Spec: SPEC-R001-S05 / 2.1.0 / 86e828a36ac5a0ac134d23fd0ad35347e52195945da468e5c4b84d1473f7c4e6
- Status: implementation advanced in this round; NOT accepted. All seven chart types and the project-scoped history surface now exist; browser evidence and the isolation/browser matrix are incomplete.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/plugin-statistics/src/charts.ts` — Forest Plot, ROC, Correlation and Kaplan-Meier templates; `chartApplicability`; `assertSafeSvg`; `assertPublishableChart`.
- `packages/plugin-statistics/src/service.ts` — `getRun` becomes the in-process `peekRun`, plus Remote `run` and `listCharts`.
- `packages/medical-contracts/src/services.ts` — `MedStatisticsService` gains `run` and `listCharts`.
- `packages/plugin-statistics/tests/charts-p1.spec.ts` (new, 15 cases).
- `packages/plugin-medical-ui/src/client/remote.ts` — statistics `run` / `listCharts`.
- `packages/medical-e2e/tests/*` — call sites renamed to `peekRun`; the pinned Remote surface updated.

## Implemented behavior

- **Seven chart types (SPEC-R001-S05-004).** Histogram, Box Plot, Scatter, Bar (existing) plus Forest Plot, ROC, Correlation, Kaplan-Meier. Each new template validates its own invariants before rendering: a forest interval must satisfy `lower ≤ estimate ≤ upper` on a positive ratio scale; ROC points must lie in the unit square with an AUC in `[0, 1]`; correlation coefficients must be in `[-1, 1]` with a positive integer sample size and the method and sample size are printed; Kaplan-Meier times must be ordered and non-negative with survival in `[0, 1]`.
- **Disable-with-reason.** `chartApplicability(spec, context)` returns `{ applicable: false, reason }` for a chart that does not apply — mixed effect scales for a forest plot, a non-binary outcome or missing predicted probabilities for ROC, fewer than two numeric variables for a correlation matrix, missing survival columns for Kaplan-Meier. The spec requires the inapplicable case to be explained rather than rendered empty, and to be a narrow set rather than a blanket disable; the rules are exactly the ones the spec names.
- **Publication safety.** `assertSafeSvg` rejects a rendered chart containing a script element, a `foreignObject`, an inline event handler, or any external reference (`href`/`xlink:href`/`url()` not starting with `#`); `assertPublishableChart` rejects a chart with no analysis-run identity or a hash that does not match the rendered bytes. Both run before publication, which is the point of no return for a statistical artifact.
- **History surface (SPEC-R001-S05-004).** `listCharts(projectId)` returns artifacts belonging to `succeeded` runs only, so a failed or cancelled run can never contribute a figure the UI would show as a result; `run(id)` exposes one run with its input versions to the authenticated client.

## Spec deviations

- `chartApplicability` is implemented and unit-tested but the Statistics Lab view does not yet call it; the disable-with-reason behaviour is therefore contract-verified, not yet UI-verified.
- The four new chart types render but are not yet produced by any generated analysis. `statistics_generate_code` still emits code chosen by the model; a chart is published only when that code writes the corresponding output.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-statistics
  → Test Files 4 passed (4) / Tests 32 passed (32)
     (tests/charts-p1.spec.ts 15 new cases: forest render/reject/scale mix,
      ROC render/reject/disable reasons, correlation render/reject/needs two
      numeric, KM render/reject/needs survival columns, SVG safety for script,
      handler, foreignObject and external reference, publishable-chart checks)
pnpm run typecheck
  → exit 0
```

## Checks skipped

- Browser evidence for plan / waiting / executing / success / failure / tabs / charts / export and 390×844 — not executed.
- The runner isolation matrix beyond the existing `process-runner.spec.ts` (20 cases, 1 skipped) — not extended this round.
- Real-API e2e — `DEEPSEEK_API_KEY` is not present.

## Known limitations / residual risk

- `chartApplicability` is not wired into the view, so the "disabled with a reason" requirement is not yet satisfied end to end.
- The interpretation step (`INTERPRETATION_FAILED`, retry-without-rerun) was not re-examined this round and remains as previously implemented.
- Adding `run`/`listCharts` to the Remote surface changed the pinned surface; the browser client was updated alongside it.

## Intentionally untouched

- The isolated runner implementation, the dataset/XLSX parsers, the DSH checkout, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty. Acceptance stays `blocked`.
