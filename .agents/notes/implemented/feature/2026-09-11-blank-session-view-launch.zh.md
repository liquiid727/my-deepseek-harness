# Agent Note: 空会话暴露插件拥有的工作区入口

Status: implemented

[English](2026-09-11-blank-session-view-launch.md) | 中文

## Problem

新会话仍为空时，Conversation 视图按现有行为隐藏。插件可以注册完整视图，却无法在第一轮模型消息前给用户进入它的入口。

## Decision

Conversation Session 在空 Hero 中渲染会话作用域的 `conversation.hero.actions` 列表。Med Research 客户端注册一个本地化入口，直接选择 Research 视图；选择视图不会提交模型消息。活跃会话继续使用原有的标题栏和视图导航，插件在本地声明新增行，使独立类型检查不依赖尚未发布的 DSH 包产物。

## Alternatives considered

- 增加全局侧栏或 URL 路由：这会与 shell 现有的工作区导航竞争，并违反插件的 Conversation View 集成模型。
- 在空 Hero 中展示全部四个医疗标签：这会在 Research 项目创建前暴露后续视图，并暗示后续工作流表面已经完成。
- 发送隐藏的启动提示：这会产生模型可见的会话轮次，使打开工作区依赖网络和模型可用性。

## Consequences

新会话用户可以从首屏进入已实现的 Research 工作区，同时 DSH shell 保持目标中立，其他插件也能提供自己的本地化入口。四个医疗视图仍注册用于会话内导航；本 S01 入口只宣传 Research。固定使用已发布 DSH 包的消费者仍需等待包含新增插槽声明的包版本发布。
