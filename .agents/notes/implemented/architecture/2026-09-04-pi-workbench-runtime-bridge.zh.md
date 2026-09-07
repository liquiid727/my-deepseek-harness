# Agent Note: Pi Workbench runtime bridge

Status: implemented

English | [中文](2026-09-04-pi-workbench-runtime-bridge.md)

## Problem

现有 Web Shell 面向 DSH Agent 并消费 DSH 会话事件，而 Pi AgentSession 使用不同的私有事件流和持久化会话身份。

## Decision

Workbench Contract 定义小型运行时无关会话/事件词汇；`dsh-pi-adapter` 翻译 Pi 事件并保存 Workbench 到 Pi 会话文件的映射；`dsh-workbench-bridge` 将这些事件投影到现有只追加 DSH 会话日志。Host API 仅在 `DSH_PI_RUNTIME=1` 时选择该路径，POC 期间默认仍使用 DSH Agent。

## Alternatives considered

- **用 Pi 事件替换浏览器协议** — 会让所有既有对话和工具渲染器耦合 Pi 私有 payload。
- **将 Pi 作为独立 RPC 进程运行** — 初始桥接使用嵌入式 SDK，保持单一 Host 生命周期并避免第二套线协议。
- **只在内存保存映射** — 必须写入 JSON 映射文件，确保 Host 重启不会为同一个 Workbench 会话创建第二个 Pi 会话。

## Consequences

现有 mux、对话 UI 和工具 UI 可以继续使用，因为桥接写入它们已有的 DSH 事件。Pi 模型/工具凭据和更多事件变体仍由部署配置负责；真实 Provider 验收需要 API key，不能由无 key 单测宣称完成。
