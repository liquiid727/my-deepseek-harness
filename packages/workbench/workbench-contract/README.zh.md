# `@deepseek-ai/dsh-workbench-contract`

English | [中文](README.md)

Workbench Shell 使用的运行时无关会话、Agent 与事件接口。本包不依赖 DSH UI，也不暴露 Pi 私有事件。

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
