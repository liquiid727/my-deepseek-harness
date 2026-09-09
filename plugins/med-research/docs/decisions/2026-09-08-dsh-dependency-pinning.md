# 决策：DSH 依赖固定与消费方式

- 状态：已实施（阶段 1）
- 日期：2026-09-08
- 依据：SPEC §2、§65.2；AGENTS.md §2.1；`mydsh-plugin-repo-standard` §「Dependencies」

## 问题

本仓库是 out-of-tree 插件套件，但 DSH 公开 API 处于 pre-stable 状态。依赖 DSH 有三种可行方式，选择哪一种决定了「本仓库能否在不修改 DSH checkout 的前提下独立安装与验证」。

## 决定

- 业务包用 `peerDependencies` 声明运行时会由宿主提供的 DSH 包（`@deepseek-ai/dsh-storage-domain` 等），版本线为 `^0.1.3-alpha.2`。
- 仓库根 `devDependencies` 固定同一版本 `0.1.3-alpha.2` 供本地类型检查与测试使用。
- **不使用** `workspace:` 协议、**不使用** 指向 DSH checkout 的相对路径/软链。本仓库是独立 pnpm workspace。
- 适配的 DSH 版本与验证 commit 记录在根 `README.md`；升级前必须跑 Compatibility Test（SPEC §65.2，阶段 8 交付）。

## 放弃的方案

- **链接本地 checkout（`link:` / `file:` 相对路径）**：能立刻用上未发布改动，但把两个仓库的工作区耦合在一起，DSH 的 `workspace:^` 内部依赖无法在外部解析，且违反「不依赖 checkout 内部协议」。
- **依赖 npm `latest`（`0.0.1-rc.1`）**：比本地 checkout 更旧，缺少 `defineDomain` 的 `layout`/`compatibleVersions` 字段，API 不匹配。
- **不声明 peer，全部走 devDependencies**：安装时能跑，但把宿主本应提供的运行时包重复打包进插件，产生第二份服务实现，违反「一个 context 一个服务实例」。

## 需要的验证

- `pnpm install` 后 `pnpm run typecheck` 在只使用已发布 DSH 包的条件下通过（source plane）。
- 阶段 8 用 `dsh plugin --profile med-research add <本地路径>` 在真实 profile 内加载并跑通 E2E。

## 风险

- 发布的 DSH 包类型声明内部使用 `./spec.ts` 形式的相对导入；当前 `skipLibCheck: true` 下解析通过。若未来 TypeScript 版本改变该行为，需要重新评估（记录为阶段 8 Compatibility Test 的一项）。
