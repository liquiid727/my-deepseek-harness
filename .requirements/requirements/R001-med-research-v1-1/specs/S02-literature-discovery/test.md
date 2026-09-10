---
requirement: R001
spec_package: S02
test_spec_id: TEST-R001-S02
source_prd: ../../prd.md
source_spec: ./spec.md
source_spec_id: SPEC-R001-S02
source_spec_version: 1.0.0
source_spec_hash: 76326d7700a85ee40dad66e58fb0c443d458e87e64658c2e86b291f0ab6b2831
version: 1.0.0
status: draft
owner: med-research-testing
qualityProfile: agent-workflow
riskTier: P0
---

# Test Design - S02 Literature Discovery

## 1. Purpose and Scope

Prove the approved Literature Discovery Spec at its public service/tool/Remote/browser seams. Execution results belong in `evidence/`.

In scope: REQ-R001-002, REQ-R001-003, REQ-R001-009, AC-R001-002, AC-R001-003, AC-R001-009. Out of scope: R002 and R001 Non-Goals.

## 2. Coverage Matrix

| Requirement | Spec | Test | Category / level | Required Evidence | Gate |
|---|---|---|---|---|---|
| REQ-R001-002, REQ-R001-003, REQ-R001-009 | SPEC-R001-S02-001 | TEST-R001-S02-001 | happy / integration | assertion report + persisted state | blocking |
| REQ-R001-002, REQ-R001-003, REQ-R001-009 | SPEC-R001-S02-001, SPEC-R001-S02-002, SPEC-R001-S02-003 | TEST-R001-S02-002 | negative / contract | error and no-illegal-side-effect assertions | blocking |
| INV/EDGE mapped by Spec | SPEC-R001-S02-001, SPEC-R001-S02-002, SPEC-R001-S02-003 | TEST-R001-S02-003 | invariant / E2E | trace + domain state | blocking |
| REQ-R001-009 | SPEC-R001-S02-001, SPEC-R001-S02-002, SPEC-R001-S02-003 | TEST-R001-S02-004 | UI / browser | screenshots + trace at desktop/narrow | blocking |
| AC-R001-002, AC-R001-003, AC-R001-009 | SPEC-R001-S02-001, SPEC-R001-S02-002, SPEC-R001-S02-003 | TEST-R001-S02-005 | release scenario | normalized run + raw refs | blocking |

## 3. Test Environment and Data

- Fixtures / dependencies: plugin-literature fixtures/tests; research-chain; real profile browser.
- Dependency mode: recorded for deterministic connector cases; real service/storage/profile for E2E; live PubMed only in explicit E2E.
- Environment: Node supported by root package, med-research profile, temporary isolated workspace/storage, Chrome desktop 1440x900 and narrow 390x844.
- Isolation/cleanup: unique temp root and database per run; abort requests and stop processes; preserve failed artifacts.
- PII/secrets: synthetic/public literature data only; redact keys; no patient row data in model/browser evidence.
- Baseline: record commit, dirty-tree fingerprint, platform, dependencies, Spec hash, and timestamp.

## 4. Affected Observable Surfaces

| Surface | Consumer / entry | Verification | Evidence | Gate |
|---|---|---|---|---|
| package-api | owning med services/tools | focused package and contract assertions | raw test report | blocking |
| browser-ui | supported dsh med-research profile | 搜索研究.png result/partial states | screenshots, console, interaction trace | blocking |
| persistence-protocol | med storage/project files | round-trip and invalid-version rejection | state dump/hash | blocking |
| model-visible-output | real tool registry/session | reconstruct inputs/results; no invented data | keyless snapshot/session refs | blocking |
| security-concurrency-cleanup | protected actions and lifecycle | rejection, retry/duplicate, cleanup | assertion/trace | blocking |
| build-release-artifact | client bundle/profile | built-load smoke | build/load report | blocking |

## 5. Test Scenarios

