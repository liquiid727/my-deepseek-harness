# 开发生命周期

[English](development-lifecycle.md) | 中文

## Summary

生命周期把每项检查分配给能够可靠执行它的最早 context，也分配给仍能阻止不安全交付的最晚 context。本地反馈要快；CI 要独立且完整；merge gate 消费稳定 verdict。

## Table of Contents

- [生命周期模型](#lifecycle-model)
- [L0 editor](#l0-editor)
- [L1 pre-commit](#l1-pre-commit)
- [L2 pre-push](#l2-pre-push)
- [L3 pull request](#l3-pull-request)
- [L4 merge](#l4-merge)
- [L5 release](#l5-release)
- [绕过与恢复](#bypass-and-recovery)

## Lifecycle model

Editor -> commit -> push -> pull request -> merge -> release

每一层应回答不同问题。L0 询问编辑是否在本地结构正确。L1 询问拟提交的 commit 是否内部干净。L2 询问 branch 是否仍满足项目契约。L3 询问 clean environment 是否证明变更。L4 询问所有 required evidence 是否存在。L5 询问用户拿到的 published artifact 是否可用。

## L0 editor

L0 是交互式且 non-blocking 的。它应在保存时运行 formatting、parser diagnostics、language-server type diagnostics 和 focused test。editor 可以使用 daemon 或 cache，但 repository command 仍是可复现 fallback。

L0 不能是规则唯一存在的位置。部分 human 没有 editor extension，clean CI checkout 也不会有。

## L1 pre-commit

L1 适合在 staged change 上运行的确定性 cheap check。它可以在 repair 透明且会重新暂存时修复 formatting 或重新生成直接拥有的 generated file。它不应运行 network call、full build、browser suite、live API test 或 multi-minute coverage。

DSH 示例使用 staged translation pairing、archived-note validation、staged Oxlint、third-party notice regeneration、whitespace validation 和 vendor manifest check。它的 `pre-merge-commit` 只重复 merge-sensitive subset。

## L2 pre-push

L2 适合需要 branch-wide context、但不需要 CI matrix 的中成本 check。Typecheck、focused integration test、migration dry run 和 local build 在经过成本与可靠性测量后可以放在这里。

DSH 当前在 `pre-push` 使用 whole-project `pnpm run typecheck`。Coverage、browser snapshot、full build 和 cross-platform verification 留给 CI。

## L3 pull request

L3 从 clean checkout 运行并验证完整 intended scope。仓库可以拆分独立 job，但 leaf command 必须只有一个 owner。Environment-dependent test 应放这里：integration、E2E、browser、coverage、build、artifact smoke、security、dependency 和 license check。

DSH 的 `scripts/run-gates.ts` 提供 named aggregate。workflow 选择 `check:ci:static`、`check:ci:coverage`、`check:ci:bench`、`check:ci:consumers`、`check:node-compat`、Windows aggregate 和 primary aggregate。Static aggregate 包含 repository consistency 与 documentation check；primary aggregate 额外包含 typing、lint、duplication、test、snapshot、build 和 built consumer。

## L4 merge

L4 是 policy verdict，不是另一项 implementation test。Branch protection 应要求一个稳定 aggregate，并在任意 blocking job failure、cancellation 或 skip 时失败。DSH 的 `all-checks-passed` 使用 `if: always()`，明确拒绝 failure、cancellation 和 skipped dependency，避免 skipped required job 形成 false green。

## L5 release

L5 验证用户收到的 artifact。它应包含 package 或 binary build、dependency layout、packed-install smoke、native target coverage、release metadata、license 和 notice output，以及 publish precondition。Release workflow 可以使用不同 credential 和操作系统，但必须消费相同的 guardrail identifier 并报告 artifact evidence。

## Bypass and recovery

本地 hook bypass 是预期可能发生的，且不能削弱 CI。bypass flag、缺失 hook 安装或 agent 直接执行只会移除本地反馈，不会创建 completion claim，也不会改变 required CI verdict。

检查失败时，output 应指出 owner 和 repair command。正常循环是读取 diagnostic、修改最小相关 source、重跑 scoped command，再重跑当前 lifecycle level 要求的 aggregate。Generated 或 confirmation command 绝不能用来掩盖未 review 的语义修改。
