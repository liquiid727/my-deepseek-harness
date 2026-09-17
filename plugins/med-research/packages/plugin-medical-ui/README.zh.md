# @medresearch/dsh-plugin-medical-ui

[English](README.md) | 中文

## 概述

Med Research 客户端 UI。交付视图状态机（SPEC §43–§45）、zh/en 字典（AGENTS.md §2.7）、强类型 Remote 数据层（SPEC §30），以及浏览器端注册：医疗品牌席位和五个主导航项、五个 `conversation.view` 视图、blank Session 启动动作、会话头部 Agent Mode 动作、按工具名 keyed 的 `tool.call.toolview` 卡片和一个 `settings.section` 页。

## 范围

- `src/state/research.ts` — Research 视图状态与转移；任意阶段可落 `ERROR_PARTIAL`。
- `src/state/statistics.ts` — Statistics 状态；`WAITING_APPROVAL` 阻止执行。
- `src/state/evidence.ts` — 由已存证据推导 SPEC §44 的展示状态。
- `src/i18n/{en,zh}.ts` — 扁平点号字典；`zh` 的键集必须与 `en` 完全一致。
- `src/client/remote.ts` — `createMedRemote(caller)` 把 `ctx.connection.rpc` 变成按服务分组的强类型调用，并在宿主错误信封上抛 `MedRemoteError`。视图只依赖该接口，不碰 wire。
- `src/client/views.tsx` — Research、Papers、Evidence 与 Statistics 视图；各自通过 `createMedRemote` 读取，并显示状态机对应的字典文案。Papers 视图解析引用 focus 并高亮被引段落。
- `src/client/home.tsx` — S01 工作台首页：当前项目、Hero 中唯一的宿主 composer、快捷入口、失败域显示未知并可重试的持久化概览计数、三张能力卡片、仅填入输入框的灵感目录与项目搜索/创建/归档/恢复。普通消息准入成功后打开同一 Session 的 Chat；Research 仍通过明确的导航操作进入。
- `src/client/nav.tsx` — 侧栏品牌席位与五个主导航项；Skills 在 S07 交付前保持本地化禁用态。
- `src/client/focus.ts` — Papers 视图的 focus 契约（`paperId|documentId|paragraphId|start|end`）：Evidence 视图编码，Papers 视图解码。
- `src/client/artifact-download.ts` — 已导出产物的带鉴权下载 URL（SPEC §30）。
- `src/client/tool-names.ts` — `med` 工具名清单（SPEC §6），由卡片注册与宿主组合测试共用。
- `src/client/toolview.tsx` — 覆盖全部 `med` 工具名的一张卡片。
- `src/client/settings.tsx` — 设置页；只说明配置来自部署 profile，不读取值。
- `src/client/index.tsx` — 插件入口：字典、领域主题 token 与视图/卡片/设置注册，每一项都由 `ctx.effect` 拥有。
- `src/client/components.tsx` — 功能本地的纯 props ViewFrame、SectionHeader、AsyncState、MetricTile 与 CapabilityCard；标准控件来自 `dsh-client-ui-primitives`。
- `src/client/views.css`、`src/client/nav.css` 与 `src/client/components.module.css` — 编译为带标签、由插件持有的样式注入模块的 Lightning CSS 输入。
- `src/client/hero-action.tsx` — blank Session 的入口，无需模型 turn 即可打开 S01 项目工作区。
- `src/client/mode-action.tsx` — 本地化的会话头部选择器，通过 `medProjects` Remote 方法读取和修改当前 Agent Mode。

## 构建

浏览器半边由本包自带的 tsdown 配置打包（DSH 未发布 client preset）。React、Cordis 与 `dsh-client-ui-primitives` 通过宿主模块表解析；Lightning CSS 把全局样式与 CSS Modules 编译进同一客户端产物，并附加 loader 所有权标签：

```sh
pnpm run build:client    # packages/plugin-medical-ui/lib/client.js
pnpm run verify:client   # rebuild + check the module-loader artifact contract
```

宿主半边保持 source-plane（`main: src/index.ts`），由 harness 通过 tsx 加载。开发时链接本 checkout 的 `ui-conversation` 以使用 `mountComposer` 客户端接口；部署此 UI 需要匹配的宿主客户端构建。

## 模型影响

无：客户端半边不注册工具、提示词或会话事件。

## 已知限制与后续工作

- **右栏席位未实现**：`@deepseek-ai/dsh-client-ui-sidebar-right` 及其依赖 `dsh-client-ui-dockkit` 未发布到 npm，out-of-tree 客户端插件无法声明 `sidebar.right.pane.tab`。引用改为通过 `med-papers` 的 focus 契约打开 Papers 视图；见 `docs/decisions/2026-09-08-citation-focus.md`。
- **视图是 focus-driven 而非列表驱动**：已发布的 Remote 面没有项目论文、项目证据、数据集、分析运行、文档段落的列表读取。读整篇需要段落列表方法；定位单条被引 span 不需要。Home 视图会列出项目并读取已持久化的项目概览计数。
- **未贡献 `shell.overlay`**：目前没有需要进度浮层的长任务客户端流程。
- 客户端当前通过 `ctx.connection.rpc` 调用免生成的 SRC 端点；迁移到生成的 `ctx.remote` 描述符与 Typert 产物构建一并延后。
- 引用高亮的浏览器可见验证延后到真实 Research 链跑通；组件测试已覆盖 focus 编解码、高亮与滚动。
