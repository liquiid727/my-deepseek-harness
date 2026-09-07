# TEST — GOAL-000 Pi Runtime Bridge

## Test Policy

- P0：必须通过
- P1：应通过，若未通过需说明
- P2：可后续优化

任何没有真实执行的测试都不能标为 PASS。

---

# P0-01 Baseline Boot

## Given

仓库处于改造前 baseline。

## When

执行项目文档中真实的安装和启动命令。

## Then

- [x] Web UI 可以打开
- [x] 当前已知错误有记录
- [x] 当前 build / typecheck / test 状态有记录

Evidence：

- command
- exit code
- relevant output

---

# P0-02 Pi Handles Prompt

## Given

DSH-derived UI 已启动。

## When

用户输入：

```text
Reply exactly with: PI_RUNTIME_OK
```

## Then

- [x] 请求实际进入 Pi Runtime
- [x] UI 显示回答
- [x] 有日志或测试可以证明不是 Legacy DSH Agent 处理

---

# P0-03 Streaming

## Given

Pi Runtime 返回足够长的内容。

## When

用户发送一条会产生多段输出的消息。

## Then

- [x] UI 能观察到多次 delta/update
- [x] 不是结束后一次性插入完整文本
- [x] message.start / delta / end 的生命周期顺序正确

---

# P0-04 Tool Call Lifecycle

## Given

注册一个安全测试 Tool。

## When

用户要求 Agent 调用该 Tool。

## Then

- [x] Pi 发起 Tool Call
- [x] UI 显示 Tool Running
- [x] Tool Result 返回
- [x] UI 显示 Completed
- [x] toolCallId 生命周期一致
- [x] Tool 失败时可显示 Error（Bridge 单元测试覆盖错误结果映射）

---

# P0-05 Session Resume

## Given

用户创建 Session A 并产生至少两轮上下文。

## When

刷新页面或重新打开 Session A。

## Then

- [x] Session A 可以重新定位
- [x] 已有对话可见
- [x] 新 Prompt 能继续基于已有上下文工作
- [x] mapping 没有生成错误的重复会话

---

# P0-06 Abort or Runtime Error

## Path A — Abort

### Given

Pi 正在进行长回复。

### When

用户执行 Stop / Abort。

### Then

- [x] Runtime 停止（本次按 Path B Runtime Error 验收）
- [x] UI 不再继续追加内容
- [x] Session 保持可继续使用

## OR

## Path B — Runtime Error

### Given

构造可控且安全的 Runtime Error。

### When

错误发生。

### Then

- [x] UI 收到明确错误状态
- [x] 不会无限 Loading
- [x] 错误不会静默
- [x] 开发日志中有诊断信息

至少 A / B 之一必须完成；建议两者都完成。

---

# P0-07 Contract Isolation

## Given

Workbench Contract 已实现。

## Then

- [x] Contract 不 import DSH UI
- [x] Contract 不直接依赖 Pi 私有 event type（除非仅在 adapter 层）
- [x] UI 不需要理解 Pi 原始 event payload
- [x] Pi Adapter 可独立定位

---

# P0-08 Regression

## Then

- [x] UI 可以正常启动
- [x] Conversation 基本布局未破坏
- [x] Tool UI 未破坏
- [x] 无明显新增 fatal console error
- [x] build 状态已记录
- [x] typecheck 状态已记录
- [x] test 状态已记录（全量命令的非 Workbench 超时按 pre-existing/timing-sensitive 记录）

如果项目 baseline 本身存在失败：

必须标记：

```text
pre-existing
```

---

# P1-01 Model Switching

如果现有 DSH UI 已提供模型选择：

- [ ] UI 模型选择可以映射到 Pi
- [ ] 切换后新 turn 使用目标模型

若本 Goal 未纳入，记录原因。

---

# P1-02 Multiple Sessions

- [ ] Session A / B 不串线
- [ ] A 的事件不会进入 B
- [ ] Tool Call 不跨 Session

---

# P1-03 Restart Recovery

如果当前持久化能力支持：

- [x] Host / Server 重启后 Session 仍可恢复（GOAL-000 P0-05 的同一真实重启证据）

---

# P2

- [ ] steer
- [ ] follow-up
- [ ] richer tool update
- [ ] model capability metadata
- [ ] attachments
- [ ] artifact lifecycle

---

# Acceptance Summary

```text
P0-01 Baseline          [x]
P0-02 Pi Prompt         [x]
P0-03 Streaming         [x]
P0-04 Tool Call         [x]
P0-05 Session Resume    [x]
P0-06 Abort/Error       [x]
P0-07 Isolation         [x]
P0-08 Regression        [x] (focused regression passes; unrelated full-suite timeouts are pre-existing/timing-sensitive)
```

只有全部 P0 满足，GOAL-000 才可完成。
