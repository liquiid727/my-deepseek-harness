# @medresearch/dsh-medical-runner-container

English | [中文](README.zh.md)

## Summary

Phase 5 component of the Med Research Workspace. Provides `ctx.medRunner`, the `StatisticsRunner` seam, over a restricted subprocess: no network, a read-only dataset, an isolated writable output directory, CPU/memory/time limits, a package allowlist, and no host secrets (SPEC §36). See `docs/decisions/2026-09-08-phase5-statistics.md` for the design and isolation decisions, and `docs/decisions/2026-09-09-runner-urllib-parse-allowance.md` for the blocked-module policy (`urllib.parse` is permitted so `pathlib` works; `urllib.request` stays blocked).

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `pythonPath` | `python3` | Interpreter used for analysis code |
| `isolationLevel` | `restricted-process` | Declared isolation of this provider |

`isolationLevel: "container"` fails loud at load: this provider cannot honour it, and accepting the label would silently downgrade the deployment's declared isolation. Compose a container provider for that level.

## Model Experience

Registers only the tools documented in `src/index.ts`; results are machine-readable JSON envelopes or domain records.

## Known Limitations and Deferred Work

- The production container/bwrap provider is not implemented; `restricted-process` is the macOS / no-container fallback and is labelled as such.
- See the phase-5 decision record and the root README for the other gaps (XLSX parsing, real statistical fixtures).
