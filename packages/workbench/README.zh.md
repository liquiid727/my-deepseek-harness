---
description: "Workbench 包组的说明：packages/workbench/ 下各包负责什么，供选择或浏览该能力族时使用。"
kind: "package-group"
---

# Workbench

[English](README.md) | 中文

Workbench 组包含与运行时无关的约定、内嵌 Pi 运行时适配器，以及 Pi Runtime Bridge POC 使用的 DSH 兼容桥接。

DSH 桥接器的 Host 集成见 [core 子系统参考](../../docs/subsystems/core.zh.md)。

## 包

- [`workbench-contract/`](workbench-contract/README.zh.md)：独立于 DSH 与 Pi 的会话、agent 和生命周期事件接口。
- [`pi-adapter/`](pi-adapter/README.zh.md)：Pi `AgentSession` 的创建、恢复、事件归一化和映射持久化。
- [`dsh-bridge/`](dsh-bridge/README.zh.md)：可选的 Host 入口，以及到现有 DSH 会话事件流的投影。

## 已知限制与延期工作

该桥接仍是 POC。真实提供方验收、更丰富的模型选择和完整工具注册仍属于部署工作，记录在 GOAL-000 evidence 中。
