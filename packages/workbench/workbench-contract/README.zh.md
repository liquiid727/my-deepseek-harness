---
description: "面向选择 Workbench Shell 契约或排查可渲染标准化事件的读者：运行时无关的 Workbench 会话、Agent 与事件接口。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-workbench-contract`

[English](README.md) | 中文

## 概述

`dsh-workbench-contract` 声明运行时无关的 Workbench 契约：Workbench Shell 渲染的会话、Agent 与生命周期事件接口，不依赖 DSH UI，也不依赖 Pi 私有事件。当内嵌运行时需要把标准化事件交给 Shell，或 Shell 需要在运行时之间保持可替换时选择它。本包只提供类型与归一化：它不运行模型，由消费者决定哪些标准化事件成为模型可见消息。事件联合类型是最小化的共享投影，因此运行时专有 payload 仍需先归一化为事件，Shell 才能消费。

## 目录

- [模型体验](#model-experience)
- [已知限制和延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

## Model Experience

### Contract events

#### What the model sees

本包定义模型驱动 Workbench Shell 可渲染的 `WorkbenchEvent`，但不运行模型；消费者决定哪些标准化事件成为模型可见消息。

#### Token effect

直接 token 影响为零。

#### KV Cache effect

没有直接缓存影响。

## 已知限制和延后工作

- 事件联合类型是最小化的共享投影。运行时专有 payload 必须先归一化为事件，Workbench Shell 才能消费它。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
