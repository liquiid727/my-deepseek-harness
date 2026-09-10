---
id: R001
title: Med Research Workspace V1.1
type: feature
version: 1.0.0
status: approved
priority: P0
owner: med-research
created_at: 2026-09-10
updated_at: 2026-09-10
affects: [plugins/med-research, asset]
---

# PRD - R001 Med Research Workspace V1.1

## 1. Summary

Med Research Workspace lets clinical researchers move from a question to traceable literature evidence and reproducible statistical results inside DSH. This workspace normalizes the approved V1.1 PRD/SPEC into stable GoalSpec identifiers without importing unapproved roadmap scope. UI behavior stays with the business outcome it presents.

Sources: `.todo/med-research-workspace-ultimate-prd-v1.1.md`, `.todo/med-research-workspace-ultimate-spec-v1.1.md`, the 0909 capability matrix and scope baseline, and the four V1.1 images under `asset/`.

## 2. Background

### Current Situation

- One monolithic PRD/SPEC defines the main chains; substantial plugin behavior and tests already exist.
- The matrix adds long-term capabilities, while the images express visual hierarchy without executable acceptance.

### Problem

- Approved V1.1 behavior, roadmap scope, implementation evidence, and UI fidelity are not connected by one REQ -> SPEC -> TEST -> Evidence -> Acceptance chain.

### Why Now

- Remaining work crosses services and browser surfaces and must not proceed by static prototype imitation.

## 3. Goals

### G-R001-001 Traceable research
- User / business outcome: every final claim can be checked against a real paper passage.
- Success signal: the Research DoD ends in a gated Claim and navigable source.

### G-R001-002 Reproducible statistics
- User / business outcome: every displayed number and chart can be reproduced.
- Success signal: the Statistics DoD ends in real results, figures, and provenance.

### G-R001-003 Honest workbench
- User / business outcome: real state, partial success, and failures remain visible.
- Success signal: required UI states pass desktop and narrow browser verification.

## 4. Non-Goals

- NG-R001-001: Skill Center, Marketplace, and Builder; these belong to R002.
- NG-R001-002: Project RAG, expanded sources, systematic review, meta-analysis, collaboration, and writing.
- NG-R001-003: An independent web app, URL router, or replacement shell.
- NG-R001-004: Model-generated source identifiers, quotations, citations, results, or figures.
- NG-R001-005: Pixel identity where it conflicts with DSH extension points, accessibility, localization, or real state.

## 5. Actors and Scope

| Actor | Description | Allowed / forbidden boundary |
|---|---|---|
| ACT-R001-001 Researcher | Owns projects, evidence review, and approvals | Cannot bypass evidence or runner gates |
| ACT-R001-002 Research Agent | Plans and invokes declared tools | Cannot invent sources or results |
| ACT-R001-003 Operator | Configures connectors and runner policy | Cannot silently alter project evidence |

### In Scope

- Project/session lifecycle; confirmed PubMed discovery; source-faithful reading; Evidence/Claim/citation gates; approved isolated statistics; DSH UI, localization, accessibility, recovery, and audit.

### Out of Scope

- Every Non-Goal and every matrix row classified `roadmap`.

## 6. User / Business Scenarios

### FLOW-R001-001 Evidence-grounded research

Actor: ACT-R001-001 assisted by ACT-R001-002.

Preconditions: an active DSH session is bound to a Project.

Flow:
1. Review an editable query plan.
2. Confirm before PubMed access.
3. Save authentic papers and resolve available text.
4. Locate and verify SUPPORT, AGAINST, or UNCERTAIN Evidence.
5. Gate Claims, serialize citations, and open the exact source.

Expected Outcome: only supported conclusions are emitted; missing or failed evidence remains explicit.

### FLOW-R001-002 Reproducible statistics

Actor: ACT-R001-001 assisted by ACT-R001-002.

Preconditions: a supported dataset belongs to the Project.

Flow:
1. Inspect profile and variable semantics.
2. Review plan and code.
3. Approve execution.
4. Run without network or host secrets.
5. Inspect results, figures, logs, and provenance.

Expected Outcome: every output resolves to its successful AnalysisRun.

## 7. Functional Requirements

