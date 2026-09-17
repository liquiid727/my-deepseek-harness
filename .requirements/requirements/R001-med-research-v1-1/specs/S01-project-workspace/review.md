---
requirement: R001
spec_package: S01
source_spec: ./spec.md
source_spec_version: 2.1.3
source_spec_hash: d345dc9f36a876e36a6f9ba144863acb970094acfc53b913055c90ab81ae68e8
version: 2.1.0
reviewed_revision: worktree-20260915
status: open
owner: med-research
---

# Review - S01 Project Workspace

2026-09-15：Spec 2.1.2 完成设计复核。首页 composer 修正与专项证据见 [home-composer](evidence/home-composer.md)。实现视觉 finding、独立 Test Design review、浏览器 QA 和医学评审仍按各自流程处理，status 仍 open。

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

### REVIEW-R001-S01-004

- Severity: P1
- Status: resolved
- Source: Spec design review 2.1.2 against the model-facing project tool surface
- Covers: SPEC-R001-S01-001; REQ-R001-018
- Owner: med-research
- Evidence: [Spec](spec.md) §4 and §8; `plugins/med-research/packages/plugin-project/src/tools.ts` (`project_create`, `project_get`, `project_get_context`); `plugins/med-research/packages/plugin-project/src/service.ts` (`selectProject`, `bindSession`)
- Resolution: Spec 2.1.3 将唯一入口限定为组合 Project Context bundle，允许 `project_create`/`project_get` 返回各自结果，并把显式 `project_get_context(projectId)` 定义为写入 `project.select` 审计的项目选择；Test Design 已更新当前 Spec 版本/hash 绑定，仍处于 review。

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

## Spec Design Review — 2.1.2

Review scope: 仅复核 S01 Spec 2.1.2 相对 2.1.1 的上下文记录修订、DSH Session 兼容性、项目 binding/审计语义、错误与敏感数据边界，以及 Test Design 绑定。复核日期 2026-09-15，reviewer Fairy。当前 Spec SHA-256: 285b6a30996c26a4547bfc9f7ba439d62dcded821490614c11dc0e75ca6d47d3。

已确认：Spec 不再要求插件写入未登记的 `medical/project-context` event；模型上下文通过 `project_get_context` 工具结果进入标准 `tool/result` Session log；`PROJECT_NOT_BOUND`、禁止静默回退、审计与敏感字段限制均已写入；Test Design 已绑定当前 Spec 版本和 hash，仍保持 review。

Design verdict: blocked by REVIEW-R001-S01-004。当前版本尚未 decision-complete，不能恢复 `approved` 状态。该 finding 解决后需重新计算 Spec hash、更新 Test Design 绑定并重跑本节设计复核；实现、浏览器 QA、Gold Set、医学评审和 acceptance 仍属于后续流程。

## Spec Design Review — 2.1.3

Review scope: 仅复核 S01 Spec 2.1.3 对 Project/Session binding、组合 Project Context bundle 和 Session replay 语义的修订；日期 2026-09-15，reviewer Fairy。当前 Spec SHA-256: e70176f45712606e5c2f76fe9e4061bfd2c1d990cd99699a7eb269a3b150dc0a。

已确认：`project_create`、客户端 `selectProject` 与显式 `project_get_context(projectId)` 的三条 binding 路径及其 `project.create`/`project.select` 审计记录已明确；无参数 `project_get_context()` 只读取当前 binding，无 binding 返回 `PROJECT_NOT_BOUND`；`project_get_context` 是组合 Project Context bundle 的唯一入口，`project_create`/`project_get` 仅返回各自操作或单项目读取结果；bundle 限定为当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据，排除 Dataset 行、未授权数据、秘密和完整原始文献；模型可见工具输出统一使用标准 `tool/result` Session event，不产生 `medical/project-context`；跨存储失败可能留下部分持久化且不得报告成功。Test Design 仅更新版本/hash，保持 review；acceptance 与历史 implementation evidence 未改写。

Design verdict: review。REVIEW-R001-S01-004 的设计歧义已解决；该轮只完成规格和绑定记录修订，尚需重新批准。代码实现、测试执行、浏览器 QA、Gold Set、医学评审和 acceptance 仍属于后续流程。REVIEW-R001-S01-002 的实现视觉问题仍 open，历史 finding 保留。
