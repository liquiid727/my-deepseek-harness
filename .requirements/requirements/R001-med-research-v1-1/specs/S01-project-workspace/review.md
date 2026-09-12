---
requirement: R001
spec_package: S01
source_spec: ./spec.md
source_spec_version: 2.1.0
source_spec_hash: 3d1fac01601985ad283ce24d7353e2ae28aec4445485bc230793b7c0ddbd201a
version: 2.0.0
reviewed_revision: worktree-20260912
status: open
owner: med-research
---

# Review - S01 Project Workspace

## Findings

### REVIEW-R001-S01-001

- Severity: P1
- Status: resolved
- Source: browser verification
- Covers: SPEC-R001-S01-001, SPEC-R001-S01-002, SPEC-R001-S01-003; TEST-R001-S01-004
- Owner: med-research
- Evidence: `./evidence/index.yaml` run `S01-browser-hero-entry-20260911`
- Resolution: Superseded by `S01-browser-research-home-20260911`. A clean current-worktree profile transitions to Research Home and creates a project with persisted zeroed overview counts at desktop and narrow viewports.

### REVIEW-R001-S01-002

- Severity: P1
- Status: open
- Source: visual review against `asset/首页.png`
- Covers: SPEC-R001-S01-002; TEST-R001-S01-004
- Owner: med-research
- Evidence: `./evidence/index.yaml` run `S01-browser-research-home-20260911`; fresh-profile visual review on 2026-09-12
- Resolution: The Research Home hierarchy and styling were rebuilt, but final acceptance remains pending a fresh-profile screenshot proving the host composer no longer obscures the S01 content.

## Review Context

Implementation checkpoint review rerun on 2026-09-12 against the current dirty worktree. Focused typecheck, package tests, client build, and client bundle verification all passed. No new actionable code finding was identified. REVIEW-R001-S01-002 remains open because this turn did not produce a fresh real-profile screenshot proving composer clearance.

- Reviewed revision: worktree-20260911
- Related Spec / Test / Issue IDs: SPEC-R001-S01-001 through SPEC-R001-S01-003; TEST-R001-S01-001 through TEST-R001-S01-005; no Issue
- Review scope: correctness, security, performance, maintainability, tests, and Spec deviations

## Review Gate

- [ ] No blocking finding remains open.
- [x] Every waiver has approver, rationale, and expiry.
- [x] Findings trace to Spec, Test, Issue, or rule.

## Spec Design Review — 2.1.0

Review scope: 仅 PRD/Spec 与规范性附件、计划验证；日期 2026-09-12，reviewer Fairy。当前 Spec SHA-256: 3d1fac01601985ad283ce24d7353e2ae28aec4445485bc230793b7c0ddbd201a。源 PRD 2.1.0；批准包含[覆盖表](../../coverage.md)、[接口状态](../../interfaces.md)、[UI 验收](../../ui-acceptance.md)、[内置 Skill](../../builtin-skills.md)及[医学协议](../../evaluation.md)。上述 delivery/historical 记录不代表当前实现通过。

| ID | Severity | Status | Source | Covers | Owner | Evidence | Resolution |
|---|---|---|---|---|---|---|---|
| REVIEW-R001-S01-003 | P0 | resolved | Spec 设计评审：覆盖/界面 | SPEC-R001-S01 全部行为；当前 REQ/AC | Fairy | [Spec](spec.md) 第 8 节及规范附件；[Test Design](test.md) | 项目/概览动作缺具体责任，原型缺密度与可截图判据。 第 8 节明确数据/导航/Mode/备份；UI-HOME 与三个视口的流程绑定。 |

Design verdict: decision-complete，Spec approved。测试设计为 review，需人工批准；实现、真实截图、Gold Set 与独立 QA 未在本轮执行。REVIEW-R001-S01-002 的实现视觉问题仍 open，必须用当前真实 profile 证据解决，不能由合同订正关闭。
