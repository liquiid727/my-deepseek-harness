# `@deepseek-ai/dsh-pi-adapter`

English | [中文](README.md)

将 Pi `AgentSession` 事件和持久化会话文件适配为 Workbench 接口。DSH 投影逻辑位于 `dsh-bridge`。

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
