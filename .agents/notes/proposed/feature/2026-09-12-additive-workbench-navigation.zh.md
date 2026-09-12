# Agent Note: 面向产品插件的可叠加工作台导航

Status: proposed

[English](2026-09-12-additive-workbench-navigation.md) | 中文

## Problem

DSH sidebar 拥有一个可折叠列，并公开 brand、Workspace、footer 和 Settings slots。产品插件可以增加 conversation views，但不能在不替换 single-owner slot 的情况下，把主要产品导航放在 Workspace browser 旁。Med Research 需要稳定的首页、研究、文献库、统计和技能导航，同时保留 DSH shell、Session composer、Workspace browser、Settings 和其他客户端扩展。其 Paper Reader 还需要 out-of-tree 包能够消费现有右栏 client 类型。

## Proposal

Sidebar 包声明 root-scoped additive `sidebar.primary.action` list slot，并在 New Session 控件与 Workspace browser 之间渲染。每个条目注册 `id`、`order` 和本地化 `label`；owner 只传递 `wide`，因此 sidebar 保持几何所有权，注册方拥有按钮、active 状态和导航动作。没有条目时，现有 sidebar tree 和几何保持不变。

右栏包通过已发布或 profile 可消费的 client export 公开其 client SlotMap merge 和注册方类型。该变化不修改 dispatch key 或 pane lifecycle。Med Research 消费两个公开接口，使用现有 brand slots 和 theme tokens，并继续通过 `conversation.view` 和 `sidebar.right.pane.tab` 注册 Session 内容。它不注册 `root`、`sidebar` 或 `sidebar.workspaces`。

## Alternatives considered

**替换 root 或 sidebar occupant。** 这种方式可以快速复刻应用壳，但会移除后代 slots，并阻止其他 DSH 功能组合。

**把全部导航放入 conversation tabs。** 这种方式保留当前 API，但不能表示全局产品区域或给定工作台层级，还会让 Project 导航与任务内容竞争。

**直接在 sidebar 包中添加 Med Research 专用控件。** 这会把通用 DSH shell 与一个产品耦合，也会阻止其他 bundles 使用同一扩展。

## Acceptance criteria

- Slot 类型、runtime catalog、sidebar 渲染、lifecycle disposal、排序、本地化 label、展开/折叠、键盘行为和无条目兼容均有聚焦测试。
- Out-of-tree TypeScript client 包及其构建 profile 可以消费右栏 client export。
- 真实 Med Research profile 显示五个导航条目，保留 Workspace 和 Session 选择，打开正确的 session-scoped view，且不遮蔽现有 shell 后代。
- `docs/architecture.md`、sidebar/right-pane 包文档、生成的 client catalog 和受影响双语文档描述已交付扩展。

## Risks

主要操作会增加 sidebar 垂直压力，并可能挤压 Workspace browser。实现必须限制导航区域，并在低高度下保留 browser 滚动。没有活动 Session 时产品条目可能失去目标，因此注册方必须显示可操作的创建/选择 Session 状态，而不能向缺失的 conversation owner 分发。
