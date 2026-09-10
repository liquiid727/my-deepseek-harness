---
id: ISSUE-R001-S01-001
requirement: R001
spec_package: S01
kind: implementation # implementation | verification
track: implementation # implementation | verification
primary_spec: SPEC-R001-S01-001
source_spec: ../spec.md
source_spec_id: SPEC-R001-S01-001
source_spec_version: 1.0.0
source_spec_hash: <sha256-or-immutable-revision>
source_test: ../test.md
source_test_id: TEST-R001-S01
source_test_version: 1.0.0
source_test_hash: <sha256-or-immutable-revision>
status: todo # todo | in-progress | implemented_pending_verification | verified | blocked
change_profile: behavior # mechanical | behavior | cross-surface | high-risk
priority: P1
owner: <owner>
depends_on: []
---

# ISSUE-R001-S01-001 — <Issue Title>

## Covers

- REQ-R001-001
- SPEC-R001-S01-001
- TEST-R001-S01-001
- AC-R001-001

## Goal

完成后系统增加 / 改变什么，以及用户或运营方能观察到的结果。

## Scope

### Must

- ...
- 为本次变更声明最小、定向的验证命令；若存在合适的代码级接缝，添加或更新关联单元测试。
- 若单元测试不适用，记录 `N/A` 理由；不得以此替代 verification Issue 的正式验证。

### Must Not

- 不修改无关 Spec Package。
- 不重新定义 PRD / Spec / Test Design。
- 不通过弱化测试绕过 Spec。
- 不进行无关重构。
- 不把 AI 生成的测试草稿未经人工审核直接作为 Gate Evidence。

## Expected Areas (conditional)

- src/... | tests/... | Not applicable
- Significant architectural deviation MUST block and return to Spec review.

## Implementation Context

执行前 MUST 按顺序读取：

1. 根 `prd.md` 和 `index.yaml`。
2. 本目录的 `spec.md`。
3. 本目录的已批准 `test.md`（实现与验证 Issue 都必须读取，以保持版本追溯）。
4. 本 Issue、`review.md`、`evidence/` 和 `acceptance.md`。
5. 真实 Codebase、Architecture 和 Existing Tests。

## Execution Preflight

Confirmed Facts:
- <source path, command, or observed fact>

Unverified Assumptions:
- None | <assumption and planned check>

Production Consumers / Real Entry Paths:
- <consumer, command, route, service, or workflow>

Affected Surfaces and Planned Checks:

| Surface | Consumer / real entry | Planned verification | Required evidence | Gate impact |
|---|---|---|---|---|
| source \| package-api \| cli-config \| browser-ui \| generated-output \| model-visible-output \| build-release-artifact \| persistence-protocol \| security-concurrency-cleanup | ... | ... | ... | blocking \| warning \| informational |

Unrelated Worktree Changes:
- None | <paths to preserve>

Human Decisions Required:
- None — <rationale> | <decision and owner>

For `change_profile: mechanical`, also record why the edit has no semantic
effect. A semantic Issue requires at least one concrete surface row with a
real consumer/entry path and planned check.

## Tasks

- [ ] ...
- [ ] 运行 `## Validation` 中声明的定向验证命令。
- [ ] 添加或更新关联单元测试；不适用时记录 `N/A` 理由。
- [ ] 若 `kind: verification`，生成并登记所需执行证据。
- [ ] 对 AI 生成的用例草稿完成人工审核（适用时）。

## Acceptance Criteria

- Given ... When ... Then ...
- Observable result: ...

## Validation

> implementation Issue 只列出本次变更需要的快速、定向验证；不得自动扩展为
> 全量回归、性能、并发或 Gate。verification Issue 按绑定的 `test.md` 执行正式
> 场景与 Gate。

- [ ] <implementation: changed-scope unit / lint / build / smoke command>
- [ ] <verification: TEST-R001-S01-001 and its required runner scope>
- [ ] <verification only: evidence normalized and registered in `evidence/index.yaml`>
- [ ] No unexplained Spec Deviation

## Dependencies

Depends On:

- None

Blocks:

- ...

## Required Evidence

> Required only for `kind: verification`, unless the approved Issue explicitly
> declares implementation evidence. Otherwise write `N/A — verification Issue
> owns release evidence` in the Completion Record.

- Evidence type: <normalized-result | report | trace | screenshot | log | gate-report>
- Gate impact: blocking | warning | informational
- Location: ../evidence/<plans|runs|gates|artifacts>/<run-id>/
- Must include: TEST, SPEC/version, ISSUE, commit, environment, time, result

## Completion Record

Status: todo
Implemented By:
Completed At:
PR / Commit:
Changed Files:
Tests Executed:
Evidence References:
Design Decisions:
Alternatives Considered:
Tradeoffs:
AI Draft Review:
Spec Deviation: None
Open Questions: None
Checks Skipped:
Verified Behavior:
Known Limitations / Residual Risk:
Intentionally Untouched:
