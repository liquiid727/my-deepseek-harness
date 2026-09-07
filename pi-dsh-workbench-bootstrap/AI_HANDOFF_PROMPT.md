# AI Handoff Prompt — DSH Shell + Pi Runtime

你正在当前本地仓库中执行一次架构改造。

你的目标不是“继续魔改 DSH”，而是把当前项目改造成：

> **DSH 负责 UI / Shell，Pi 负责真正的 Agent Runtime。**

长期目标是形成一个可复用的 Personal Workbench Platform，使未来可以通过 Domain Pack / Extension / Skill 快速构建 Medical、Creator、Research、Coding 等不同个人工作台。

---

## 0. 最高优先级原则

1. **先跑通，再清理。**
   - 不要一开始大量删除 DSH 代码。
   - 第一阶段只证明：DSH UI 可以由 Pi Runtime 驱动。
   - 只有 POC 通过之后，才能逐步移除无用的 DSH Runtime。

2. **DSH 是 Shell，不是长期 Runtime。**
   - 尽可能保留现有 UI、Conversation、Session 展示、Tool Call UI、Layout、Theme、Artifact UI。
   - 尽量减少对 DSH Host / Agent Runtime 的长期耦合。

3. **Pi 是真正的 Agent Core。**
   - Conversation / Prompt / Tool Call / Session / Streaming 应最终由 Pi 驱动。
   - 不要自己重新造一套 Agent Runtime。

4. **必须增加一层 Workbench Contract。**
   - 不允许 UI 直接深度绑定 Pi。
   - DSH UI → Workbench Contract → Pi Adapter → Pi Runtime。
   - 未来应可以替换 UI 或 Runtime，而不重写整个项目。

5. **禁止盲目重构。**
   - 修改前必须先审计当前仓库结构、启动方式、依赖关系、协议和数据流。
   - 不允许凭想象删除目录或重写核心模块。

6. **保持仓库随时可运行。**
   - 每个阶段结束后必须能启动。
   - 如果架构迁移需要临时兼容层，优先保留兼容层。

7. **保留开源许可和必要归属信息。**
   - 可以清理产品 Branding、示例、宣传内容、无关配置。
   - 不得删除 LICENSE、NOTICE、第三方许可证、法律要求保留的版权声明。

---

# 1. 最终目标架构

```text
┌──────────────────────────────────────────────┐
│                Workbench Web                 │
│              DSH-derived UI Shell            │
│                                              │
│ Chat / Session / Sidebar / Tool UI / Artifact│
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             Workbench Contract               │
│                                              │
│ Session / Agent / Event / Model / File       │
│ Artifact / Capability                        │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                 Pi Adapter                   │
│                                              │
│ Workbench Event ←→ Pi Event                  │
│ Session Mapping / Tool Mapping / Streaming   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                  Pi Runtime                  │
│                                              │
│ AgentSession / Models / Tools / Extensions   │
│ Skills / Prompts / Session Persistence       │
└───────────────┬──────────────────────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
Platform Extensions   Domain Packs
Files / Browser       Medical
Search / Artifact     Creator
Project / RAG         Research
                      Coding
```

---

# 2. 当前任务

执行：

`goals/GOAL-000-pi-runtime-bridge/`

必须依次阅读：

1. `goal.md`
2. `spec.md`
3. `test.md`
4. `decision.md`

实现过程中持续更新：

5. `evidence.md`

---

# 3. 开始前必须完成 Repository Audit

不要立即写代码。

先检查并记录：

- package manager
- monorepo / single repo 结构
- Node / Bun / pnpm / npm / yarn 版本要求
- Web 入口
- Host / Server 入口
- DSH UI 如何发送 message
- Streaming 如何返回
- Session 保存在哪里
- Tool Call 如何进入 UI
- Tool Result 如何显示
- Artifact 如何工作
- 当前 Agent Runtime 从哪里启动
- 当前模型选择逻辑
- 当前 API / RPC / WebSocket / SSE 通信方式
- Cordis / plugin tree 的实际作用
- 哪些模块属于 UI Shell
- 哪些模块属于 DSH Runtime
- 哪些模块两者耦合

