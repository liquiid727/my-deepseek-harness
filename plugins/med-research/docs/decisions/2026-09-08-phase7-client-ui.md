# 阶段 7 客户端 UI：席位、打包与两处阻塞

- 状态：视图与打包已实施；浏览器可见验证与两处阻塞待处理
- 日期：2026-09-08
- 依据：SPEC §42、AGENTS.md §2.1.5、§2.7

## 已实施

1. **四个 `conversation.view`**：`med-research` / `med-papers` / `med-evidence` / `med-statistics`，order 30–33，label 走 `medResearch` 字典的 thunk（切语言不重注册）。
2. **按工具名 keyed 的 `tool.call.toolview`**：SPEC §6 的 21 个工具名全部指向同一个 `MedToolCard`，渲染工具名与运行/完成/失败三态。
3. **`settings.section`**：`med-research` 页，说明配置由部署 profile 提供。
4. **自带客户端打包**：`packages/plugin-medical-ui/tsdown.config.ts` 产出单个 `lib/client.js`（`window.__ModuleLoader__.load` 闭包工厂，`codeSplitting: false`），仅 `react` / `react/jsx-runtime` 走模块表，其余内联；`scripts/verify-client-bundle.mjs` 机械校验这四条契约。
5. **三处注册**：根 `tsconfig.client.json`（client face）、`plugin-medical-ui` 的 `dsh.client` 声明与 `exports["./client"]`、`bundle-medical` 的 `med-ui` 行与依赖。
6. **数据来源**：视图通过 `createMedRemote(ctx.connection.rpc)` 调用宿主 `@Remote` 面，不直接访问宿主服务。

## 阻塞 1：右栏席位所在的包未发布到 npm

SPEC §42.2 要求 Paper Reader 与 Evidence 详情注册到 `sidebar.right.pane.tab`。该席位的类型与 `inject` 面声明在 `@deepseek-ai/dsh-client-ui-sidebar-right`，其依赖 `@deepseek-ai/dsh-client-ui-dockkit` 同样未发布：

```
$ npm view @deepseek-ai/dsh-client-ui-sidebar-right versions
E404 Not Found
$ npm view @deepseek-ai/dsh-client-ui-dockkit versions
E404 Not Found
```

out-of-tree 客户端插件无法 import 这两个包，也就无法按 DSH 约定拿到 `SlotMap` 行与 `SidebarRightTabInjected` 类型。

**当前处理（待确认）**：Paper Reader 暂不做成右栏 tab，而是让 `med-papers` 视图接收 `openView('med-papers', paperId)` 的 focus（SPEC §42.3 的跨视图跳转），Evidence 卡片的「打开原文」按钮即走这条路径。等 DSH 发布该包（或明确 out-of-tree 的替代席位）后再补右栏。

**需要你决策**：接受「读原文在 Papers 视图内」这一 V1 形态，还是先推动 DSH 发布 `dsh-client-ui-sidebar-right`。

## 阻塞 2：Remote 面缺少列表读取

现有服务接口只有按 id 的读取（`medPapers/get`、`medDatasets/profile`…），没有列表读取。视图因此只能 focus-driven 渲染：

| 视图 | 期望列表 | 现有能力 |
|---|---|---|
| Research | 项目列表 | ✅ `medProjects/list` |
| Papers | 某项目论文、某文档段落 | ❌ 无 `papersForProject` / `paragraphsOfDocument` |
| Evidence | 某项目/某 claim 的证据 | 仅有 `listForClaim`（需要 claimId，UI 拿不到） |
| Statistics | 数据集、分析运行 | ❌ 无 `datasets` / `runs` 列表 |

**当前处理**：视图按 focus 渲染单条记录并显示空态；不伪造列表。

**需要你决策**：是否按 SPEC §30 的精神给服务接口补只读列表方法（`medProjects/papers`、`medPapers/paragraphs`、`medEvidence/listForProject`、`medDatasets/list`、`medStatistics/runs`）。这是接口扩展，不是本仓库单方面能定的。

## 测试策略

已发布的 `@deepseek-ai/dsh-client-*` 只含浏览器 bundle（`lib/client.js` 走 `window.__ModuleLoader__`），Node 下不可直接 import。因此：

- **注册行为**用已发布的 `@deepseek-ai/dsh-client-ui-slots` 的 `SlotCore`（Node ESM 构建）验证：真实校验 list id / keyed key / 声明顺序 / 释放。
- **组件行为**直接渲染 `views.tsx`（只依赖 react），用真实字典 + fake `MedRemote` 覆盖加载、空态、失败重载、证据状态标签与「打开原文」跳转。
- 字典与 locale 切换用结构性 locale double 验证。
- 产物契约由 `scripts/verify-client-bundle.mjs` 校验。

真正的浏览器可见验证已在真实 profile 上执行（阶段 7 通过条件之一），步骤与证据见 [`2026-09-08-shared-med-storage-and-profile-install.md`](2026-09-08-shared-med-storage-and-profile-install.md)：4 视图切换、视图文案与空态、切换视图后输入框仍可用、设置分节可见；FR-25 的负例在清空客户端状态后进入 hero 验证（无 view tab、无 Med 文案、CDP `Log`/`Runtime` 零异常事件）。

## 放弃的方案

- **运行时 import 其它 `@deepseek-ai/dsh-client-*` feature 包的值**：AGENTS.md §2.7 明令禁止，且 bundle 纯度检查会拒绝。
- **自建右栏**：AGENTS.md §2.7 禁止替换 shell；`root` / `sidebar.workspaces` 为 single 且已被占用。
- **CSS Modules / lightningcss 管线**：out-of-tree 无该 preset，先用内联样式；待 UI 稳定后再评估。
