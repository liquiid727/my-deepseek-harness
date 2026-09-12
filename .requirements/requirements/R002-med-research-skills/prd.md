---
id: R002
title: Med Research Skills Workspace
type: feature
version: 0.2.0
status: blocked
priority: P1
owner: med-research
created_at: 2026-09-10
updated_at: 2026-09-12
affects: [plugins/med-research, asset/skill工作台.png]
---

# PRD - R002 Med Research Skills Workspace

## 1. Summary

R002 保留永久 Requirement ID，但不再提供实现授权。完整 V1 的 Skill Center、Builder、本地发布、Workspace 安装、权限和生命周期由 [R001 2.0 S07](../R001-med-research-v1-1/specs/S07-skills-center/spec.md) 统一拥有；实现者不得从本草案生成并行 Spec 或第二套产品合同。

本 Workspace 保持 blocked，直到维护者决定删除其重复正文或为 R001 范围之外的新 Skills 产品结果重新立项。其余内容仅保留原草案问题记录，不覆盖 R001。

## 2. Background

### Current Situation
- The matrix and prototype propose inventory, authoring, preview, testing, publishing, and installation.
- V1.1 does not authorize these behaviors.

### Problem
- Direct implementation would leave package trust, permissions, secrets, sandboxing, versioning, and publication undefined.

### Why Now
- A separate workspace preserves the direction without silently expanding R001.

## 3. Goals

### G-R002-001 Governed Skill lifecycle
- User / business outcome: users discover, author, test, publish, install, and run medical Skills with visible permissions and versions.
- Success signal: pending approved security and Eval policy.

## 4. Non-Goals

- NG-R002-001: shipping Skills under R001.
- NG-R002-002: arbitrary unreviewed code or implicit tool/secret access.
- NG-R002-003: a runtime outside the DSH Skill capability.

## 5. Actors and Scope

| Actor | Description | Boundary |
|---|---|---|
| ACT-R002-001 Author | Creates and versions Skills | Cannot publish/install without validation |
| ACT-R002-002 Researcher | Installs and invokes approved Skills | Sees source, version, state, permissions |
| ACT-R002-003 Reviewer | Governs publication/revocation | Owns trust decisions |

### In Scope
- Inventory, editor, triggers, tool permissions, output schema, preview, controlled test, draft/publish/install/revoke lifecycle.

### Out of Scope
- Marketplace economics, organization sharing, and remote package execution.

## 6. User / Business Scenarios

### FLOW-R002-001 Author and test
Actor: ACT-R002-001.
Preconditions: authorized active workspace.
Flow:
1. Define identity, instructions, triggers, tools, and schema.
2. Validate and inspect effective permissions.
3. Run a controlled sample.
4. Save draft or request publication.
Expected Outcome: versioned auditable definition and test result; publication stays gated.

## 7. Functional Requirements

### REQ-R002-001 Skill inventory
System MUST distinguish installed, authored, draft, testing, published, active, disabled, and revoked Skills.
User Value: users understand availability and safety.
Trigger: opening the workspace.
Observable Result: real lifecycle state, ownership, permissions, and version are visible.
Priority: Must.
Agent Behavior Contract: metrics/dataset/threshold pending; retain invocation and permission decisions.

### REQ-R002-002 Authoring and validation
System MUST validate instructions, triggers, tools, schema, examples, and permissions before test/publication.
User Value: authors get actionable feedback.
Trigger: edit, preview, or test.
Observable Result: invalid definitions identify the field, preserve the draft, and block unsafe actions.
Priority: Must.
Agent Behavior Contract: controlled medical Skill Eval and thresholds pending; privacy-filtered trajectories and reviewer handoff required.

### REQ-R002-003 Publication and installation
System MUST expose source, version, publisher, provenance, permissions, review, upgrade, and revocation before activation.
User Value: unsafe or incompatible Skills are not activated unknowingly.
Trigger: publish/install/upgrade/revoke.
Observable Result: each transition is authorized, audited, and recoverable where promised.
Priority: Must.
Agent Behavior Contract: unauthorized transitions equal zero on versioned malicious/permission fixtures; retain actor, version, permission diff, decision, and audit ID.

## 8. Business Rules, Lifecycle, and Edges

- BR-R002-001: a prototype is not publication authorization.
- BR-R002-002: effective tool/secret permissions are shown before activation.
- INV-R002-001: preview/test cannot activate a draft.
- INV-R002-002: a Skill cannot use undeclared tools or credentials.

| ID | Case | Expected Behavior |
|---|---|---|
| EDGE-R002-001 | Invalid draft | Preserve draft, identify error, block unsafe action |
| EDGE-R002-002 | Revoked version | Disable invocation, retain audit, explain recovery |
| EDGE-R002-003 | Upgrade adds permission | Require fresh approval |

Lifecycle proposal: `DRAFT -> VALIDATED -> TESTING -> REVIEW -> PUBLISHED -> INSTALLED -> ACTIVE`, plus `DISABLED` and `REVOKED`; final transitions are unresolved.

## 9. UX, Non-Functional Goals, and Constraints

UX: `asset/skill工作台.png` governs inventory/editor/preview hierarchy; preview and progress must say whether simulated or produced by a controlled run.

| Area | Requirement |
|---|---|
| Performance | Pending realistic workload |
| Reliability | Draft recovery required; guarantee pending |
| Security / privacy | Trust, permissions, secrets, sandbox, and medical-data policy block |
| Accessibility | Keyboard, semantics, focus, and narrow layout required |
| Compatibility | Definition version and DSH compatibility policy block |

Constraint: reuse DSH Skill capability; do not implement from this draft.

## 10. Acceptance Criteria

- AC-R002-001: inventory shows accurate lifecycle, version, ownership, and permission state.
- AC-R002-002: invalid/over-privileged drafts are blocked without data loss.
- AC-R002-003: controlled tests expose inputs, tools, output, errors, and provenance and differ visibly from production.
- AC-R002-004: publish/install/upgrade/revoke follows approved authorization, audit, and recovery.
- AC-R002-005: inventory/editor/preview states match the prototype hierarchy without overlap on desktop/narrow layouts.

## 11. Spec Package Decomposition

Pending approval. No child Spec is authorized while blocking questions remain.

## 12. Risks and Open Questions

| Risk | Impact | Mitigation |
|---|---|---|
| Untrusted package/instruction | Tool/data compromise | Trust, review, sandbox, revocation |
| Medical data exposure | Privacy breach | Classification, redaction, local execution, consent |
| Silent permission expansion | Privilege escalation | Version/diff and reapproval |

| ID | Question | Blocking | Approver | Status |
|---|---|---|---|---|
| Q-R002-001 | Trusted source/review policy? | true | Product/security | open |
| Q-R002-002 | Sandbox and credential model? | true | Architecture/security | open |
| Q-R002-003 | Human-review and revocation lifecycle? | true | Product | open |
| Q-R002-004 | Eval dataset, metrics, thresholds, medical reviewer? | true | Product/medical QA | open |
| Q-R002-005 | Definition compatibility/migration policy? | true | DSH Skill owner | open |

## 13. PRD Ready Check

- [x] Intent, scope, requirements, invariants, edges, and AC are explicit.
- [ ] Independent packages and dependencies are approved.
- [ ] Security, compatibility, and Eval decisions are approved.
- [ ] No blocking question remains.
