# Repository Guardrails 标准

[English](repository-guardrails.md) | 中文

## Summary

Repository Guardrails 是让 human developer、AI coding agent、本地 hook 和 CI 得到同一答案的可执行规则。Lefthook 只是 adapter。标准 command 才是执行事实的来源。

## Table of Contents

- [运行模型](#operating-model)
- [Guardrail 原则](#guardrail-principles)
- [规则层](#rule-layers)
- [命令架构](#command-architecture)
- [语言 profile](#profiles)
- [证据与阻断](#evidence-and-blocking)
- [建议的仓库结构](#recommended-repository-shape)
- [落地计划](#adoption-plan)
- [复制、适配与拒绝](#copy-adapt-and-reject)

## Operating model

Repository Rules 写在 project context、architecture contract、specification、issue record 和 documented tool contract 中。Guardrails 将这些规则编译为 executable verification。每个执行 context 都调用同一组 command。

Repository Rules -> Human developer、AI agent 或 CI -> standard guardrail command -> syntax、semantics、architecture 和 delivery check -> evidence record。

Prompt 是 soft constraint。Guardrail 是 hard constraint。凡是能从仓库状态检查的规则，都不应依赖 agent 记住。

## Guardrail principles

### One rule, one owner

把规范性规则放在 project context、architecture contract、spec 或 tool contract 中。hook、CI workflow 和 agent prompt 可以引用它，但不能各自创建冲突副本。

### One command, many adapters

Human developer、agent、Lefthook、CI 和 release job 调用同一组命名 command。adapter 只选择 timing 和 scope，不重新实现 verification logic。

### Fail at the earliest useful point

在 commit 前运行便宜的确定性检查。需要 clean checkout、build artifact、credential、多操作系统或外部服务的检查放在 CI。不要只为了让 hook 看起来完整就把检查前移。

### Make invalid states observable

guardrail 必须报告 rule、受影响的 path 或 entity、observed value、expected value，以及存在时的 repair command。静默 skip 和笼统的“修复它”消息不可接受。

### Separate repair from confirmation

formatter 可以改写代码，generated-file command 可以重新生成 output。spec 或 translation confirmation 不能被 hook 静默合成。confirmation 必须有显式 command 和可 review 的 diff。

### Re-run independently

本地成功改善反馈，但不建立 merge eligibility。CI 从 clean checkout 执行，验证完整 scope，并产出 required merge verdict。

## Rule layers

| Layer | 示例 | 主要证据 |
| --- | --- | --- |
| Syntax | formatting、parser validity、lint、typecheck。 | tool output 和 exit status。 |
| Semantics | unit behavior、integration behavior、docs pairing、generated freshness、spec consistency。 | test、record、hash 或 generated diff。 |
| Architecture | dependency direction、module boundary、API ownership、database migration policy。 | graph check、contract test、migration dry run。 |
| Delivery | artifact layout、license、dependency policy、secret scan、release install。 | clean artifact 和 environment check。 |

Project context 为 architecture contract 提供输入。delta-spec 描述预期变更。code 实现它。tests、docs 和 external contract 提供独立证据。Guardrails 评估最终 repository 和 artifact。

## Command architecture

推荐的层次是：

- task runner 或 package scripts 提供 `guard:fast`、`guard:commit`、`guard:push`、`guard:ci` 和 `guard:release` 等稳定名称；
- `scripts/verify/` 或语言工具实现带 structured diagnostics 的 check；
- Lefthook 调用一两个 aggregate command，只在必要时处理 staged-file selection；
- CI 调用同样的 aggregate command，并增加环境相关 job；
- agent adapter 调用同样的 command，并解析 exit code 和 machine-readable report。

`lefthook.example.yml` 中的示例有意不包含 policy logic。它委托给 `pnpm guard:commit` 和 `pnpm guard:push`。Go 仓库可以用 `make guard-commit`，Python 仓库可以用 `uv run guard commit`；command 名称可以不同，ownership rule 不能不同。

## Profiles

### Language-agnostic core

每个 repository profile 都应定义 formatting、linting、可用时的 static typing、unit test、integration test、architecture check、API contract check、database migration check、documentation consistency、i18n consistency、generated-file freshness、secret scan、dependency policy、license policy 和 release artifact verification。profile 可以声明某类别不适用，但必须记录这个决定，不能静默省略。

### Go profile

Go 实现可以把 formatting 映射到 `gofmt`，把 static analysis 映射到 `go vet` 和 `golangci-lint`，把 tests 映射到 `go test`，把 vulnerability evidence 映射到 `govulncheck`。Architecture 和 specification check 仍由 repository-owned script 负责。

### Python profile

Python 实现可以把 formatting 和 lint 映射到 Ruff，把 typing 映射到 `mypy` 或 `pyright`，把 tests 映射到 `pytest`。FastAPI 项目应在 API category 加入 OpenAPI generation 和 contract test。

### TypeScript profile

TypeScript 实现可以把 formatting 映射到 Prettier，把 lint 映射到 ESLint 或 Oxlint，把 typing 映射到 `tsc`，把 tests 映射到 Vitest 或仓库选定的 runner。React 项目在用户 workflow 受影响时，应在 CI 增加 browser 或 accessibility check。

Tool choice 可以替换。稳定接口是 guardrail identifier、scope、blocking policy 和 evidence schema。

## Evidence and blocking

每项 check 都产出包含 stable identifier、scope、command、tool version、start/end time、changed revision 和 diagnostic location 的 result。本地通过只证明本地 revision。CI result 证明被检查的 commit 和 environment。

Blocking rule 必须显式。某项 check 只有在 matrix 标记时，才会阻止 commit、push、pull request、merge 或 release。Observational check 仍需发布 result，不能被报告为 blocking check 已通过。

Exception 需要 owner、reason、expiry、受影响的 guardrail，以及 issue 或 decision record。“agent 无法让它通过”不是 exception reason。

## Recommended repository shape

优先使用现有仓库的自然 task runner。下面是概念布局，不是要求照搬：

`guardrails/` 保存 rule manifest 和 result schema。

`scripts/verify/` 保存不属于语言工具配置的 repository check。

`specs/` 保存 accepted specification 和 delta-spec。

`docs/engineering/` 保存 lifecycle、guardrail、architecture 和 agent contract。

`lefthook.yml` 或等价 hook adapter 只包含 lifecycle 到 command 的映射。

`Makefile`、`Taskfile`、`package.json` 或 `pyproject.toml` 为 human、agent 和 CI 暴露稳定 command vocabulary。

Generated file 声明自己的 source，并提供确定性的 `--check` mode。破坏性或联网 check 不应从 fast hook 隐式运行。

## Adoption plan

### Phase 1: basic code quality

增加 format、lint、typecheck 和 unit-test command。让本地 command 可复现，让 pre-commit 只运行便宜的确定性子集。

### Phase 2: repository consistency

增加 documentation link、generated-file freshness、API contract、migration validation、i18n pairing、dependency policy 和 license check。全 scope 版本放在 CI。

### Phase 3: architecture guardrails

定义 dependency direction 和 module ownership。增加对 forbidden import、layer violation 或 package cycle 失败的 graph check。Architecture exception 必须显式且有时限。

### Phase 4: specification-driven development

material change 必须有 accepted spec 和 delta-spec。验证 changed file 是否在声明 scope 内，把 spec-test case 连接到 acceptance criteria，并发布 traceability evidence。

### Phase 5: AI-native development

实现 Agent Completion Contract、machine-readable result report、有界 automatic repair、独立 re-verification，以及列出每项 check 和 revision 的最终 completion summary。

## Copy, adapt, and reject

### Copy

复制 DSH 对 hook adapter 与 gate ownership 的分离、staged-versus-worktree awareness、显式 generated-file freshness、deterministic diagnostics、有界并发、CI backstop 和 stable required verdict。

### Adapt

只有在目标项目具有相同风险时，才适配 Git worktree-safe installer、aggregate gate scheduler、bilingual pairing record、generated-region rule 和 release-shaped artifact check。Go、Python 或 TypeScript 工具都应放在同一组 guardrail identifier 后面。

### Do not copy

不要复制完整 DSH gate inventory、Cordis-specific invariant、Session snapshot policy、package layout，或没有测量需要就引入大型 custom scheduler。不要在 hook 文件中放几十条 shell command。不要让 hash record 代替 semantic review。
