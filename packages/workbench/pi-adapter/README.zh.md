---
description: "面向内嵌 Pi 运行时或排查事件归一化与会话映射持久化的读者：Pi `AgentSession` 与持久化会话文件的适配器。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-pi-adapter`

[English](README.md) | 中文

## 概述

`dsh-pi-adapter` 把 Pi `AgentSession` 事件和持久化会话文件适配为 Workbench 契约，使 Workbench Shell 消费单一标准化事件流，而不是 Pi 私有 payload。当内嵌 Pi 运行时、且其流式、工具、会话和错误生命周期信息需要送达 Shell 时选择它；DSH 专有投影属于 `dsh-bridge`，不在本包。Pi 仍是模型运行时，因此 token 与缓存行为仍由配置的 Pi 模型决定。适配器只覆盖列出的 `AgentSession` 事件变体，默认映射存储仅在进程内有效。

## 目录

- [模型体验](#model-experience)
- [已知限制和延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

## Model Experience

### Pi runtime session

#### What the model sees

Pi 仍是模型运行时；本适配器暴露 `AgentSession` 流式、工具、会话和错误生命周期，不暴露 Pi 私有 payload。

#### Token effect

由配置的 Pi 模型和会话历史决定。

#### KV Cache effect

由 Pi 管理 Provider 请求缓存；本适配器不添加前缀内容。

## 已知限制和延后工作

- 适配器仅支持列出的 Pi `AgentSession` 事件变体。Pi 专有事件字段不会进入 Workbench 接口。
- 默认映射存储仅在进程内有效。需要跨重启保留会话的嵌入方应提供 `JsonWorkbenchSessionMappingStore` 或其他持久存储。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
