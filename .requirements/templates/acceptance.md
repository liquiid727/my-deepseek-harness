---
requirement: R001
source_prd: ./prd.md
source_index: ./index.yaml
source_prd_version: 1.0.0
decision: blocked # accepted | blocked | accepted-with-waiver
qa_owner: <qa-owner>
product_approver: <product-approver>
accepted_at:
promotion: denied # allowed | denied
---

# Requirement Acceptance — <Requirement Title>

## Acceptance Scope and Version

- PRD version: <version>
- Product approver: <owner>
- UAT scope: ...

## Required Spec Package Decisions

| Spec Package | Covers | Decision | Acceptance Record |
|---|---|---|---|
| S01 | REQ-R001-001 | blocked | ./specs/S01-<slug>/acceptance.md |

## PRD Acceptance Criteria

| Acceptance Criterion | Evidence / Spec Acceptance | Result |
|---|---|---|
| AC-R001-001 | ... | pending |

## Non-Functional Acceptance (conditional)

| Area | Result | Evidence / rationale |
|---|---|---|
| Performance | Not applicable | ... |
| Security | Not applicable | ... |
| Compatibility / migration | Not applicable | ... |
| UX / accessibility | Not applicable | ... |

## Product / UAT Decision

Decision:
- blocked

Blocking Open Questions:
- ...

Residual Risk:
- ...

Waiver:
- None | risk / owner / expiry / approved-by / rationale / follow-up Issue

## Requirement Done Check

- [ ] Every required Spec Package is accepted.
- [ ] Every PRD Acceptance Criterion is verified.
- [ ] No blocking Open Question remains.
- [ ] Promotion decision is allowed or an explicit waiver is recorded.