### TEST-R001-S02-001 Primary outcome
Covers: REQ-R001-002, REQ-R001-003, REQ-R001-009; SPEC-R001-S02-001, SPEC-R001-S02-002, SPEC-R001-S02-003; AC-R001-002, AC-R001-003, AC-R001-009.
Given valid versioned inputs and an isolated Project, when Plan-confirm-search-save with real fixture PMID, then public output, persisted state, UI state, audit, and identifiers agree.
Required evidence / gate: raw assertions plus normalized mapping / blocking.

### TEST-R001-S02-002 Failure honesty
Covers: mapped BR/INV/EDGE and SPEC-R001-S02-001, SPEC-R001-S02-002, SPEC-R001-S02-003.
Given No pre-confirm call; empty/timeout/rate-limit/malformed/partial, when the public seam runs, then it returns the declared stable failure/partial state and creates no forbidden state, source, result, or success feedback.
Required evidence / gate: negative assertion and before/after state / blocking.

### TEST-R001-S02-003 Invariant, retry, and isolation
Covers: INV-R001-001..006 as applicable.
Given duplicate/concurrent/cancelled actions and scoped Project/session state, when operations race or retry, then one valid final state remains, cross-project access is absent, cleanup completes, and logged model state is reconstructable.
Required evidence / gate: test report and correlation IDs / blocking.

### TEST-R001-S02-004 Asset-aligned browser UI
Covers: REQ-R001-009 and AC-R001-009.
Given real service data for loading, empty, success, partial, and failure, when rendered at desktop and narrow viewports, then 搜索研究.png result/partial states; primary actions remain keyboard reachable, localized, readable, and non-overlapping; console has no uncaught errors.
Required evidence / gate: same-run screenshots, trace, console, and semantic checklist / blocking.

### TEST-R001-S02-005 Supported-profile release scenario
Covers: AC-R001-002, AC-R001-003, AC-R001-009.
Given the built client/plugin and supported profile, when the representative user journey runs through real public seams, then the terminal user outcome completes and every claimed result links to current raw evidence.
Required evidence / gate: normalized run, raw report/trace, commit and Spec hash / blocking.

## 6. Required Coverage and Regression

- Required: unit/contract/integration, negative/failure, persistence, audit, duplicate/cancel, browser/E2E, bundle/profile compatibility; security and performance where the Spec applies.
- Regression: plugin-literature fixtures/tests; research-chain; real profile browser; adjacent shared contracts and med profile composition.
- Exploratory: dense/long localized content, narrow layout, partial dependencies, and recovery.

## 7. Evidence, Gates, and Flaky Policy

Every run records TEST/SPEC IDs, Spec hash, commit/worktree, environment, time, command/runner, result, assertions, raw artifacts, correlation IDs, and flaky classification in `evidence/index.yaml`. Passing totals alone are insufficient. A retry never converts an unexplained blocking failure to PASS.

| Stage | Required checks | Blocking |
|---|---|---|
| PR | focused unit/contract, changed critical path, typecheck | yes |
| Merge/nightly | full package regression, profile scenario, applicable Eval | yes |
| Pre-production | real browser journey, live dependency where required, platform security/performance | yes |

## 8. Agent Eval Plan

Use the PRD-declared versioned fixtures/Gold Set, metrics, thresholds, retained trajectory, degradation, and medical-review handoff. PR smoke selection must cover changed decisions and negative gates; merge/nightly runs the approved full dataset. Dataset version, selection rationale, reviewer, and thresholds are mandatory in each plan.

## 9. Exit Criteria

- [ ] Every mapped P0 REQ/SPEC/BR/INV/EDGE/AC has evidence.
- [ ] Blocking behavior, security, compatibility, and UI checks pass.
- [ ] Evidence binds this Spec hash and tested revision.
- [ ] No unresolved P0/P1 defect or unclassified flaky result remains.
