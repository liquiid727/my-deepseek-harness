---
requirement: R001
spec_package: S04
spec_id: SPEC-R001-S04
title: Evidence and Claims
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 1.0.0
version: 1.0.0
status: approved
owner: med-research
qualityProfile: agent-workflow
riskTier: P0
depends_on: [S02, S03]
---

# Spec Package S04 - Evidence and Claims

## 1. Objective and Traceability

Business Outcome: Users receive balanced Claims whose Evidence and citations are independently verifiable.

| PRD Requirement | Contract Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-005, REQ-R001-006, REQ-R001-009 | SPEC-R001-S04-001..003 | AC-R001-005, AC-R001-006, AC-R001-009, AC-R001-012 | P0 |

## 2. Existing System Analysis

Relevant modules/interfaces: medical-domain Claim Gate/citation, plugin-evidence, EvidenceView, research-chain E2E.

Existing decisions: V1.1 PRD/SPEC, capability-matrix baseline, DSH plugin-only architecture, locale ownership, model-visible logging, and adjacent storage migration. Existing tests/evidence inform status but do not replace this contract.

## 3. Scope and Architecture

### In Scope

- The business outcome above, its service/tool/Remote/UI paths, persistence, errors, audit, and asset/搜索研究.png and asset/论文阅读器.png presentation.

### Out of Scope

- R002 Skills and R001 Non-Goals; independent routes/apps; static mocked business state.

Architecture: domain services own state; tools are model seams; Remote methods are browser seams; DSH client extensions render raw persisted results. Registrations are effects. Canonical service namespaces follow R001.

## 4. Contract Behaviors

### SPEC-R001-S04-001 Retrieve and verify Evidence

Implements: REQ-R001-005, REQ-R001-006, REQ-R001-009.

Public Seam: evidence_retrieve/save/verify and medEvidence Remote.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: Evidence stores original/normalized text, offsets, source, provenance, relation, locator/support states; VERIFIED only follows FOUND/PARTIAL.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: NOT_FOUND forces REJECTED; missing paragraph or invalid provenance fails without a verified record.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-005, AC-R001-006, AC-R001-009, AC-R001-012.

### SPEC-R001-S04-002 Gate Claims and serialize citations

Implements: REQ-R001-005, REQ-R001-006, REQ-R001-009.

Public Seam: logged evidence_verify_claim model-visible seam.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: The seam validates evidence/counter-evidence IDs, relocation and support, emits reasons, serializes first-appearance citation numbers, and logs reconstructable inputs/results.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Unsupported or dangling Claims are rejected or marked insufficient; the model cannot supply accepted citation numbers.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-005, AC-R001-006, AC-R001-009, AC-R001-012.

### SPEC-R001-S04-003 Compare Evidence and open sources

Implements: REQ-R001-005, REQ-R001-006, REQ-R001-009.

Public Seam: Evidence/Research UI.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: Conclusion, SUPPORT/AGAINST/UNCERTAIN counts and groups, locator state, and source actions follow 搜索研究.png; opening a source delegates to S03.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Missing counter-evidence is stated; partial/secondary/not-found states remain distinct; raw failures are localized.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-005, AC-R001-006, AC-R001-009, AC-R001-012.

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
| UI / accessibility | Match asset/搜索研究.png and asset/论文阅读器.png hierarchy semantically; keyboard/focus/contrast/reduced motion; desktop and narrow non-overlap |

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
