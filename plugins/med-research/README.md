# Med Research Workspace

Med Research Workspace 是在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）之上构建的 **out-of-tree 插件套件**，实现两条端到端链路：

- **Evidence Chain**：中文研究问题 → PubMed 真实 PMID → Paper → 原文 Evidence Span（可重新定位）→ Verified Claim → 可点击引用。
- **Statistics Chain**：真实数据集 → Dataset Profile → Analysis Plan → 用户确认 → 隔离执行 → 真实结果 → 图表 → 完整 provenance。

本仓库不修改 DSH checkout 的任何文件；全部能力通过 `@medresearch/dsh-*` 包与 `bundle-medical` 的 patch 行提供。

## 事实来源

| 文档 | 位置 |
|---|---|
| 常驻约束（每个会话自动生效） | [`AGENTS.md`](AGENTS.md) |
| 需求 PRD V1.1 | [`docs/prd/med-research-workspace-ultimate-prd-v1.1.md`](docs/prd/med-research-workspace-ultimate-prd-v1.1.md) |
| 技术规格 SPEC V1.1 | [`docs/spec/med-research-workspace-ultimate-spec-v1.1.md`](docs/spec/med-research-workspace-ultimate-spec-v1.1.md) |
| 阶段验收门禁 | [`docs/checklists/stage-acceptance.md`](docs/checklists/stage-acceptance.md) |
| Gate / DoD 证据表 | [`docs/checklists/gate-evidence.md`](docs/checklists/gate-evidence.md) |
| 决策记录 | [`docs/decisions/`](docs/decisions/) |
| 人工验收步骤 | [`docs/manual-verification.md`](docs/manual-verification.md) |

## 适配的 DSH 版本

| 项 | 值 |
|---|---|
| DSH npm 版本 | `0.1.3-alpha.2`（`@deepseek-ai/dsh-*` alpha 线） |
| 验证用 checkout commit | `d1293aed5aadea7e28d85c5341bf91e86274f6c1`（分支 `medical-workbench`；其代码基为 `master` `21654444ff`） |
| `@deepseek-ai/cordis` | `4.0.2` |

升级 DSH 前必须先跑 Compatibility Test（SPEC §65.2），并同步更新本表。DSH 公开 API 处于 pre-stable 状态：版本变更属于跨表面变更，不能静默升级。

## 安装与本地运行

包未发布到 npm，且内部依赖用 `workspace:*`。`scripts/install-local-profile.mjs` 会把每个包 `pnpm pack` 成 tarball（`workspace:*` 被改写成实际版本），再写入 profile 的 `package.json` 与 `pnpm-workspace.yaml` 的 `overrides`（每个 `@medresearch/*` 指向自己的 tarball），最后安装：

```sh
pnpm run install:profile --profile med-research          # 装进 $DSH_HOME/profiles/med-research
pnpm run install:profile --profile med-research --print-only   # 只打印将要写入的文件
pnpm run install:profile --profile med-research --force        # 覆盖已存在的 profile
dsh --profile med-research --dump-config    # 确认组合树
dsh --profile med-research --port 3099      # 浏览器打开带 token 的 URL
```

profile 组合顺序见 SPEC §4.2；客户端半边的 `lib/client.js` 由脚本先跑 `build:client` 产出。手工符号链接的替代步骤见 [`docs/decisions/2026-09-08-shared-med-storage-and-profile-install.md`](docs/decisions/2026-09-08-shared-med-storage-and-profile-install.md)。

运行真实模型轮次前有两个前置条件（详见同一决策记录）：profile 必须安装每个 bundle 行命名的 DSH 包（脚本已从 `cordis.patch.yml` 派生，缺 `dsh-storage-sqlite` 会让所有模型请求报 `REQUEST_EXTENSION`）；生成的 `workspaceRoot` 必须落在会话工作区内，否则 `project_create` 会因文件沙箱返回 `FS_SANDBOX_DENIED`。

统计链还需 runner 环境装有 PRD §34 的分析包（`pandas`/`numpy`/`scipy`/`statsmodels`/`matplotlib`/`openpyxl`）；生成的补丁已把它们写进 `med-statistics.allowlist`，缺包时 run 会在 import 处如实失败。

## 开发

```sh
pnpm install
pnpm run typecheck   # tsc 全量类型检查（node face + client face）
pnpm run test        # vitest：领域单测 + 存储契约 + Remote 往返 + 客户端席位/组件
pnpm run build:client   # 打包客户端半边到 packages/plugin-medical-ui/lib/client.js
pnpm run verify:client  # 重新构建并校验 module-loader 产物契约
```

依赖策略：业务包只通过 `peerDependencies` 声明它运行时所依赖的 DSH 已发布包；开发与测试用根 `devDependencies` 固定同一版本（`0.1.3-alpha.2`），不使用 `workspace:` 或相对链接指向 DSH checkout（见 `docs/decisions/`）。

## 包清单

| 包 | 角色 | 说明 |
|---|---|---|
| `medical-contracts` | Service Definition + 领域类型 + zod schema | 实体、品牌化 id、服务接口、错误模型 |
| `medical-domain` | 纯领域逻辑（无 DSH 依赖） | 归一化/对齐、Evidence 状态机、去重、Claim Gate |
| `medical-storage` | 存储域声明与仓储 | `storage-domain` 域、仓储（每 facility 单飞共享句柄）、`medExport`/`medImport` |
| `medical-xml` | 共享工具 | 有序 XML 读取（PubMed EFetch、JATS 共用） |
| `plugin-project` | Host 插件 | `ctx.medProjects`、`project.json`、工作区绑定、`project_*` 工具 |
| `plugin-literature` | Host 插件 | `ctx.medLiterature`、PubMed E-utilities 连接器、`literature_*` 工具 |
| `plugin-paper` | Host 插件 | `ctx.medPapers`、JATS/摘要解析、`paper_*` 工具 |
| `plugin-fulltext` | Host 插件 | `ctx.medFulltext`、Europe PMC 全文解析 |
| `plugin-evidence` | Host 插件 | `ctx.medEvidence`、BM25 检索、定位与裁决、`evidence_*` 工具 |
| `plugin-dataset` | Host 插件 | `ctx.medDatasets`、CSV 解析与 Profile、`dataset_*` 工具 |
| `plugin-statistics` | Host 插件 | `ctx.medStatistics`、Analysis Plan、审批后隔离执行 |
| `medical-runner-container` | Runner provider | `ctx.medRunner`、受限子进程隔离执行 |
| `plugin-artifact` | Host 插件 | `ctx.medArtifacts`、run 关联产物与导出 |
| `plugin-medical-ui` | 客户端插件 | 视图状态机 + zh/en 字典 + `createMedRemote` 数据层 + 4 视图 / 工具卡片 / 设置页 + 引用定位 focus；自带浏览器打包 |
| `medical-adapter-dsh` | 兼容层 | DSH 版本/导出的 Compatibility Test |
| `bundle-medical` | Bundle（纯数据） | `cordis.patch.yml`：storage + runner + 8 个 host 插件行 + `med-ui` 行 |

后续阶段追加 `plugin-medical-ui`、`medical-runner-container`、`medical-adapter-dsh`、`bundle-medical`。