### REQ-R001-001 Project workspace
System MUST persist, list, select, restore, export/import, and session-bind Projects with accurate overview counts.
User Value: research remains organized and recoverable.
Trigger: project lifecycle or recovery action.
Observable Result: workspace, `project.json`, binding, and displayed counts agree; empty/error states are explicit.
Priority: Must.
Agent Behavior Contract: reconstructable context is the metric; versioned keyless fixtures are the dataset; 100% model-visible context is logged; missing binding hands control to the user.

### REQ-R001-002 Confirmed literature search
System MUST expose an editable PICO/PECO and PubMed plan and MUST NOT search before confirmation.
User Value: the researcher controls scope and cost.
Trigger: natural-language question.
Observable Result: plan fields and confirmation state are visible; connector calls are zero before confirmation.
Priority: Must.
Agent Behavior Contract: complete required fields and zero unconfirmed requests; use versioned PONV fixtures and approved sampled questions; retain plans, edits, confirmation, calls, and partial failures.

### REQ-R001-003 Authentic paper retrieval
System MUST source PMID/DOI from connector/parser responses, normalize/deduplicate results, expose partial failures, and persist saved papers.
User Value: results are authentic and reusable.
Trigger: confirmed query or save.
Observable Result: bibliographic/source state is visible; saves survive restart; timeout/rate limit differs from empty.
Priority: Must.
Agent Behavior Contract: Source Integrity violations equal zero on recorded NCBI fixtures and explicit live E2E; retain request and source identity.

### REQ-R001-004 Source-faithful paper reading
System MUST expose abstract or available full text as truth, preserve normalized locations, and support section, translation/bilingual, selection, note, and Evidence actions without simulating failed text.
User Value: users inspect exact sources.
Trigger: opening a paper or citation.
Observable Result: source/parse state and actions are visible and stored source text remains unchanged.
Priority: Must.
Agent Behavior Contract: Not applicable; translations never replace source text.

### REQ-R001-005 Verifiable Evidence
System MUST store text, location, source type, extraction provenance, relation, locator status, and support status consistently.
User Value: evidence can be independently checked.
Trigger: retrieve, save, or verify.
Observable Result: relation/status is visible; NOT_FOUND cannot be VERIFIED; source navigation highlights the stored span.
Priority: Must.
Agent Behavior Contract: relocatability >=98% and relation accuracy >=0.85 on the versioned medically reviewed Gold Set; retain candidates, model/prompt versions, decisions, and reasons; unresolved items remain UNCERTAIN.

### REQ-R001-006 Gated claims and citations
System MUST reject unsupported Claims, retain counter-evidence, generate citation numbering in the backend, and resolve citations to sources.
User Value: conclusions are auditable.
Trigger: conclusion serialization.
Observable Result: every emitted Claim has qualifying Evidence and every citation resolves.
Priority: Must.
Agent Behavior Contract: unsupported Claim rate zero and Claim Support Precision >=0.85 on the same Gold Set; retain Claim/Evidence mappings and insufficiency reasons; insufficient evidence hands off to the user/reviewer.

### REQ-R001-007 Dataset profile and approved plan
System MUST profile supported CSV/XLSX, persist corrections, produce a plan/code preview, and wait for approval.
User Value: assumptions are inspectable before execution.
Trigger: upload or analysis question.
Observable Result: rows, columns, missing values, variables, preview, plan, code, warnings, and approval state are visible.
Priority: Must.
Agent Behavior Contract: zero pre-approval execution and zero row-level model exposure on hashed fixtures; ambiguous variables return for user correction.

### REQ-R001-008 Reproducible execution
System MUST isolate approved execution, preserve honest failure, render structured results and applicable Histogram/Box Plot/Bar Chart/Scatter figures, and attach full provenance.
User Value: outputs are reproducible and exportable.
Trigger: approved AnalysisRun.
Observable Result: success exposes result/figure/export/code/log/provenance; failure exposes code/stderr and creates no result.
Priority: Must.
Agent Behavior Contract: deterministic fixture results and provenance coverage are 100%; retain approval, code, runner state, outputs, hashes, runtime, packages, and failures; failed runs produce no interpretation.

