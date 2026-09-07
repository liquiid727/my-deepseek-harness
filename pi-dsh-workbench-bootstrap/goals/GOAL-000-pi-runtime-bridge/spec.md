# SPEC — GOAL-000 Pi Runtime Bridge

## 1. Architecture

目标：

```text
Web / DSH-derived UI
        │
        ▼
DSH Bridge / Compatibility Layer
        │
        ▼
Workbench Runtime Contract
        │
        ▼
Pi Runtime Adapter
        │
        ▼
Pi Agent Runtime
```

---

## 2. Repository-first Rule

本 Spec 不假设固定目录结构。

实现 Agent 必须先检查当前仓库，并决定实际路径。

建议语义模块：

```text
workbench-contract
pi-adapter
dsh-bridge
```

可以是：

- monorepo package
- source module
- plugin
- host module

但职责必须独立。

---

## 3. Workbench Contract

### 3.1 Runtime Interface

至少表达：

```ts
type SessionId = string

interface WorkbenchRuntime {
  createSession(input?: CreateSessionInput): Promise<WorkbenchSession>

  openSession(id: SessionId): Promise<WorkbenchSession>

  listSessions?(): Promise<WorkbenchSessionSummary[]>

  prompt(
    sessionId: SessionId,
    input: PromptInput
  ): Promise<void>

  abort(sessionId: SessionId): Promise<void>

  subscribe(
    listener: (event: WorkbenchEvent) => void
  ): () => void
}
```

具体函数签名可根据当前项目调整。

---

### 3.2 Events

至少支持：

```ts
type WorkbenchEvent =
  | TurnStartEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ThinkingDeltaEvent
  | ToolStartEvent
  | ToolUpdateEvent
  | ToolEndEvent
  | TurnEndEvent
  | RuntimeErrorEvent
```

建议公共字段：

```ts
interface BaseEvent {
  sessionId: string
  turnId?: string
  messageId?: string
  timestamp?: number
}
```

---

### 3.3 Message Delta

至少表达：

```ts
{
  type: "message.delta"
  sessionId: string
  messageId: string
  delta: string
}
```

---

### 3.4 Tool Lifecycle

```ts
tool.start
tool.update
tool.end
```

`tool.end` 至少包含：

```ts
{
  type: "tool.end"
  sessionId: string
  toolCallId: string
  toolName: string
  result?: unknown
  error?: {
    message: string
  }
}
```

---

## 4. Pi Adapter

Pi Adapter 负责：

```text
WorkbenchRuntime
       ⇅
Pi Session / Event / Tool
```

### Must

- 创建 Pi Session
- Session ID mapping
- prompt
- abort
- stream event mapping
- tool lifecycle mapping
- runtime error mapping

### Should

- 保留扩展 model mapping 的位置
- 保留 steer / follow-up 的扩展点
- 支持 session metadata

### Must Not

- 包含 UI component
- 包含 Medical 业务逻辑
- 包含 Creator 业务逻辑
- 写死某个页面
- 直接操作 DSH 前端 state

---

## 5. DSH Bridge

优先保留现有 UI 协议。

Bridge 职责：

```text
Existing DSH UI request
        ↓
Normalize
        ↓
Workbench Runtime API
        ↓
Pi Adapter
```

以及：

```text
WorkbenchEvent
        ↓
Translate
        ↓
Existing DSH UI event / stream
```

如果 DSH UI 现有事件协议已经足够通用，可让 Bridge 极薄。

---

## 6. Session Mapping

不要假设：

```text
DSH session id == Pi session id
```

建议：

```ts
interface SessionMapping {
  workbenchSessionId: string
  piSessionId: string
  legacyDshSessionId?: string
}
```

持久化方案优先选择当前项目已有能力。

本 Goal 不为了 mapping 新引入复杂数据库。

---

## 7. Tool Mapping

第一阶段至少接入一个可预测的测试 Tool。

推荐：

```text
get_current_project_info
```

返回：

```json
{
  "name": "...",
  "root": "...",
  "runtime": "pi"
}
```

如果 Pi 已有更合适、无破坏性的 Tool，可以使用现有 Tool。

要求 DSH UI 能看到：

```text
Running
→ Update（若支持）
→ Result
→ Completed / Error
```

---

## 8. Error Model

至少统一：

```ts
interface WorkbenchRuntimeError {
  code?: string
  message: string
  cause?: unknown
  recoverable?: boolean
}
```

不得：

- catch 后静默
- 只 console.error 不通知 UI
- 将整个内部对象无过滤暴露给最终用户

开发日志可以保留更详细的 stack。

---

## 9. Abort

如果现有 UI 有 Stop 按钮：

```text
UI Stop
→ DSH Bridge
→ WorkbenchRuntime.abort
→ Pi abort
```

如果现有 UI 没有 Stop，则至少在 runtime 层建立 abort 能力并增加最小可验证入口。

---

## 10. Compatibility Strategy

迁移优先级：

```text
Compatibility > Elegance
```

第一阶段允许：

- legacy adapter
- compatibility event
- thin host
- temporary mapping

但是必须在 Evidence 中标注：

```text
Temporary Compatibility
```

---

## 11. Observability

开发态至少可记录：

- session create
- prompt start
- pi event received
- tool start/end
- abort
- runtime error

避免打印敏感 Prompt / Secret / Token。

---

## 12. Security

不得：

- 把 API key 写死进源码
- 把 token 写入客户端 bundle
- 把 secret 写入 evidence
- 默认开启任意 shell execution 作为 POC
- 使用有破坏性的 Tool 证明 Tool Call

---

## 13. Testing Strategy

优先测试：

1. Contract unit test
2. Pi event mapping test
3. Tool lifecycle mapping test
4. Session mapping test
5. UI integration / E2E
6. Manual POC

---

## 14. Migration Boundary

本 Goal 完成后，应该可以清晰标记：

### Retained from DSH

- UI Shell
- Conversation rendering
- Tool UI
- Layout
- Theme
- 必要 Web plugin / bridge

### Replaced by Pi

- Agent execution
- Prompt handling
- Runtime streaming source
- Tool execution source
- Agent session runtime

### Still Legacy

列出尚未替换的 DSH Host / Runtime 能力。

---

## 15. Deliverables

代码：

- Workbench Contract
- Pi Adapter
- DSH Bridge
- 测试

文档：

- `goal.md`
- `spec.md`
- `test.md`
- `evidence.md`
- `decision.md`

---

## 16. Done Definition

只有 Test 文件中的 P0 验收项全部通过，才能 Done。
