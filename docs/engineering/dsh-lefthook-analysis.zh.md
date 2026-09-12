# DSH Lefthook 与仓库门禁分析

[English](dsh-lefthook-analysis.md) | 中文

## Summary

本文逆向分析当前 DeepSeek Harness 仓库控制机制，并把已观察到的实现、架构推断和面向语言无关 Repository Guardrails 系统的建议分开。

## Table of Contents

- [范围与证据](#scope-and-evidence)
- [执行架构](#execution-architecture)
- [Hook 清单](#hook-inventory)
- [翻译配对架构](#translation-pairing-architecture)
- [快速反馈与强校验](#fast-feedback-and-strong-validation)
- [DSH 特有实践与可复用实践](#dsh-specific-and-reusable-practices)
- [值得学习的十点](#ten-lessons-worth-learning)
- [发现与限制](#findings-and-limits)

## Scope and evidence

主要证据来自 `lefthook.yml`、`package.json`、`scripts/install-lefthook.mjs`、`scripts/run-gates.ts`、translation-pairing 脚本与测试，以及 `.github/workflows/` 下的 pull-request workflow。当前 checkout 还有既存脏改动；本文不把这些改动视为本次分析的一部分。

事实：当前本地 hook 是 `pre-commit`、`pre-merge-commit` 和 `pre-push`。已提交的 Lefthook 配置没有声明 `commit-msg`、`post-checkout` 或 `post-merge` job。

推断：DSH 有意保持 hook 工作量较小，把仓库级校验放进命名 package script 和 gate runner。`lefthook.yml` 顶部注释明确说明完整的全仓库矩阵由 CI 负责。

未知：本仓库不能证明每位贡献者都安装了 hook，也不能证明贡献者的全局 Git hook manager 没有增加其他 hook。因此 CI 是权威兜底。

## Execution architecture

当前执行链是：Git command -> Git 选择 hook -> worktree 本地 `core.hooksPath`，位置为 `.git/dsh-hooks` -> Lefthook 生成的 launcher -> `lefthook run <hook>` -> `lefthook.yml` 中的命令 -> scripts 与 package commands -> exit status 返回 Git。

普通 commit 的具体链路是：

`git commit` -> `pre-commit` -> 暂存翻译记录、归档 note、暂存 Oxlint、生成 notices、空白检查和 vendor manifest -> hook 成功后允许 commit。

merge commit 会执行 `pre-merge-commit`，重复两个与 merge 直接相关的检查：暂存翻译记录和归档 agent note。merge driver 更早在 Git 合并文件时运行，由 `scripts/install-lefthook.mjs` 安装。

push 的链路有意只调用一个 aggregate command：`pre-push` -> `pnpm run typecheck` -> 只有 exit status 为零才继续 push。DSH 没有把完整 CI 矩阵放入 push hook。

安装链路是 `pnpm install` -> 根 `postinstall` -> `node scripts/install-lefthook.mjs` -> Git/worktree 安全检查 -> worktree 本地 `core.hooksPath` -> `lefthook install --force`。在 CI 中，如果 `CI=true` 或 `GITHUB_ACTIONS=true`，安装器会在 Git 探测或修改前返回。

安装器还会创建所有权标记、使用安装锁、拒绝覆盖无所有权的 hook 路径、保留已有的 common hooks，并安装 `dsh-translation-pairing` merge driver。这些行为在 `scripts/install-lefthook.mjs`，不在 `lefthook.yml`。

## Hook inventory

| Hook | 目的 | 触发与范围 | 命令 | 失败行为 | CI 对应物 | 成本定位 |
| --- | --- | --- | --- | --- | --- | --- |
| `pre-commit` | 在 commit 创建前拒绝或修复便宜的暂存不一致。 | 每次 commit；主要是暂存文件，也包含归档 note 和 vendor 状态检查。 | `verify-translation-pairing --cached`、归档 note 校验、带安全修复的暂存 Oxlint、第三方 notice 重新生成、`git diff --cached --check`、vendor manifest 校验。 | 非零命令阻止 commit；安全 lint 修复会重新暂存。 | `doc-sync`、static CI、测试断言和 primary CI aggregate 覆盖对应规则。 | 适合本地循环；不运行完整测试或 build。 |
| `pre-merge-commit` | 防止 merge commit 记录无效的暂存 pairing record 或归档 note。 | Git 创建 merge commit 时；使用暂存 index。 | cached translation pairing 和 archived-note 校验。 | 非零命令阻止 merge commit，但保留 merge 结果供修复。 | 完整 `doc-sync` 和 CI static 校验。 | 成本小，因为生成 merge 结果本身已经昂贵。 |
| `pre-push` | 在远程发布前捕获最有价值的本地类型契约错误。 | 每次 push；通过 package script 检查整个 TypeScript 项目。 | `pnpm run typecheck`。 | 非零命令阻止 push。 | `check:ci`、static CI、Node compatibility 和 artifact consumer 在更宽范围运行类型检查。 | 中等；有意低于 build、coverage、browser 和完整集成测试。 |
| `commit-msg` | 没有找到仓库自有实现。 | DSH 没有配置。 | 无。 | Git 不会从本仓库得到 commit message policy。 | CI 有 Issue 和 PR policy 校验，但没找到 commit-message 对应校验。 | UNKNOWN。 |
| `post-checkout` | 没有找到仓库自有实现。 | DSH 没有配置。 | 无。 | DSH 无动作。 | 没找到对应物。 | UNKNOWN。 |
| `post-merge` | 没有找到仓库自有实现。 | DSH 没有配置。 | 无。 | DSH 无动作。 | 没找到直接对应物。 | UNKNOWN。 |

生成的 launcher 支持 `LEFTHOOK=0`，可在本地绕过 Lefthook；`LEFTHOOK_VERBOSE` 会打印 shell trace。这些是本地执行控制，不是验证通过的证据。

## Translation pairing architecture

### Pair identity

对于英文文档 `foo.md`，`translationPairPaths()` 会严格推导三个同目录文件：`foo.md`、`foo.zh.md` 和 `foo.i18n.yaml`。发现范围包括 `docs/`、`.agents/notes/`、`python/`、非 vendor README 以及选定的根文档。仓库内的 `scripts/translation-pairing.manifest.json` 保存显式排除项。

### The sidecar record

`.i18n.yaml` 是小型一致性记录，不是翻译数据库。它恰好包含两条非注释记录：英文文件 basename 和中文文件 basename，各自对应一个 40 字符 Git blob hash。注释说明这些 hash 表示最后一次确认一致的状态，并且两种语言具有同等权威。

该记录使用 Git blob hash，而不是 commit hash。`gitBlobHash()` 对 `blob <byte length>\0` 加精确文件字节进行 hash，与 `git hash-object` 一致。因此 pair 可以在尚未 commit 时确认，也不依赖 branch 历史。

### What “last confirmed-consistent state” means

verifier 读取当前 worktree，或者在 `--cached` 模式下读取 stage-zero Git index。它计算两侧当前 blob hash，并与 sidecar 中的两个 hash 比较。只要不一致，就会产生观察到的“content no longer matches the pair's last confirmed-consistent state”错误。

`--write <pair>` 不会翻译任何文档。它把当前精确字节存入本地 Git object database，把两个 hash 写入 sidecar，并要求显式 pair 参数或 `--all`。Git adapter 还会把存储对象固定在 `refs/dsh/translation-pairing/snapshots/` 下，避免 recovery pointer 立即因 garbage collection 失效。因此该命令记录的是经过 review 的状态，不证明翻译质量。

### Structural verification

实现使用 `mdast-util-from-markdown`、GFM extensions 和 `mdast-util-gfm` 解析两个 Markdown 文件。它不比较渲染后的 HTML，也不对正文使用文本全等比较。

AST 遍历按文档顺序记录以下 signature：

- heading depth，因此 H2 与 H3 的差异会报告为 `heading (depth)`；
- fenced code block 的 language、metadata 和逐字节 body；
- table 的行数和列数；
- list kind、ordered-list start 和直接 item 数量；
- semantic link target，并排除 language-switcher link。

heading-depth 比较是 Markdown AST heading node 的有序数组比较。code-block 比较是 fence info string 与 AST node 生成的精确 code body 的有序比较。实现中的“out of sync”有两类含义：sidecar hash 已过期，或者当前 pair rule 失败。后者包括文件缺失、locale link 错误、switcher 缺失、生成区域格式错误、生成区域漂移和结构 signature 差异。

verifier 还要求中文侧链接回英文侧，并要求 authored English 文档保留反向 English-to-Chinese switcher。generated English source 明确豁免，因为加入 switcher 会使 generator 失效。指向 active bilingual document 的普通相对链接必须指向对应 locale。

生成区域由严格的 `BEGIN GENERATED` 和 `END GENERATED` marker 划分。两侧区域数量必须相同，经过 locale path 归一化后，区域文本必须逐字节一致。这是 whole-document AST signature 之外对 generated content 的额外保护。

### Staged records and hook placement

`--cached` 的含义是“读取精确的 stage-zero index 字节”。hook 将暂存的 `.i18n.yaml` 路径传给 verifier，因此检查的是即将进入 commit 的内容，而不是无关的 unstaged worktree 修改。cached 模式只读并拒绝 `--write`；hook 不会静默确认漂移的 pair。

hook 运行这项检查，是因为 pairing record 是 commit 的三文件单元之一，反馈成本也很低。CI 会通过 `doc-sync` 再次运行全语料 `verify-translation-pairing`，因为 staged-file hook 看不到所有既有 pair，且 hook 可能缺失或被绕过。因此 CI check 是 merge eligibility 的权威来源。

### Merge driver

安装器把 `merge.dsh-translation-pairing` 写入 worktree-local Git configuration。shell driver 启动 `scripts/translation-pairing-merge.ts`。只有当 Git 默认文本 merge 对两个 owner-blob triplet 都成功，并且合并后的 pair 仍满足 switcher 和结构检查时，driver 才组合 sidecar record。否则它保留普通 conflict。`resolve-translation-pairing-conflicts` 对已经停止的 merge 使用同样的 fail-closed 逻辑，并暂存安全结果。

### Design limits

该 gate 证明的是与此前 confirmed state 的字节一致性和机械化 Markdown 对应关系。它不能判断英文句子和中文翻译是否语义相同、术语是否自然、事实是否准确。reviewer 可以用 `--write` 确认一份糟糕的翻译；系统有意把语义翻译质量留给 review。

## Fast feedback and strong validation

| Level | DSH 证据 | 通用系统中的角色 |
| --- | --- | --- |
| L0 Editor | formatter integration、类型感知 editor diagnostics 和 targeted test command 可通过仓库脚本使用；本仓库没有强制单一 editor protocol。 | 即时语法和本地语义反馈。 |
| L1 Pre-commit | staged translation pairing、archived notes、staged Oxlint、generated notices、whitespace 和 vendor manifest。 | 便宜的确定性检查与安全重新生成。 |
| L2 Pre-push | whole-project typecheck。 | 发布前的中成本契约验证。 |
| L3 CI / PR | static rule、lint、duplication、coverage、compatibility、snapshot、docs、build、artifact、browser test、Python runtime 和 Windows lane。 | 在干净 checkout 和多环境中执行完整独立验证。 |
| L4 Merge gate | `all-checks-passed` 对 failure、cancellation 或 skipped 都失败。 | Branch protection 使用稳定 verdict，不依赖不断变化的矩阵名称。 |
| L5 Release | pack、dependency-layout、packed-install、native runtime 和 publish verification workflow。 | 证明用户实际安装的 artifact，而不只是源码树。 |

`run-gates.ts` scheduler 是可复用的中间层。它负责命名 mode、依赖边、并发上限、输出归属和 fail-fast process-tree cleanup。CI workflow YAML 选择 mode，不重复 leaf inventory。

## DSH-specific and reusable practices

DSH 特有机制包括 Cordis catalog freshness、Session format 和 snapshot rule、branded package invariant、worktree-local hook ownership、translation-pairing merge driver，以及绑定 DSH package structure 的 generated catalog。

可复用的工程模式包括单一 command vocabulary、staged 与 worktree-aware validation、generated-file freshness check、显式 dependency graph、有界并发、fail-closed merge verdict、独立 CI 执行，以及 automatic repair 与 confirmation 的区分。

不值得照搬的是完整 package inventory，或默认每个仓库都需要大型自定义 TypeScript gate runner。小型项目应保留相同的 ownership model，但使用更小的 task runner 和更少的检查。

## Ten lessons worth learning

1. 让 hook 配置保持薄，把 policy 放进可复用 command。
2. 对 commit 实际包含的精确 index 字节运行 staged check。
3. 让 CI 从 clean checkout 重复本地规则，因为 hook 可能缺失或被绕过。
4. 把 automatic repair 与对语义状态的显式 confirmation 分开。
5. 即使 job 或 tool 被拆到多个平台，也使用稳定的 guardrail identifier。
6. 让 generated output 确定性生成，并提供 freshness check。
7. 显式建模 gate dependency，不把依赖隐藏在 shell 顺序中。
8. 限制并发，并保留可归属的 diagnostic。
9. 让 merge verdict 在 failure、cancellation 或 required work skipped 时失败。
10. 把领域特有检查放在通用 execution pattern 后面。

## Findings and limits

DSH 最值得学习的设计不是 Lefthook，而是 policy、named command、scheduler 和 execution context 的分离。Lefthook 只是本地 context 的一种 adapter；CI 通过 aggregate command 调用同一套 policy。

最重要的 guardrail gap 是 Git hook 的普遍限制：hook 可以被禁用、缺失，或安装在旧 checkout 上，因此只能作为 advisory。DSH 通过重复 CI validation 和稳定 required verdict 处理这个问题。未来的 Repository Guardrails 应保留这一性质，并为每个 completion claim 增加显式 provenance。

本次检查的 Lefthook/CI 范围内没有找到仓库自有的 secret scan、依赖漏洞扫描、数据库 migration check 或通用 API contract check。它们在 companion matrix 中被标记为建议，不是当前 DSH 能力。
