# @medresearch/dsh-medical-adapter-dsh

English | [中文](README.zh.md)

## Summary

Records the exact published DSH packages, versions, and named exports this repository depends on and verifies them against what is installed. Run `runCompatibilityCheck()` before any DSH upgrade (SPEC §65.2, AGENTS.md §2.1 #2); a mismatch fails loud instead of surfacing later as a runtime error.

## Model Experience

Nothing; the adapter registers no model surface.

## Known Limitations and Deferred Work

- The check verifies versions and export presence, not behavior; behavioral compatibility still needs the phase-8 keyless E2E run.
- `DSH_DEPENDENCIES` must be updated together with the root README version table.
