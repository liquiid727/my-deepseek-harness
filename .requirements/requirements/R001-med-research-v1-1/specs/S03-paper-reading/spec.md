---
requirement: R001
spec_package: S03
spec_id: SPEC-R001-S03
title: Paper Reading
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 1.0.0
version: 1.0.0
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: [S01, S02]
---

# Spec Package S03 - Paper Reading

## 1. Objective and Traceability

Business Outcome: Users read the best available source and return to exact cited passages.

| PRD Requirement | Contract Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-004, REQ-R001-009 | SPEC-R001-S03-001..003 | AC-R001-004, AC-R001-005, AC-R001-009 | P0 |

## 2. Existing System Analysis

Relevant modules/interfaces: plugin-paper, plugin-fulltext, medPapers Remote, PapersView focus contract.

Existing decisions: V1.1 PRD/SPEC, capability-matrix baseline, DSH plugin-only architecture, locale ownership, model-visible logging, and adjacent storage migration. Existing tests/evidence inform status but do not replace this contract.

## 3. Scope and Architecture

### In Scope

- The business outcome above, its service/tool/Remote/UI paths, persistence, errors, audit, and asset/论文阅读器.png presentation.

### Out of Scope

- R002 Skills and R001 Non-Goals; independent routes/apps; static mocked business state.

Architecture: domain services own state; tools are model seams; Remote methods are browser seams; DSH client extensions render raw persisted results. Registrations are effects. Canonical service namespaces follow R001.

## 4. Contract Behaviors

### SPEC-R001-S03-001 Resolve and represent source truth

Implements: REQ-R001-004, REQ-R001-009.

Public Seam: paper tools and medPapers get/document/sections/paragraph.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: The reader exposes abstract, uploaded PDF, or compliant full text with sourceType, parseStatus, ordered sections, normalized paragraphs, and page data where available.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Unavailable content stays ABSTRACT_ONLY/unavailable; parse failure is FAILED/PARTIAL and never fabricated.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-004, AC-R001-005, AC-R001-009.

### SPEC-R001-S03-002 Read and act on selections

Implements: REQ-R001-004, REQ-R001-009.

Public Seam: Paper Reader UI.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: The layout follows 论文阅读器.png: structure navigation, original/translation/bilingual modes, zoom/read controls, selection toolbar, notes, and Evidence actions while original text remains immutable.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Translation/AI failure leaves source usable; invalid selection cannot create a note or Evidence locator.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-004, AC-R001-005, AC-R001-009.

### SPEC-R001-S03-003 Open exact citation focus

Implements: REQ-R001-004, REQ-R001-009.

Public Seam: openView med-papers focus and target DSH right pane.

Given / When / Then:
- Given: valid authorized input and required prior state.
- When: the actor invokes the public seam.
- Then: paperId/documentId/paragraphId/start/end resolves, scrolls, and highlights the exact normalized span; target interaction uses the right pane when available.

Authorization: researchers approve user actions; operators own deployment policy; session/project scope prevents cross-project access.

State and Data Semantics: durable records use branded IDs and owning storage domains; UI is a projection, not a second state store.

Error Semantics: Malformed/stale focus fails visibly and never highlights a different span; full-view fallback is not final right-pane acceptance.

Idempotency / Concurrency: duplicate actions preserve one valid domain outcome; concurrent writes follow the owning storage/service behavior and expose conflicts.

Side Effects and Observability: log model-visible inputs/results and protected audit actions without secrets or row data; external calls and writes expose stable identity/status.

Risk and Gate Impact: P0; behavior, negative, persistence, and applicable browser/E2E evidence are blocking.

Acceptance Mapping: AC-R001-004, AC-R001-005, AC-R001-009.

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
| UI / accessibility | Match asset/论文阅读器.png hierarchy semantically; keyboard/focus/contrast/reduced motion; desktop and narrow non-overlap |

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