### REQ-R001-009 Integrated accessible UI
System MUST render the outcomes through DSH extension points using real services, zh/en copy, responsive layouts, semantic controls, and explicit loading/empty/success/partial/failure states.
User Value: users can scan, verify, and continue chatting.
Trigger: med view or tool result.
Observable Result: four V1.1 work surfaces preserve the corresponding asset hierarchy without overlap at desktop and narrow widths.
Priority: Must.
Agent Behavior Contract: Not applicable; UI projects stored/logged state.

### REQ-R001-010 Controlled operation
System MUST validate configuration, restrict logged Agent Modes, audit protected actions, recover through versioned backup/import, and expose stable localized errors without leaking secrets or row data.
User Value: safe operation and recovery.
Trigger: config, mode, protected tool, or recovery action.
Observable Result: actions are deterministically allowed/denied with error, audit, and recovery behavior.
Priority: Must.
Agent Behavior Contract: disallowed calls and leakage equal zero on the versioned mode/security matrix; retain mode, allowlist, decision, and audit identity.

## 8. Business Rules, Lifecycle, and Edges

- BR-R001-001: the matrix is roadmap input; only this PRD authorizes V1.1.
- BR-R001-002: assets govern information hierarchy; persisted state governs facts.
- BR-R001-003: users confirm PubMed and code execution.
- BR-R001-004: original text and runner output outrank translation/interpretation.
- INV-R001-001: model-visible input is reconstructable from Session logs.
- INV-R001-002: sources, Evidence, citations, results, and figures are never invented.
- INV-R001-003: VERIFIED implies FOUND or PARTIAL.
- INV-R001-004: every final Claim has qualifying Evidence.
- INV-R001-005: every number/figure links to a successful AnalysisRun.
- INV-R001-006: patient rows and host secrets do not enter model input or runner host environment.

| ID | Case | Expected Behavior |
|---|---|---|
| EDGE-R001-001 | No binding | Actionable empty state and stable not-bound error |
| EDGE-R001-002 | Partial full-text failure | Keep authentic paper results and show per-item failure |
| EDGE-R001-003 | Stale citation span | Reject support and show NOT_FOUND/REJECTED |
| EDGE-R001-004 | Abstract only | Show abstract-only truth |
| EDGE-R001-005 | Runner failure/limit | Preserve code/stderr; no result/figure |
| EDGE-R001-006 | Narrow viewport | Collapse secondary panes through DSH tabs/drawers |
| EDGE-R001-007 | Retry/duplicate | Reuse/reject by identity; no conflicting final state |
| EDGE-R001-008 | Unsupported import version | Fail before mutation |

Lifecycle:
- Research: `IDLE -> PLANNING -> PLAN_READY -> SEARCHING -> PAPERS_READY -> RETRIEVING_EVIDENCE -> LOCATING -> VERIFYING -> ANSWER_READY`; any stage may enter `ERROR_PARTIAL`.
- Statistics: `NO_DATASET -> PROFILING -> READY -> PLANNING -> PLAN_READY -> WAITING_APPROVAL -> GENERATING_CODE -> EXECUTING -> SUCCEEDED|FAILED`.

## 9. UX, Non-Functional Goals, and Constraints

UX: `首页.png` governs workspace/prompt/overview; `搜索研究.png` governs conclusion/evidence/source comparison; `论文阅读器.png` governs navigation/reading/selection/notes; `统计lab.png` governs dataset/plan/code/result/chart/provenance. Required regions, action prominence, state visibility, density, responsiveness, and non-overlap are blocking; decoration is informational.

| Area | Requirement |
|---|---|
| Performance | Research P50 <=90s and P95 <=240s for up to 20 papers in the declared environment |
| Reliability | Partial results remain usable; retry/restart cannot invent or corrupt state |
| Security / privacy | Row data stays in runner; secrets stay out of logs/model; protected actions require approval |
| Accessibility | Keyboard, visible focus, semantic controls, contrast, and reduced motion |
| Compatibility / migration | DSH extensions; monotonic storage versions; incompatible imports fail before mutation |

Constraints: out-of-tree `plugins/med-research` and supported profile only; canonical Remote owners are `medProjects`, `medLiterature`, `medPapers`, `medEvidence`, `medDatasets`, `medStatistics`, and `medArtifacts`. The target reader uses the DSH right pane when consumable; the current full-view fallback is a visible implementation limitation, not accepted equivalence.

