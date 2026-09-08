# AGENTS.md — Python SDK

[English](AGENTS.md) | 中文

`python/` 目录包含 Python 客户端 SDK 及其捆绑的运行时。公共协议行为必须与 TypeScript SDK 以及仓库的会话和快照约定保持一致。

- 保持包元数据、锁文件和生成的运行时产物与所属的 `pyproject.toml` 或构建脚本一致。
- 在 Python 边界验证跨越线路和持久化边界的数据；不要为类型化的内部值增加多余的运行时回退。
- 修改循环投影、会话事件或 JSON-RPC 行为时，同时更新对应的 TypeScript 和 Python 预期结果。
- 遵循 [python/development.md](development.md) 中的开发与发布流程。不得提交凭据或本地虚拟环境产物。
