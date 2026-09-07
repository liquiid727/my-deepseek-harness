# Workbench

[English](README.md) | 中文

Workbench 组包含与运行时无关的约定、内嵌 Pi 运行时适配器，以及 Pi Runtime Bridge POC 使用的 DSH 兼容桥接。

## 包

- [`workbench-contract/`](workbench-contract/README.md)：独立于 DSH 与 Pi 的会话、agent 和生命周期事件接口。
- [`pi-adapter/`](pi-adapter/README.md)：Pi `AgentSession` 的创建、恢复、事件归一化和映射持久化。
- [`dsh-bridge/`](dsh-bridge/README.md)：可选的 Host 入口，以及到现有 DSH 会话事件流的投影。

## 已知限制与延期工作

该桥接仍是 POC。真实提供方验收、更丰富的模型选择和完整工具注册仍属于部署工作，记录在 GOAL-000 evidence 中。
