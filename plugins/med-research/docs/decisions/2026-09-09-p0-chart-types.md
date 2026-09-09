# P0 chart type source-of-truth

## Problem

The handoff and Gate checklist described the P0 chart set as unspecified, which
made the statistics completion status ambiguous.

## Decision

The authoritative PRD explicitly names the P0 chart types in §26 and the
Statistics DoD in §36: **Histogram, Box Plot, Bar Chart, and Scatter**. The
P1 set is Forest Plot, ROC, Kaplan–Meier, and Correlation Heatmap. No product
choice is required for the names of the P0 types.

## Current implementation boundary

The statistics plugin now ships dependency-free SVG templates for all four P0
types (`packages/plugin-statistics/src/charts.ts`), and the client Statistics
view renders a real profile-level missing-values Bar Chart
(`packages/plugin-medical-ui/src/client/profile-chart.tsx`). The templates
consume only aggregate values and are covered by contract tests. They are not
yet wired into generated analysis Python or a Remote analysis-result view; that
integration remains an implementation gap. Any integration must preserve the
existing artifact provenance (`analysisRunId`, dataset hash, code hash, runtime)
and PNG/SVG export contract.

## Evidence

- [`docs/prd/med-research-workspace-ultimate-prd-v1.1.md`](../prd/med-research-workspace-ultimate-prd-v1.1.md#26-charts)
- [`docs/prd/med-research-workspace-ultimate-prd-v1.1.md`](../prd/med-research-workspace-ultimate-prd-v1.1.md#36-mvp-definition-of-done)
