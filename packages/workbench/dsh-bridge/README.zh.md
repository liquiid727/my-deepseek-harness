# `@deepseek-ai/dsh-workbench-bridge`

English | [中文](README.md)

将标准化 Workbench 运行时事件投影到现有只追加 DSH 会话日志，使迁移期间可以继续使用当前 mux、对话和工具 UI。

## Model Experience

### DSH projection

#### What the model sees

启用后，prompt 由 Pi 处理，并通过现有 DSH `conversation` 和工具界面呈现。

#### Token effect

Pi 控制请求 token 统计；桥接不添加系统 prompt 文本。

#### KV Cache effect

桥接保留现有 DSH 事件前缀，不添加会使缓存失效的内容。

## 已知限制和延后工作

- Pi 路径是通过 `DSH_PI_RUNTIME=1` 启用的 opt-in POC。bridge 接受文本提示词，并投影消息和终态工具事件；`thinking.delta` 与 `tool.update` 不会写入 DSH 日志。
- 当 Host 重启后必须保留 DSH 到 Pi 的会话映射时，`mappingPath` 必须指定可持久写入的 JSON 文件。
