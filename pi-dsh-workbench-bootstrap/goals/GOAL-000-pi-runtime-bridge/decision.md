# DECISION — GOAL-000 Pi Runtime Bridge

## ADR-0001 — Pi is the Agent Runtime

### Status

`ACCEPTED`

### Decision

Pi 作为 Personal Workbench 的 Agent Runtime。

DSH 不再作为长期 Agent Runtime，仅保留适合复用的 UI / Shell / Web Interaction 能力。

### Why

- Pi 更适合扩展 Agent Tools / Extensions / Skills。
- Domain 能力应以插件方式增长，而不是不断进入 Core。
- 降低对 DSH Runtime 内部架构的长期依赖。
- 为未来 Medical / Creator / Research 等 Domain Workbench 提供统一 Agent Core。

---

## ADR-0002 — DSH is the Initial UI Shell

### Status

`ACCEPTED`

### Decision

第一阶段继续保留 DSH-derived Web UI。

### Why

已有：

- Chat
- Conversation
- Tool Call UI
- Session presentation
- Layout
- Theme
- 其他可复用交互

没有必要为了切 Runtime 同时重写 UI。

---

## ADR-0003 — Add Workbench Contract

### Status

`ACCEPTED`

### Decision

DSH UI 与 Pi Runtime 之间增加独立 Workbench Contract。

### Why

避免：

```text
DSH UI ↔ Pi
```

形成新的强耦合。

目标：

```text
UI
↓
Workbench Contract
↓
Runtime Adapter
```

未来允许：

```text
DSH UI → Custom UI
Pi → Other Runtime
```

而 Domain 和产品层不需要全部重写。

---

## ADR-0004 — Compatibility First

### Status

`ACCEPTED`

### Decision

第一阶段允许保留 Thin DSH Host / Bridge。

### Why

DSH Web UI 可能依赖当前 Host / Plugin / Gateway 协议。

直接删除 Host 风险高，并且会把 Runtime 替换扩大成 UI 重构。

策略：

```text
先 Bridge
后解耦
最后清理
```

---

## ADR-0005 — Do Not Clean Branding Before Runtime POC

### Status

`ACCEPTED`

### Decision

品牌、README、Demo、原产品信息清理放到后续 Goal。

### Why

这些工作不能证明核心架构成立。

首要风险是：

> DSH Shell 是否能稳定由 Pi Runtime 驱动。

先解决最大技术风险。

---

## ADR-0006 — Preserve OSS Legal Notices

### Status

`ACCEPTED`

### Decision

清理 DSH 产品信息时，不删除 LICENSE / NOTICE / 法律要求保留的版权和第三方许可证。

---

# Implementation Decisions

以下内容由 Coding Agent 在实际审计后补充。

## ADR-0101 — Actual Bridge Location

Status: `ACCEPTED`

Decision:

- `packages/workbench/workbench-contract` → `packages/workbench/pi-adapter` → `packages/workbench/dsh-bridge`; the Host ingress is the existing `sessions.prompt` handler.

Reason:

- This keeps the browser protocol and DSH session log stable while the runtime is replaced.

---

## ADR-0102 — Session Mapping Storage

Status: `ACCEPTED`

Decision:

- Workbench mappings use a JSON file store in deployments that configure `mappingPath`; tests use the in-memory store. The stored Pi identity is the Pi session file path.

Reason:

- Pi `SessionManager.open(path)` restores the exact session file and prevents duplicate sessions after Host restart.

---

## ADR-0103 — Event Mapping

Status: `ACCEPTED`

Decision:

- Pi lifecycle events are translated to Workbench events, then to existing DSH `turn/*`, `step/*`, `assistant/*`, and `tool/*` events.

Reason:

- The UI remains unaware of Pi event payloads and keeps its existing mux and render-intent paths.

---

## ADR-0104 — Legacy Runtime Retention

Status: `ACCEPTED`

Decision:

- Legacy DSH Agent remains the default. `DSH_PI_RUNTIME=1` opt-in selects Pi at the Host API prompt ingress.

Reason:

- This limits blast radius while P0 real-provider evidence is collected.

---

## ADR-0105 — Pi Integration Mode

Status: `ACCEPTED`

Possible options:

- embedded SDK
- RPC process
- another supported integration strategy

Actual decision:

- Embedded `@mariozechner/pi-coding-agent` SDK with Pi `AgentSession` and `SessionManager`.

Reason:

- The SDK gives direct streaming events and durable session files inside the existing Host process; a separate RPC protocol is unnecessary for this bridge.
