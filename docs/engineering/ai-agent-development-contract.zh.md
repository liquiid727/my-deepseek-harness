# AI Agent 开发契约

[English](ai-agent-development-contract.md) | 中文

## Summary

AI coding agent 只有在运行了变更 scope 要求的检查、保存结果并重新检查最终 revision 后，才可以宣布完成。Prompt 引导 agent；executable guardrail 决定 repository state 是否可接受。

## Table of Contents

- [完成契约](#completion-contract)
- [Agent 执行循环](#agent-execution-loop)
- [必需证据](#required-evidence)
- [Scope 分类](#scope-classification)
- [失败与修复](#failure-and-repair)
- [完成消息](#completion-message)
- [安全与权限](#security-and-authority)

## Completion contract

在说任务完成前，agent 必须：

1. 识别 changed file 和适用的 guardrail profile；
2. 运行 formatting，或确认没有适用 formatter；
3. 运行 lint 和 static check；
4. 在语言支持时运行 typecheck；
5. 运行 focused test 和 required broader test tier；
6. 对结构变更运行 architecture 与 dependency-direction check；
7. 对受 spec 管理的变更运行 specification、delta-spec 和 traceability check；
8. 对文档或 generated change 运行 docs、i18n 和 generated-file check；
9. 检查最终 diff 和 repository status；
10. 报告 command、revision、pass/fail status 和未验证项。

Required check 失败、未获批准而 skip，或根本没有运行时，agent 不得报告“任务完成”或“completed”。它可以报告明确的 partial result 和 blocking diagnostic。

## Agent execution loop

标准循环是：

1. 读取 project context、architecture contract、accepted spec 或 issue，以及本地 instructions。
2. 将变更分类为 code、docs、generated output、API、database、architecture、security 或 release work。
3. 在现有 tree 可能已经为红时运行 baseline check。
4. 在声明 scope 内做最小的连贯修改。
5. 只对 repair policy 明确的工具运行 automatic repair。
6. 运行 scoped guardrail command。
7. 把 failure 当作 data，修复 owner source，再次运行 check。
8. 运行代表 completion claim 的 lifecycle aggregate。
9. 检查最终 diff 的意外修改并记录 residual risk。

Agent 写代码 -> guardrail command -> failure diagnostics -> agent repair -> independent recheck -> evidence -> completion claim

Recheck 必须再次执行 command。Agent 不得从成功编辑，或从没有覆盖 changed contract 的 test，推断 check 已通过。

## Required evidence

| Change category | 最低证据 | Completion blocker |
| --- | --- | --- |
| Ordinary source change | format、lint、typecheck、focused test、final diff。 | 任意 required failure。 |
| Public API change | ordinary evidence 加 API schema 和 contract test。 | schema drift 或缺少 consumer update。 |
| Architecture change | ordinary evidence 加 dependency graph 和 architecture contract check。 | forbidden dependency 或未记录 exception。 |
| Database change | migration validation、forward apply、rollback 或支持的 downgrade evidence，以及 integration test。 | 不安全或无法复现的 migration。 |
| Documentation change | link、wrap、structure、i18n pairing、generated freshness，以及发布时的 doc-site check。 | counterpart 缺失、record 过期或 dead link。 |
| Generated file change | generator `--check` 或 deterministic regeneration 加 source review。 | 手工编辑造成的 stale output。 |
| Security-sensitive change | focused security test、secret scan、dependency scan 和 review evidence。 | 未 review 的 security result 或暴露 secret。 |
| Release change | build、pack、clean-install、artifact smoke 和 release metadata verification。 | artifact 无法安装或验证。 |

Agent 要记录 command output 或 compact result reference。只写“tests pass”而没有 command 名称与 scope 不够。

## Scope classification

只触及局部实现的变更可以使用最小适用检查。跨越 package、public API、持久化数据、安全控制、generated file 或 user-visible workflow 的变更必须扩大 evidence set。混合变更使用所有受影响 category 的并集。

Project context 定义全局约束。Architecture contract 定义允许的 dependency 和 ownership。Delta-spec 定义预期变更。Spec-test 把 acceptance criteria 映射到 executable test。Issue 提供 defect identity 和 regression scope。Guardrail 检查 code、test、docs 和 contract 是否保持对齐。

## Failure and repair

当 matrix 标记时，failure 是 blocking。Agent 只可以在有界 policy 下重试 flaky external check，并报告原始 failure 和 retry result。它不得为了让 command 变绿而削弱 check、删除 test、扩大 exception 或重新记录 hash。

当 command 明确说明修改内容时，可以对 formatting、safe import 和 deterministic generated output 进行 automatic repair。不得静默改写 acceptance criteria、architecture contract、API schema、database history、translation 或 security finding。

Baseline 已红时，agent 要区分 pre-existing failure 与 new failure，在可能时证明变更没有增加 failure，并报告剩余 baseline blocker。如果任务自身 required evidence 缺失，不得宣称任务完成。

## Completion message

最终报告应先说明 implementation result，再说明 evidence。报告 changed scope、运行的 command、pass/fail status、baseline blocker 和未验证 environment。可接受的说法是：“Implemented X；format、lint、typecheck、focused test 和 architecture check 在 revision Y 通过。CI 与 Windows 尚未验证。”不可接受的说法是：“Done; it should work.”

## Security and authority

Guardrail 不授予 agent publish、merge、删除数据、暴露 credential 或修改 policy 的权限。Agent 仍需对 external write 和 destructive operation 获得明确授权。本地 guardrail 绿色只证明 repository state，不代表获准 ship。
