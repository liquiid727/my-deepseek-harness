---
description: "面向迁移会话流或排查 DSH_PI_RUNTIME 下 Pi 运行时路径的读者：将标准化 Workbench 事件投影到 DSH 的可选桥接器。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-workbench-bridge`

[English](README.md) | 中文

## 概述

`dsh-workbench-bridge` 将标准化 Workbench 运行时事件投影到现有只追加 DSH 会话日志，使迁移期间可以继续使用当前 mux、对话和工具 UI。Host 需要在不替换 DSH 会话界面的情况下运行 Pi 时启用它，并通过 `DSH_PI_RUNTIME=1` 控制；它仍是 POC，不是已发布的运行时路径。

## 目录

- [模型体验](#model-experience)
- [已知限制和延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

## Model Experience

### DSH projection

#### What the model sees

启用后，prompt 由 Pi 处理，并通过现有 DSH `conversation` 和工具界面呈现。

#### Token effect

Pi 控制请求 token 统计；桥接不添加系统 prompt 文本。

#### KV Cache effect

桥接保留现有 DSH 事件前缀，不添加会使缓存失效的内容。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制和延后工作

- Pi 路径是通过 `DSH_PI_RUNTIME=1` 启用的 opt-in POC。bridge 接受文本提示词，并投影消息和终态工具事件；`thinking.delta` 与 `tool.update` 不会写入 DSH 日志。
- 当 Host 重启后必须保留 DSH 到 Pi 的会话映射时，`mappingPath` 必须指定可持久写入的 JSON 文件。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
