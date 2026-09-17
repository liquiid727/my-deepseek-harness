---
requirement: R001
spec_package: S04
source_spec: ./spec.md
source_spec_version: 2.1.1
source_spec_hash: 6ac9a90c01aa1365b1c0b4665f77d7a032f7d5f12c4081c4cf801c478b753572
version: 2.0.0
reviewed_revision: pending
status: open
owner: unassigned
---

# Review - S04 Evidence and Claims

## Findings

No delivery review has been performed. Future findings must use stable
`REVIEW-R001-S04-NNN` IDs.

## Review Context

- Reviewed revision: pending
- Related Spec / Test / Issue IDs: SPEC-R001-S04-001 through SPEC-R001-S04-003; TEST-R001-S04-001 through TEST-R001-S04-005; no Issue
- Review scope: correctness, security, performance, maintainability, tests, and Spec deviations

## Review Gate

- [ ] No blocking finding remains open.
- [ ] Every waiver has approver, rationale, and expiry.
- [ ] Findings trace to Spec, Test, Issue, or rule.

## Spec Design Review — 2.1.0

Review scope: 仅 PRD/Spec 与规范性附件、计划验证；日期 2026-09-12，reviewer Fairy。当前 Spec SHA-256: ae8af8dafa116a6df0c5519965bd8e57176202fe22c5e38562fccf8a3388bba8。源 PRD 2.1.0；批准包含[覆盖表](../../coverage.md)、[接口状态](../../interfaces.md)、[UI 验收](../../ui-acceptance.md)、[内置 Skill](../../builtin-skills.md)及[医学协议](../../evaluation.md)。上述 delivery/historical 记录不代表当前实现通过。

| ID | Severity | Status | Source | Covers | Owner | Evidence | Resolution |
|---|---|---|---|---|---|---|---|
| REVIEW-R001-S04-001 | P0 | resolved | Spec 设计评审：证据资格 | SPEC-R001-S04 全部行为；当前 REQ/AC | Fairy | [Spec](spec.md) 第 8 节及规范附件；[Test Design](test.md) | PARTIAL、UNCERTAIN、二手引用、整体结论和追踪失败状态存在歧义。 共享状态与第 8 节明确资格/精确区间、状态计算、命题验证及 immutable secondary。 |

Design verdict: decision-complete，Spec approved。测试设计为 review，需人工批准；实现、真实截图、Gold Set 与独立 QA 未在本轮执行。

## Shared Project/Session Context Review — 2.1.1

Review scope: 本轮仅审查 S01 统一 Project/Session context 约定在 S04 的来源、隔离和回放边界；日期 2026-09-15，reviewer Fairy。当前 Spec SHA-256: 949dfac7aae0614317e2cd8e7db566a2edcb9486eda5da87008e6903041fbb37。

结论：S04 仅消费 S01 当前 Project/Session binding；Evidence、Claim 和 Citation 的查询、写入与模型输入均限定当前 Project scope。S04 不自行绑定或切换 Project、不注入第二份 Project context、不创建 `medical/project-context` 事件；缺少 binding 与跨 Project 请求分别返回 `PROJECT_NOT_BOUND` 和 `SCOPE_DENIED`。验证结果继续通过业务工具结果记录，模型可见输入与输出通过标准 `tool/result` Session 事件重建，Project Context bundle 仅包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据，不含 Dataset 行、未授权 Project 数据、秘密和完整原始文献。

历史 implementation evidence 保留原始版本身份，不作为 2.1.1 验收；Test Design、实现、浏览器、Gold Set 与独立 QA 的新版本证据仍待后续重新验证，review 保持 open，Spec 状态为 review。