把审计结果写入：

`goals/GOAL-000-pi-runtime-bridge/evidence.md`

增加：

```md
## Baseline Audit
```

如果实际仓库结构与本文件假设不同，以实际代码为准。

---

# 4. 先建立 Baseline

在修改前必须：

- 安装依赖
- 启动当前项目
- 验证至少一条现有聊天链路
- 记录启动命令
- 记录当前错误
- 如果已有测试，执行测试
- 如果已有 lint/typecheck，执行

Evidence 中记录：

```md
## Baseline
- install:
- dev:
- build:
- test:
- typecheck:
- known existing failures:
```

注意：

> 原项目已经存在的错误，不要伪装成此次改造产生的新错误。

---

# 5. Workbench Contract

在合适位置创建独立 package / module。

建议语义：

```text
workbench-contract
```

实际路径根据当前 repo 结构决定。

最小接口必须覆盖：

```ts
interface WorkbenchRuntime {
  sessions: {
    create(...)
    open(...)
    list(...)
    delete?(...)
  }

  agent: {
    prompt(...)
    steer?(...)
    followUp?(...)
    abort(...)
  }

  models?: {
    list(...)
    getCurrent(...)
    setCurrent(...)
  }

  subscribe(listener): Unsubscribe
}
```

第一阶段不追求 API 完美。

但必须定义统一事件语义，至少：

```ts
type WorkbenchEvent =
  | { type: "turn.start"; ... }
  | { type: "message.start"; ... }
  | { type: "message.delta"; ... }
  | { type: "message.end"; ... }
  | { type: "thinking.delta"; ... }
  | { type: "tool.start"; ... }
  | { type: "tool.update"; ... }
  | { type: "tool.end"; ... }
  | { type: "turn.end"; ... }
  | { type: "runtime.error"; ... }
```

要求：

- DSH UI 不直接消费 Pi 私有事件结构。
- Pi Adapter 负责事件映射。
- Contract 不依赖 DSH。
- Contract 尽量不依赖 Pi。

---

# 6. Pi Adapter

创建：

```text
pi-adapter
```

职责仅包括：

- 创建 / 打开 Pi Agent Session
- prompt
- abort
- session mapping
- model mapping（如本阶段需要）
- Pi events → WorkbenchEvent
- Pi tool lifecycle → Workbench tool lifecycle
- 错误标准化

禁止：

- 在 adapter 中塞大量业务功能
- 在 adapter 中实现 Medical / Creator 逻辑
- 把 UI 状态写进 adapter

---

# 7. DSH Bridge

DSH 现有前端如果依赖原 Host Protocol，不要立即全部重写。

优先实现兼容桥：

```text
DSH UI
  ↓
DSH Bridge / Thin Host
  ↓
Workbench Runtime
  ↓
Pi Adapter
```

目标：

- 尽量少改 DSH Web UI
- 让 UI 感知不到底层 Agent 已切换到 Pi
- 逐步让旧 Runtime 退出，而不是一次性拆掉

---

# 8. 第一阶段只验证 5 个 POC

必须全部通过：

## POC-01 Basic Prompt

用户在 DSH UI 输入：

```text
hello
```

实际由 Pi AgentSession 处理。

UI 显示 Pi 返回内容。

---

## POC-02 Streaming

Pi 返回内容必须逐步显示。

不能等完整回复结束后一次性塞给 UI。

---

## POC-03 Tool Call

准备一个最低风险测试 Tool，例如：

```text
get_current_project_info
```

或者项目内部已有的安全 Tool。

要求：

Pi 调用 Tool → DSH UI 出现 Tool Running → Tool Result → Done。

---

## POC-04 Session Resume