## 10. Acceptance Criteria

- AC-R001-001: project metadata, binding, and counts persist correctly across selection and reload.
- AC-R001-002: an editable plan is visible and no PubMed request occurs before confirmation.
- AC-R001-003: every result identifier traces to connector data and partial failures remain visible.
- AC-R001-004: source/parse status, sections, and original content are visible without simulated full text.
- AC-R001-005: source navigation highlights exact normalized offsets; stale spans are rejected.
- AC-R001-006: every emitted Claim has qualifying Evidence and every citation resolves.
- AC-R001-007: dataset/profile/plan/code are visible and execution remains approval-blocked.
- AC-R001-008: success exposes real results, P0 figures, export, and provenance; failure creates none.
- AC-R001-009: all required UI states are localized, keyboard-accessible, readable, and non-overlapping at desktop and narrow widths.
- AC-R001-010: Research and Statistics DoD run through the supported profile against real service/storage boundaries.
- AC-R001-011: mode/config/recovery/protected actions follow stable policy, errors, and audit.
- AC-R001-012: a qualified medical reviewer reports Gold Set thresholds without model self-scoring.

## 11. Spec Package Decomposition

| Package | Business Outcome | Covers | Depends On | Path |
|---|---|---|---|---|
| S01 Project Workspace | Create, select, restore, and safely operate an accurate Project | REQ-R001-001, REQ-R001-009, REQ-R001-010; AC-R001-001, AC-R001-009, AC-R001-011 | None | `./specs/S01-project-workspace/` |
| S02 Literature Discovery | Approve a search, inspect authentic results, and save papers | REQ-R001-002, REQ-R001-003, REQ-R001-009; AC-R001-002, AC-R001-003, AC-R001-009 | S01 | `./specs/S02-literature-discovery/` |
| S03 Paper Reading | Read the best source and return to exact cited passages | REQ-R001-004, REQ-R001-009; AC-R001-004, AC-R001-005, AC-R001-009 | S01, S02 | `./specs/S03-paper-reading/` |
| S04 Evidence Claims | Receive balanced, source-verifiable Claims | REQ-R001-005, REQ-R001-006, REQ-R001-009; AC-R001-005, AC-R001-006, AC-R001-009, AC-R001-012 | S02, S03 | `./specs/S04-evidence-claims/` |
| S05 Reproducible Statistics | Approve, run, inspect, export, and reproduce analyses | REQ-R001-007, REQ-R001-008, REQ-R001-009, REQ-R001-010; AC-R001-007, AC-R001-008, AC-R001-009, AC-R001-010, AC-R001-011 | S01 | `./specs/S05-reproducible-statistics/` |

All packages are required.

## 12. Risks and Open Questions

| Risk | Impact | Mitigation |
|---|---|---|
| Right-pane package unavailable | Target Reader interaction blocked | Keep target; record fallback as implementation gap |
| PDF quality varies | Locator quality | Source states, normalization, PARTIAL/NOT_FOUND, Gold Set |
| PubMed limits/outage | Slow/partial search | Configured retry/timeout/cache and partial UX |
| Cross-platform isolation | Security/reproducibility varies | Target-platform evidence; Linux/CI owns release signal |

| ID | Question | Blocking | Decision / Approver | Status |
|---|---|---|---|---|
| Q-R001-001 | Canonical Remote names? | false | Existing service owners listed above / med-research owner | resolved |
| Q-R001-002 | Claim Gate model entry? | false | Logged `evidence_verify_claim` seam in S04 / med-research owner | resolved |
| Q-R001-003 | Agent Mode entry? | false | Session-header action plus logged state / med-research owner | resolved |
| Q-R001-004 | Right-pane package availability? | false | External implementation dependency | open |
| Q-R001-005 | Medical Gold Set reviewer? | false | Product owner assigns before acceptance | open |

## 13. PRD Ready Check

- [x] Goals, non-goals, actors, scope, REQ, BR/INV/EDGE, and AC are explicit.
- [x] Every requirement and AC has an observable result.
- [x] Packages have independent outcomes and dependencies.
- [x] Applicable constraints are stated.
- [x] No blocking Open Question remains.
