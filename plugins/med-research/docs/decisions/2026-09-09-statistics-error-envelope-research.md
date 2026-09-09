# Statistics tool error-envelope research

- Status: implemented and verified
- Date: 2026-09-09
- Scope: `statistics_plan`, `statistics_generate_code`, and precondition failures in `statistics_execute`, with emphasis on SPEC §46

## Primary sources

The repository's standing source-of-truth rule names the PRD and SPEC as authoritative ([`AGENTS.md`](../../AGENTS.md#1-事实来源-source-of-truth)). The relevant first-party sources are:

- [`docs/spec/med-research-workspace-ultimate-spec-v1.1.md`](../spec/med-research-workspace-ultimate-spec-v1.1.md#46-错误模型), lines 1175–1198.
- [`docs/prd/med-research-workspace-ultimate-prd-v1.1.md`](../prd/med-research-workspace-ultimate-prd-v1.1.md#24-statistical-execution), lines 677–701, and §32 lines 837–855.
- [`packages/medical-contracts/src/errors.ts`](../../packages/medical-contracts/src/errors.ts#L11-L56), the implemented stable code enum and strict schema.
- [`packages/medical-contracts/src/tool-envelope.ts`](../../packages/medical-contracts/src/tool-envelope.ts#L22-L45), the implemented model-facing tool envelope.
- [`packages/plugin-statistics/src/index.ts`](../../packages/plugin-statistics/src/index.ts#L70-L126), the two tool definitions.
- [`packages/plugin-statistics/src/service.ts`](../../packages/plugin-statistics/src/service.ts#L32-L157), service-side failure causes (including the concurrent typed `StatisticsError` edit).
- [`packages/medical-e2e/tests/composition.spec.ts`](../../packages/medical-e2e/tests/composition.spec.ts#L357-L422), the executable envelope matrix and its current statistics assertions.

## Contract extracted from SPEC/PRD

1. SPEC §46 defines `DomainError` as:

   ```ts
   {
     code: string
     message: string
     retryable: boolean
     partialDataAvailable: boolean
     source?: string
     details?: unknown
   }
   ```

   The statistics-specific key codes named by the SPEC are `STATISTICS_PLAN_INVALID`, `CODE_EXECUTION_TIMEOUT`, and `CODE_EXECUTION_FAILED`. The SPEC does not define a separate run-not-found code.

2. Every model-facing Tool is required to have a canonical machine-readable output (SPEC §6). The repository's shared implementation makes the intended shape explicit: exactly one success/failure branch, `{ ok: true, result }` or `{ ok: false, error }`; `error` is a `DomainError` object ([`tool-envelope.ts`](../../packages/medical-contracts/src/tool-envelope.ts#L22-L35)). A failed call must therefore be a value envelope, not a registry-level `isError`/uncoded exception.

3. The PRD requires truthful failure handling: runner failure sets `AnalysisRun.status = FAILED`, keeps the real failure visible, and must not produce a statistical conclusion ([PRD §24](../prd/med-research-workspace-ultimate-prd-v1.1.md#24-statistical-execution), lines 697–701; §32 items 11–14). This reinforces that planning/code-generation failures cannot be represented as an empty success.

## Current implementation evidence

- At the initial source scan, both tools validated ids/plan and directly called their service methods, returning only `{ ok: true, result }`; this was the gap recorded by the handoff/checklist. The live tree now contains a concurrent adapter edit that catches only `StatisticsError` and maps it to the standard failure envelope ([`index.ts`](../../packages/plugin-statistics/src/index.ts#L70-L126)).
- The concurrent service change introduces typed causes: missing dataset is `StatisticsError('DATASET_NOT_FOUND', ...)`; missing run or a non-`planned` run is `StatisticsError('STATISTICS_PLAN_INVALID', ...)`, with id/status details ([`service.ts`](../../packages/plugin-statistics/src/service.ts#L32-L49), [`service.ts`](../../packages/plugin-statistics/src/service.ts#L84-L96), [`service.ts`](../../packages/plugin-statistics/src/service.ts#L135-L157)). These codes are present in the shared enum (`DATASET_NOT_FOUND` and `STATISTICS_PLAN_INVALID`) ([`errors.ts`](../../packages/medical-contracts/src/errors.ts#L11-L38)).
- The composed-runtime test was likewise updated in the live tree to assert `isError === false` and stable codes for the two statistics failures ([`composition.spec.ts`](../../packages/medical-e2e/tests/composition.spec.ts#L413-L423)); this is the executable evidence that should remain green after the adapter edit.
- `statistics_execute` now uses the same typed `STATISTICS_PLAN_INVALID` cause for an unknown or non-`approved` run; runner failures remain successful tool calls with `result.status = "failed"`, preserving the real stderr/result omission contract.

## Required mapping for the tool layer

The narrow, source-backed mapping for the current two failure cases is:

| Tool situation | Stable `error.code` | `retryable` | `partialDataAvailable` | `source` | Suggested `details` |
|---|---|---:|---:|---|---|
| `statistics_plan` references an unknown dataset | `DATASET_NOT_FOUND` (implemented enum; the SPEC's generic statistics planning code is not as precise) | `false` | `false` | `statistics` | `{ datasetId }` |
| `statistics_generate_code` references an unknown run | `STATISTICS_PLAN_INVALID` | `false` | `false` | `statistics` | `{ analysisRunId }` |
| `statistics_generate_code` references a run whose status is not `planned` | `STATISTICS_PLAN_INVALID` | `false` | `false` | `statistics` | `{ analysisRunId, status }` |
| `statistics_execute` references an unknown or non-`approved` run | `STATISTICS_PLAN_INVALID` | `false` | `false` | `statistics` | `{ analysisRunId, status? }` |

`message` should preserve the service diagnostic text. `source` and `details` are optional under §46, but including them follows the existing domain-tool mapping convention (for example dataset/literature tools) and makes the failure actionable without changing the stable discriminant.

The catch should be narrow: map `StatisticsError` to the envelope and rethrow unknown errors. Parameter/schema parse failures happen before the service call and remain registry validation failures unless a separate contract is intentionally added; do not silently convert arbitrary exceptions into a guessed domain code.

## Verification

- `pnpm exec vitest run packages/medical-e2e/tests/composition.spec.ts packages/plugin-statistics/tests/statistics.spec.ts` → 2 files / 14 tests passed.
- `pnpm exec vitest run packages/medical-e2e/tests/install-profile.spec.ts packages/medical-e2e/tests/composition.spec.ts` → 2 files / 8 tests passed.
- `pnpm run typecheck` → exit code 0.
- Initial implementation baseline: `pnpm run test` → 44 files / 242 tests passed; `pnpm run verify:client` passed. The current workspace baseline is 45 files / 249 tests after chart and artifact regressions were added.

## Shared envelope schema hardening

The shared `TOOL_ENVELOPE_SCHEMA` now uses the DSH-supported exact-one `oneOf` form. Each branch marks its own fields (`ok` plus `result`, or `ok` plus `error`) as required properties, and `additionalProperties: false` rejects mixed or incomplete envelopes. `const` on `ok` keeps the success and failure branches disjoint. The regression test at `packages/medical-contracts/tests/tool-envelope.spec.ts` exercises both valid branches and malformed/mixed values.

## Tests and documentation needed

1. The two planning entries in the composed-runtime matrix assert `isError === false` and the exact envelope/code above, including required `DomainError` fields (`message`, boolean `retryable`, boolean `partialDataAvailable`, and `source`).
2. A unit test now covers the non-`planned` transition (plan → generate code → generate code again), proving `STATISTICS_PLAN_INVALID` is stable, not only the unknown-run case.
3. Keep service tests for domain causes, but distinguish service exceptions from model-facing envelopes; the service API may continue throwing typed `StatisticsError` while the tool adapter translates it.
4. The statistics gap rows in [`docs/HANDOFF.md`](../HANDOFF.md#下一步新会话从这里开始) and [`docs/checklists/gate-evidence.md`](../checklists/gate-evidence.md) now point to the executable evidence; the gate is not marked complete from schema existence alone.

## Decision boundary

§46 supplies the envelope shape and `STATISTICS_PLAN_INVALID`; the repository's existing enum and concurrent service edit supply the more precise `DATASET_NOT_FOUND` choice. No source authorizes a new `RUN_NOT_FOUND` code. If a future requirement wants a different mapping, it must update the SPEC/PRD and `DOMAIN_ERROR_CODES` together, plus the envelope matrix.
