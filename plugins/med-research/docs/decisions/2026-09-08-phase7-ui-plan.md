# 阶段 7 实施计划（已调研事实 + 待办）

- 状态：部分实施（React 席位、打包与浏览器可见验证已交付；列表数据与右栏席位仍受接口/依赖阻塞）
- 日期：2026-09-08
- 依据：SPEC §42、AGENTS.md §2.7

## 已确认的 DSH 客户端事实（checkout `d1293aed5a`）

1. **客户端插件包形态**（`packages/client/ui-trajectory/package.json`）：
   - `dsh.client = { platform: 'web', inject: ['@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-renderer', ...] }`
   - `exports['./client'] = { types: './lib/types/client/index.d.ts', default: './lib/client.js' }`，`main = './lib/index.js'`
   - 需要自带打包配置（DSH 未发布 client preset）。
2. **席位注册**（`packages/client/ui-slots/src/index.ts:780` 起）：
   `ctx.slots.register(options, Component)`，其中 `options` 含 `name`、list 类需要 `id`/`order`/`label`、可选 `children`/`store`/`inject`/`locale`；`Component` 接收四类 share 的组合 props。
   `conversation.view` 是 `{ kind: 'list', scope: 'session', owner: ConvViewOwnerProps }`（`packages/client/ui-conversation/src/client/contract/slots.ts:155,247`），owner props 提供 `viewRequest`/`openView(view, focus)`/`completeViewRequest`。
   现成范例：`packages/client/ui-trajectory/src/client/index.ts:77-107`（`ctx.slots.inject('conversation.view', () => ctx.slots.register({...}, TrajectoryView))`）。
3. **文案**：`ctx.locale.register(NS, { zh, en })` + `const t = ctx.locale.bind(NS)`；`label: () => t('view.research')` 在注册期用 thunk 读取，跟随语言切换。
4. **数据来源**：客户端不能直接调宿主服务，必须走 SPEC §30 的 Typert `@Remote`（`ctx.remote.$mount(...)`）或临时 `ctx.connection.rpc.handle`。因此阶段 7 依赖先补齐宿主 Remote 贡献。

## 待办（按依赖顺序）

1. 宿主：为 `medProjects`/`medLiterature`/`medPapers`/`medEvidence`/`medDatasets`/`medStatistics`/`medArtifacts` 定义 Typert `@Remote` 方法（SPEC §30 清单）。
2. 客户端：`plugin-medical-ui/src/client/index.tsx` 注册 4 个 `conversation.view`（`med-research`/`med-papers`/`med-evidence`/`med-statistics`）、右栏 `sidebar.right.pane.tab`、按工具名 keyed 的 `tool.call.toolview`、`settings.section`、`shell.overlay`。
3. 视图组件复用本包已有的 `state/*` 状态机与 `i18n/*` 字典；`evidenceUiState` 直接驱动证据卡片状态。
4. 会话作用域：无活跃会话时不渲染且不报错（FR-25）。
5. 打包：客户端入口 `src/client/index.tsx` → `lib/client.js`；补 tsconfig client face 与 tsdown 配置。
6. 验证：组件测试（jsdom + 渲染测试）+ 浏览器实际可见（`record-browser-gif` 技能），二者都通过后才算阶段 7 通过。

## 当前状态

- 已交付：`src/state/{research,statistics,evidence}.ts`、`src/i18n/{en,zh}.ts`。
- 已交付（第 1 项）：宿主 7 个服务的 `@Remote` + `typertRemote` 绑定（SRC 发现，无需生成产物）；客户端数据层 `src/client/remote.ts`（`createMedRemote`）。决策与验证见 [`2026-09-08-remote-surface.md`](2026-09-08-remote-surface.md)。
- 已交付（第 2、5 项）：4 个 `conversation.view`、21 个 keyed 工具卡片、`settings.section`、自带 `lib/client.js` 与产物校验。决策见 [`2026-09-08-phase7-client-ui.md`](2026-09-08-phase7-client-ui.md)。
- 已交付（第 4、6 项部分）：真实 `dsh --profile med-research` 启动，浏览器实测 4 视图切换、视图内文案与空态、切换视图后输入框仍可用、设置分节可见。决策与步骤见 [`2026-09-08-shared-med-storage-and-profile-install.md`](2026-09-08-shared-med-storage-and-profile-install.md)。
- 未交付：右栏 `sidebar.right.pane.tab`（依赖包未发布）、`shell.overlay`、点引用定位原文（需要列表数据）、FR-25 的显式负例断言、GIF（本机缺 ffmpeg）。
- 已记录阻塞：Remote 面缺列表读取（项目论文 / 文档段落 / 项目证据 / 数据集 / 分析运行），视图当前为 focus-driven。
