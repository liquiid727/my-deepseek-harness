# Development Lifecycle

English | [中文](development-lifecycle.zh.md)

## Summary

The lifecycle assigns each check to the earliest execution context that can run it reliably and to the latest context that can still prevent unsafe delivery. Local feedback is fast; CI is independent and complete; the merge gate consumes a stable verdict.

## Table of Contents

- [Lifecycle model](#lifecycle-model)
- [L0 editor](#l0-editor)
- [L1 pre-commit](#l1-pre-commit)
- [L2 pre-push](#l2-pre-push)
- [L3 pull request](#l3-pull-request)
- [L4 merge](#l4-merge)
- [L5 release](#l5-release)
- [Bypass and recovery](#bypass-and-recovery)

## Lifecycle model

Editor -> commit -> push -> pull request -> merge -> release

Each level should answer a different question. L0 asks whether the edit is locally well formed. L1 asks whether the proposed commit is internally clean. L2 asks whether the branch still satisfies project contracts. L3 asks whether a clean environment proves the change. L4 asks whether all required evidence is present. L5 asks whether the published artifact works for a consumer.

## L0 editor

L0 is interactive and non-blocking. It should run formatting on save, parser diagnostics, language-server type diagnostics, and focused tests. The editor may use a daemon or cache, but the repository command remains the reproducible fallback.

L0 must not be the only place a rule exists. An editor extension is unavailable to some humans and to every clean CI checkout.

## L1 pre-commit

L1 is for deterministic checks that are cheap on the staged change. It may repair formatting or regenerate a directly owned generated file when the repair is transparent and staged. It should not run network calls, full builds, browser suites, live API tests, or multi-minute coverage.

The DSH example uses staged translation pairing, archived-note validation, staged Oxlint, third-party notice regeneration, whitespace validation, and a vendor manifest check. Its `pre-merge-commit` repeats only the merge-sensitive subset.

## L2 pre-push

L2 is for medium-cost checks that benefit from branch-wide context but do not need the CI matrix. Typecheck, focused integration tests, migration dry runs, and a local build can belong here when their measured duration and reliability fit the developer loop.

DSH currently uses whole-project `pnpm run typecheck` in `pre-push`. It leaves coverage, browser snapshots, full builds, and cross-platform verification to CI.

## L3 pull request

L3 runs from a clean checkout and validates the full intended scope. The repository may shard independent jobs, but the leaf commands must have one owner. Environment-dependent tests belong here: integration, E2E, browser, coverage, build, artifact smoke, security, dependency, and license checks.

DSH's `scripts/run-gates.ts` supplies named aggregates. The workflows select `check:ci:static`, `check:ci:coverage`, `check:ci:bench`, `check:ci:consumers`, `check:node-compat`, Windows aggregates, and the primary aggregate. The static aggregate includes repository consistency and documentation checks; the primary aggregate adds typing, lint, duplication, tests, snapshots, build, and built consumers.

## L4 merge

L4 is a policy verdict, not another implementation test. Branch protection should require a stable aggregate that fails if any blocking job fails, is cancelled, or is skipped. DSH's `all-checks-passed` job uses `if: always()` and explicitly rejects failure, cancellation, and skipped dependencies so a skipped required job cannot become a false green.

## L5 release

L5 validates the artifact users receive. It should include package or binary build, dependency layout, packed-install smoke, native target coverage, release metadata, license and notice output, and publish preconditions. Release workflows may use different credentials and operating systems, but they must consume the same guardrail identifiers and report artifact evidence.

## Bypass and recovery

Local hook bypass is expected to be possible and must not weaken CI. A bypass flag, missing hook installation, or direct agent command only removes local feedback. It does not create a completion claim and does not change the required CI verdict.

When a check fails, the output should name the owner and repair command. The normal loop is inspect the diagnostic, patch the smallest relevant source, rerun the scoped command, then rerun the aggregate required for the current lifecycle level. A generated or confirmation command must never be used to hide an unreviewed semantic change.