1. 创建 Session
2. 发送消息
3. 刷新页面 / 重启允许的前端部分
4. 重新打开 Session
5. 至少已有对话上下文能够恢复

如果 Pi 自身 Session 行为与 DSH 不完全一致，使用 mapping layer，不要把两边 session id 强制等同。

---

## POC-05 Abort / Error

至少验证：

- 用户可以中止生成，或
- Runtime 错误能够被 UI 正确显示

不能让错误静默消失。

---

# 9. 此阶段禁止事项

GOAL-000 中不要做：

- 大规模品牌重命名
- Medical 功能
- Creator 功能
- 新设计系统
- 大规模 UI 重构
- 数据库迁移
- 全新 Auth
- 全新 RAG
- 全新 Artifact System
- 全新 Plugin Marketplace
- 重写所有 DSH plugin
- 删除无法确认用途的目录

除非它是完成 Pi Runtime Bridge 的硬性依赖。

---

# 10. 完成 GOAL-000 后才允许清理

POC 全部通过后，才可以准备下一个 Goal：

```text
GOAL-001-clean-dsh-product-layer
```

范围预计包括：

- DSH 产品 Branding
- 原产品默认 Prompt
- 原产品示例
- 无关模型配置
- 无关 Agent
- 无关 Demo
- 无关 Analytics
- 不需要的部署配置
- README / 文档重新定位

仍必须保留必要 OSS license / notice。

---

# 11. 实现方式

编码原则：

- 小步提交
- 优先 adapter
- 优先兼容
- 不做无关重构
- 类型清晰
- 错误必须可见
- runtime 与 domain 解耦
- UI 与 runtime 解耦
- 对新增公共接口增加测试
- 保持 lint/typecheck 尽可能通过

如果项目已有命名、目录、状态管理、测试约定，优先沿用项目约定。

---

# 12. Evidence Discipline

每完成一个里程碑，都更新 `evidence.md`。

Evidence 必须是真实情况，不允许编造。

至少记录：

- 修改文件
- 为什么修改
- 实际运行命令
- 测试输出摘要
- POC 结果
- 截图路径（如果 Agent 可以截图）
- commit hash（如果有）
- 未解决问题
- 兼容层
- 被保留的 DSH Runtime
- 已被 Pi 替换的能力

如果某个测试无法自动化，明确写：

```text
Manual verification required
```

而不是写 Passed。

---

# 13. 执行节奏

按这个顺序：

```text
Audit
↓
Baseline
↓
Contract
↓
Pi Adapter
↓
DSH Bridge
↓
Basic Prompt
↓
Streaming
↓
Tool Call
↓
Session Resume
↓
Abort/Error
↓
Regression
↓
Evidence
↓
Decision Update
```

每一步发现架构事实与原假设冲突时：

1. 不要硬套当前 Spec。
2. 记录事实。
3. 选择最小改动方案。
4. 更新 `decision.md`。
5. 继续完成 Goal。

---

# 14. 完成定义

只有同时满足以下条件才可以声明 GOAL-000 完成：

- DSH UI 正常启动
- 用户输入由 Pi Runtime 实际处理
- Streaming 正常
- Tool Call UI 生命周期正常
- Session 至少具备可验证的恢复能力
- Abort 或 Runtime Error 有明确处理
- Workbench Contract 已建立
- UI 没有直接深度依赖 Pi 私有事件
- Pi Adapter 独立存在
- 原 DSH Runtime 没有被无证据地大规模删除
- build/typecheck/test 状态有真实记录
- evidence.md 完整
- decision.md 反映最终实际架构

---

# 15. 现在开始

请先：

1. 阅读 `goals/GOAL-000-pi-runtime-bridge/*`
2. 审计仓库
3. 启动 Baseline
4. 更新 `evidence.md`
5. 再开始编码

不要先给我一篇长篇方案说明。

**直接在当前仓库中执行，并以 Goal → Spec → Test → Evidence → Decision 为唯一交付闭环。**
