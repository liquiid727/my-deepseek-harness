# 决策：会话 ↔ 项目绑定（SPEC §41）

- 状态：已实施
- 日期：2026-09-09
- 依据：SPEC §41、FR-23；AGENTS.md §2.3.9、§2.4

## 问题

SPEC §41 要求 `projectId ↔ sessionId` 的绑定写入 `med_session_project` 域，并要求任何注入模型请求的项目上下文都能从会话日志重建。域表、`sessionProjectSchema` 与仓储句柄从阶段 1 就存在，但没有任何代码写入：绑定是死表，`project_get_context` 只能显式传 `projectId`，会话没有「当前项目」概念。需要裁决：谁写绑定、谁读绑定、读不到时怎么报错。

## 决定

### 1. 绑定由建立上下文的工具写，不由 UI 写

`project_create` 成功后在同一个会话里把新项目设为当前项目；`project_get_context` 显式传 `projectId` 时选中并绑定该项目。两者都从工具执行上下文取 `exec.agent.id`（DSH 的 `Agent.id` 就是 `SessionId`），无 agent（直接服务调用、测试、headless 组合）时不写绑定，工具照常成功。

选择工具层而不是 UI 层的原因：DSH 客户端目前没有「选择项目」的入口（列表读取仍是待决项），而模型是当前唯一能表达「现在讨论哪个项目」的一方。等 UI 有入口时，再决定是否把 `bindSession` 暴露为 Remote 方法。

### 2. 服务方法是 host-only，不进 `MedProjectsService`

`ProjectsService.bindSession(sessionId, projectId)` 与 `sessionProject(sessionId)` 是公开但**不带 `@Remote`** 的方法，也不加入 `medical-contracts/src/services.ts` 的 `MedProjectsService`。理由：SPEC §41 只要求绑定落到域里，没有要求它是 Remote 面；客户端现在也不需要读它。保持 Remote 面最小，避免重复 `2026-09-08-remote-surface.md` 里「不发明接口」的决定。`StatisticsService.getRun` 已有同类先例（host-only、不在接口里）。

### 3. `project_get_context` 的 `projectId` 变为可选

- 传 `projectId`：读取并绑定该项目。
- 不传、传空串或纯空白：读取该会话已绑定的项目（真实模型把「不传」写成 `projectId: ""`，见下）。
- 都没有：返回 `{ ok: false, error: { code: "PROJECT_NOT_BOUND" } }`，提示传 `projectId` 或先创建项目。

模型看到的仍然只有工具结果；绑定本身不进入请求，满足「模型可见 ⟺ 已记录」。

**空串实测**：med-research profile 的真实模型轮次（会话 `session-e61e1d15…`）连续 6 次调用 `project_get_context` 时都传了 `projectId: ""`，每次都因 `projectIdSchema.min(1)` 失败，直到第 7 次才改成显式 id。因此工具把 `undefined`、空串与纯空白统一视为「未传」，并对显式 id 做 trim。

### 4. 新增错误码 `PROJECT_NOT_BOUND`

`PROJECT_NOT_FOUND` 表示项目不存在，而这里项目可能存在、只是会话没有绑定，用前者会误导模型。因此把 `PROJECT_NOT_BOUND` 加入 `medical-contracts/src/errors.ts` 的 `DOMAIN_ERROR_CODES`（SPEC §46 的列表是关键错误集合，允许新增稳定码）。

## 放弃的方案

- **新增 `project_bind` 工具**：SPEC §6 的工具清单是封闭的 22 个；`project_get_context` 已经承担「读取并选择上下文」的语义，再加一个工具只会让模型多一次调用。
- **把绑定做成 Remote 方法给客户端用**：客户端目前没有项目选择 UI，先加接口没有消费者，还会扩大待验证的 Remote 面。
- **`project_get_context` 缺少绑定时回退到「最近创建的项目」**：隐式回退会让模型在错误的项目上继续工作；fail-loud 才是正确行为。

## 需要的验证

- `plugin-project/tests/tools.spec.ts`（6 例）：创建即绑定；无 agent 不写绑定；省略 `projectId` 用绑定解析；显式 `projectId` 重新绑定；无绑定/无 agent 返回 `PROJECT_NOT_BOUND`；显式不存在的 id 返回 `PROJECT_NOT_FOUND`。另测空串/纯空白等同未传、显式 id 两侧空白被 trim。
- `plugin-project/tests/service.spec.ts`：`bindSession` 拒绝不存在的项目、写入 `updatedAt`、重新绑定覆盖旧值；`sessionProject` 读回。
- `medical-e2e/tests/composition.spec.ts` → `runs the project tools through the real Tool runtime and binds the session`：真实组合里经 Tool 注册表执行 `project_create` / `project_get_context`（含缺参被 schema 拒绝、无绑定返回 `PROJECT_NOT_BOUND`）。
- `pnpm run typecheck` 与 `pnpm run test`。

## 已知限制

- 绑定是最后一次写入者胜出：同一会话里显式选择另一个项目会覆盖旧绑定，没有历史。
- 只有 `project_create` 与 `project_get_context` 写绑定；`project_save_paper`、`literature_*` 等仍要求显式 `projectId`。
- 会话 id 只是不透明字符串，服务不校验它对应一个真实会话。
