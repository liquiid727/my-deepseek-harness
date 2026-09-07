# GOAL-000 — Replace DSH Agent Runtime with Pi

## Status

`IN PROGRESS`

## Goal

在尽可能保留 DSH 现有 Web UI / Shell 体验的前提下，将真正处理 Agent Conversation、Streaming、Tool Call 和 Session 的 Runtime 切换为 Pi。

本 Goal 的目标是验证架构可行性，不是完成整个 Workbench 产品。

---

## User / Operator

Personal Workbench 的开发者与未来的 Domain Workbench 开发者。

---

## Problem

当前项目如果直接基于 DSH 深度魔改，会导致：

- UI 与 DSH Runtime 长期耦合
- 后续插件 / Agent 能力扩展受到原 Runtime 结构限制
- Medical / Creator / Research 等不同 Domain 很容易继续堆进 Core
- 将来替换 UI 或 Runtime 的成本过高

Pi 更适合作为 Agent Runtime，而 DSH 已有 UI / Conversation / Tool UI / Layout 等可以继续利用。

---

## Desired Outcome

形成以下核心链路：

```text
DSH-derived UI
  ↓
Workbench Contract
  ↓
Pi Adapter
  ↓
Pi Runtime
```

并且用户在 DSH UI 内感知到的是正常的：

- Chat
- Streaming
- Tool Call
- Tool Result
- Session
- Error / Abort

而底层处理者已经是 Pi。

---

## User-visible Success

用户可以：

1. 打开现有 DSH UI
2. 创建或进入一个会话
3. 输入消息
4. 看到 Pi Runtime 产生的流式回复
5. 看到至少一个 Pi Tool Call 的运行和结果
6. 刷新后重新进入已有会话
7. 遇到错误或主动终止时得到明确反馈

---

## Platform Success

开发者获得：

- 独立的 Workbench Runtime Contract
- Pi Adapter
- DSH Bridge / Compatibility Layer
- 可验证的 Runtime 替换证据
- 后续可继续替换 DSH Host 的迁移基础

---

## Non-goals

本 Goal 不负责：

- Medical Workbench
- Creator Workbench
- 全新 UI
- 全面 Branding 清理
- 新设计系统
- 完整 Plugin Marketplace
- 全量 RAG
- Auth 重构
- 数据库重构
- 全量 Artifact 重构
- 大规模删除 DSH 代码

---

## Constraints

- 必须优先保持当前项目可启动。
- 必须先完成 Repository Audit。
- 必须保留必要 OSS License / Notice。
- 不允许为了“架构漂亮”做无关重构。
- 不允许伪造测试或 Evidence。
- 实际仓库事实优先于当前文件中的路径假设。

---

## Success Criteria

以下条件全部满足：

- [x] Baseline 已记录
- [x] Workbench Contract 已建立
- [x] Pi Adapter 已建立
- [ ] DSH UI 的 Prompt 实际由 Pi 处理
- [ ] Streaming 正常
- [ ] Tool lifecycle 正常映射
- [ ] Session Resume 可验证
- [ ] Abort 或 Runtime Error 可验证
- [x] build / typecheck / test 状态已记录
- [x] evidence.md 有真实证据
- [x] decision.md 已更新为最终决策

---

## Exit

当全部 Success Criteria 满足后：

`Status → DONE`

随后创建：

`GOAL-001-clean-dsh-product-layer`
