---
requirement: R001
spec_package: S01
source_spec: ./spec.md
source_test: ./test.md
source_review: ./review.md
source_spec_version: 1.0.0
source_test_version: 1.0.0
decision: blocked # accepted | blocked | accepted-with-waiver
qa_owner: <qa-owner>
accepted_at:
promotion: denied # allowed | denied
---

# QA Acceptance — S01 <Spec Package Name>

## Version Binding

| Artifact | Version / revision |
|---|---|
| PRD | <version> |
| Spec | <version and hash> |
| Test Design | <version and bound Spec hash> |
| Implementation / verification commit | <commit> |

## Issue Status

| Issue | Kind | Status | Completion Record |
|---|---|---|---|
| ISSUE-R001-S01-001 | implementation | pending | ./issues/... |

## Evidence Manifest

| Evidence | Covers | Location | Result |
|---|---|---|---|
| ... | TEST-R001-S01-001 | ./evidence/... | pending |

## Requirement Coverage

| Requirement | Spec | Test | Evidence | Result |
|---|---|---|---|---|
| REQ-R001-001 | SPEC-R001-S01-001 | TEST-R001-S01-001 | ./evidence/... | pending |

## Acceptance Decision

Decision:
- blocked

Blocking Gaps:
- ...

Review Status:
- ...

Residual Risk:
- ...

Waiver:
- None | risk / owner / expiry / approved-by / rationale / follow-up Issue

Promotion Recommendation:
- denied

## Spec Package Done Check

- [ ] All required Issues are done.
- [ ] Test exit criteria are satisfied by evidence.
- [ ] Review blockers are resolved or explicitly waived.
- [ ] No unexplained Spec Deviation remains.
- [ ] Mapped PRD Acceptance Criteria are verified.
- [ ] Evidence matches the current Spec version/hash and tested commit.
