---
requirement: R001
spec_package: S05
spec_id: SPEC-R001-S05
title: Reproducible Statistics
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 1.0.0
version: 1.0.0
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: [S01]
---

# Spec Package S05 - Reproducible Statistics

## 1. Objective and Traceability

Business Outcome: Users approve, execute, inspect, export, and reproduce statistical analyses safely.

| PRD Requirement | Contract Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-007, REQ-R001-008, REQ-R001-009, REQ-R001-010 | SPEC-R001-S05-001..003 | AC-R001-007, AC-R001-008, AC-R001-009, AC-R001-010, AC-R001-011 | P0 |

## 2. Existing System Analysis

Relevant modules/interfaces: plugin-dataset, plugin-statistics, medical-runner-container, plugin-artifact, StatisticsView.

Existing decisions: V1.1 PRD/SPEC, capability-matrix baseline, DSH plugin-only architecture, locale ownership, model-visible logging, and adjacent storage migration. Existing tests/evidence inform status but do not replace this contract.

## 3. Scope and Architecture

### In Scope

- The business outcome above, its service/tool/Remote/UI paths, persistence, errors, audit, and asset/统计lab.png presentation.

### Out of Scope

- R002 Skills and R001 Non-Goals; independent routes/apps; static mocked business state.

Architecture: domain services own state; tools are model seams; Remote methods are browser seams; DSH client extensions render raw persisted results. Registrations are effects. Canonical service namespaces follow R001.

## 4. Contract Behaviors

### SPEC-R001-S05-001 Profile data and approve analysis

Implements: REQ-R001-007, REQ-R001-008, REQ-R001-009, REQ-R001-010.

Public Seam: dataset tools, statistics_plan/generate_code, Statistics UI.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: CSV/XLSX creates a hashed profile, preview and variable schema; plan/code/warnings remain inspectable and execution stays WAITING_APPROVAL.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Unsupported/oversize/corrupt input or ambiguous variables fails visibly; row data does not enter model input.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-007, AC-R001-008, AC-R001-009, AC-R001-010, AC-R001-011.

### SPEC-R001-S05-002 Execute honestly in isolation

Implements: REQ-R001-007, REQ-R001-008, REQ-R001-009, REQ-R001-010.

Public Seam: statistics_execute and configured runner.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: Only an approved run executes with no network, read-only dataset, controlled output, resource limits, package allowlist, and no host secrets; status/logs are persisted.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Policy, timeout, resource, import, or code failure yields FAILED with code/stderr and no result/artifact.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-007, AC-R001-008, AC-R001-009, AC-R001-010, AC-R001-011.

### SPEC-R001-S05-003 Render and export reproducible output

Implements: REQ-R001-007, REQ-R001-008, REQ-R001-009, REQ-R001-010.

Public Seam: medStatistics/medArtifacts and Statistics UI.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: The 统计lab.png hierarchy shows dataset/profile, question/plan/code, structured results, applicable Histogram/Box Plot/Bar Chart/Scatter, and provenance; figures export PNG/SVG.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Every number/figure links to a successful run; malformed/mismatched figure is rejected; missing provenance is shown as missing and blocks acceptance.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-007, AC-R001-008, AC-R001-009, AC-R001-010, AC-R001-011.

## 5. Data and Interface Contracts

- Data: use existing med contracts and monotonic storage domain versions; incompatible durable data fails before mutation.
- API/tool/Remote: schemas are typed, stable errors use the existing result envelope, and all consumers update with pre-stable API changes.
- UI: every user action maps to a real service/tool or is disabled with an explicit reason; localized states include loading, empty, success, partial, and failure.

## 6. Technical Constraints

| Area | Contract |
|---|---|
| Security | Validate untrusted file/network/wire input; preserve project scope; redact secrets and patient rows |
| Performance | No blocking UI work; use R001 budgets where applicable and report partial/timeout state |
| Compatibility / rollback | DSH profile launch only; adjacent durable migrations; exported backup before destructive recovery |
| Agent behavior | Use the metrics, dataset, threshold, trajectory, degradation, and handoff fields in mapped R001 REQs |
| UI / accessibility | Match asset/统计lab.png hierarchy semantically; keyboard/focus/contrast/reduced motion; desktop and narrow non-overlap |

## 7. Change Delta

Not applicable: R001 normalizes an approved feature contract; implementation gaps are recorded in Evidence, not as competing behavior.

## 8. Decision Ownership

- PRD owns outcome/scope/metrics; this Spec owns executable behavior; Test owns verification; Evidence owns results; Review owns findings; Acceptance owns QA decision.
- Alternatives requiring human decision: none for implementation authority; external right-pane availability and Gold Set reviewer remain acceptance dependencies where applicable.

## 9. Spec Ready Check

- [x] Behaviors map to REQ/AC with public seams and observable results.
- [x] State, data, errors, authorization, side effects, and constraints are explicit.
- [x] Compatibility and durable-data behavior are explicit.
- [x] No blocking contract question remains.
