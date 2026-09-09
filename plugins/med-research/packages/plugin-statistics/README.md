# @medresearch/dsh-plugin-statistics

English | [中文](README.zh.md)

## Summary

Phase 5 component of the Med Research Workspace. Persists analysis plans, generates code, and executes approved runs through the isolated runner. See `docs/decisions/2026-09-08-phase5-statistics.md` for the design and isolation decisions.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `timeoutMs` | `120000` | Wall-clock limit per execution |
| `cpuSeconds` | `60` | CPU-second limit passed to the runner |
| `memoryMb` | `1024` | Address-space limit |
| `maxOutputBytes` | `200000` | Captured stdout+stderr cap |
| `allowlist` | `[]` | Third-party packages generated code may import |
| `artifactRoot` | required | Durable directory a run's outputs are copied into before artifact registration |

`allowlist` is fail-closed: stdlib modules are always importable, everything else needs a name here. The runner environment must also have the listed packages installed; an absent package fails the run loudly at import time. PRD §34 names the V1 set (`pandas`, `numpy`, `scipy`, `statsmodels`, `matplotlib`, `openpyxl`).

## Model Experience

Registers only the tools documented in `src/index.ts`; results are machine-readable JSON envelopes or domain records.

Planning failures use the same value envelope as the other Med tools: `{ ok: false, error }`.
An unknown dataset returns `DATASET_NOT_FOUND`; an unknown or non-`planned` analysis run during
code generation or execution returns `STATISTICS_PLAN_INVALID`. Both are non-retryable and retain
diagnostic ids in `error.details`; unexpected exceptions remain visible as real registry failures.

## Known Limitations and Deferred Work

- The plugin ships dependency-free SVG templates for the P0 Histogram, Box Plot, Bar Chart, and Scatter types; callers must persist the SVG through the run-linked artifact path.
- See the phase-5 decision record and the root README for the other gaps (container provider, real statistical fixtures).
