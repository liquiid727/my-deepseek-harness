---
requirement: R001
spec_package: S05
source_spec: ./spec.md
source_spec_version: 2.1.1
source_spec_hash: 47120ab6b9d96514c558b0be37d906cb4de4fe51f6a1f8a8f79dd809b4b2a8e1
version: 2.0.0
reviewed_revision: pending
status: open
owner: unassigned
---

# Review - S05 Reproducible Statistics

## Findings

No delivery review has been performed. Future findings must use stable
`REVIEW-R001-S05-NNN` IDs.

## Review Context

- Reviewed revision: pending
- Related Spec / Test / Issue IDs: SPEC-R001-S05-001 through SPEC-R001-S05-003; TEST-R001-S05-001 through TEST-R001-S05-005; no Issue
- Review scope: correctness, security, performance, maintainability, tests, and Spec deviations

## Review Gate

- [ ] No blocking finding remains open.
- [ ] Every waiver has approver, rationale, and expiry.
- [ ] Findings trace to Spec, Test, Issue, or rule.

## Spec Design Review — 2.1.0

Review scope: 仅 PRD/Spec 与规范性附件、计划验证；日期 2026-09-12，reviewer Fairy。当前 Spec SHA-256: 86e828a36ac5a0ac134d23fd0ad35347e52195945da468e5c4b84d1473f7c4e6。源 PRD 2.1.0；批准包含[覆盖表](../../coverage.md)、[接口状态](../../interfaces.md)、[UI 验收](../../ui-acceptance.md)、[内置 Skill](../../builtin-skills.md)及[医学协议](../../evaluation.md)。上述 delivery/historical 记录不代表当前实现通过。

| ID | Severity | Status | Source | Covers | Owner | Evidence | Resolution |
|---|---|---|---|---|---|---|---|
| REVIEW-R001-S05-001 | P0 | resolved | Spec 设计评审：统计 | SPEC-R001-S05 全部行为；当前 REQ/AC | Fairy | [Spec](spec.md) 第 8 节及规范附件；[Test Design](test.md) | PRD 审批早于代码生成，方法/图表适用性及成功态对照缺约束。 PRD 与 Spec 顺序统一，审批绑定输入；规定方法、七图正例、失败无产出与代码/图表同屏。 |

Design verdict: decision-complete，Spec approved。测试设计为 review，需人工批准；实现、真实截图、Gold Set 与独立 QA 未在本轮执行。

## Shared Project/Session Context Review — 2.1.1

Review scope: 本轮仅审查 S01 统一 Project/Session context 约定在 S05 的来源、隔离和回放边界；日期 2026-09-15，reviewer Fairy。当前 Spec SHA-256: dc4674e3b22761abcb7825ded429be06fa605259ef508d8ed32757a68d4b8326。

结论：S05 仅消费 S01 当前 Project/Session binding；Dataset、Plan、Run、Result 和 Artifact 的查询、写入与模型输入均限定当前 Project scope。S05 不自行绑定 Project 或改变 Session binding、不注入第二份 Project context、不创建 `medical/project-context` 事件；缺少 binding 与跨 Project 请求分别返回 `PROJECT_NOT_BOUND` 和 `SCOPE_DENIED`。模型可见统计输入与工具输出通过标准 `tool/result` Session 事件重建，Project Context bundle 仅包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据，不含 Dataset 行、未授权 Project 数据、秘密和完整原始文献。

历史 implementation evidence 保留原始版本身份，不作为 2.1.1 验收；Test Design、实现、浏览器、Gold Set 与独立 QA 的新版本证据仍待后续重新验证，review 保持 open，Spec 状态为 review。
