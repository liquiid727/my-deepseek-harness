---
id: R001
title: <Requirement Title>
type: feature # feature | change | bug | refactor
version: 1.0.0
status: draft # draft | review | approved | implementing | accepted | blocked | done
priority: P1
owner: <owner>
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
affects: []
---

# PRD — R001 <Requirement Title>

## 1. Summary

用 3–8 句话说明用户问题、现在需要解决的原因，以及系统最终提供的能力。

## 2. Background

### Current Situation
- ...

### Problem
- ...

### Why Now
- ...

## 3. Goals

### G-R001-001 <Goal>
- User / business outcome: ...
- Success signal: ...

## 4. Non-Goals

- NG-R001-001: ...

## 5. Actors and Scope

| Actor | Description | Allowed / forbidden boundary |
|---|---|---|
| ACT-R001-001 <Actor> | ... | ... |

### In Scope
- ...

### Out of Scope
- ...

## 6. User / Business Scenarios

### FLOW-R001-001 <Scenario Name>

Actor:
- ...

Preconditions:
- ...

Flow:
1. ...
2. ...

Expected Outcome:
- ...

## 7. Functional Requirements

### REQ-R001-001 <Requirement Name>

System MUST ...

User Value:
- ...

Trigger:
- ...

Observable Result:
- ...

Priority:
- Must | Should | Could

Agent Behavior Contract (conditional):
- Success metric(s): Not applicable | ...
- Dataset / sampled-input source and version: Not applicable | ...
- Passing threshold: Not applicable | ...
- Trajectory fields, degradation, and human handoff: Not applicable | ...

## 8. Business Rules, Lifecycle, and Edges

- BR-R001-001: ...
- INV-R001-001: System MUST NOT ...

| ID | Case | Expected Behavior |
|---|---|---|
| EDGE-R001-001 | ... | ... |

Lifecycle (conditional):
- Not applicable | `STATE_A → STATE_B`; invalid transition: ...

## 9. UX, Non-Functional Goals, and Constraints

UX / interaction (conditional):
- Not applicable | users can observe ..., failures show reason and recovery ...

| Area | Requirement or `Not applicable` with rationale |
|---|---|
| Performance | ... |
| Reliability | ... |
| Security / privacy | ... |
| Accessibility | ... |
| Compatibility / migration | ... |

Constraints:
- ...

## 10. Acceptance Criteria

- AC-R001-001: Given ..., When ..., Then ...
- AC-R001-002: Given ..., When ..., Then ...

## 11. Spec Package Decomposition

### S01 <Spec Package Name>

Covers:
- REQ-R001-001
- AC-R001-001

Business Outcome:
- ...

Dependencies:
- None | S0N

Path:
- ./specs/S01-<slug>/

Required:
- true

## 12. Risks and Open Questions

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| ... | ... | ... | ... |

| ID | Question | Blocking | Decision / Approver | Status |
|---|---|---|---|---|
| Q-R001-001 | ... | true | ... | open |

## 13. PRD Ready Check

- [ ] Goals, non-goals, actors, scope, REQ, BR/INV/EDGE, and AC are explicit.
- [ ] Every requirement and acceptance criterion has an observable result.
- [ ] S0N packages have independent business outcomes and known dependencies.
- [ ] Applicable technical/product constraints are stated; inapplicable areas have a rationale.
- [ ] No blocking Open Question remains.
