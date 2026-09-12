# 决策：Project Workspace 的会话 Agent Mode

- 状态：已实施
- 日期：2026-09-11
- 依据：R001 S01、SPEC-R001-S01 §4、AGENTS.md

## 问题

S01 要求会话头部可以选择 Research、Paper、Statistics 模式，并让活动 Agent 只能使用对应工具。服务需要同时支持浏览器 Remote、审计恢复与 Agent 生命周期，而不能把模式复制成客户端自己的状态。

## 决定

### 1. 模式是服务状态，客户端只读写 Remote

`medProjects.getMode` 和 `medProjects.setMode` 使用 `AgentMode` 联合类型。`setMode` 先校验会话 id 和模式，再安装限制并追加 `mode.change` 审计行；审计失败会恢复前一个限制。没有活动 Agent 时，模式仍可通过审计日志持久化。

### 2. 活动 Agent 使用 `ctx.tools.restrict()`

Project 插件监听 `agent/created` 与 `agent/disposed`。创建或恢复 Agent 时读取该会话最后一条有效模式审计，安装实际已注册工具名组成的 allowlist；切换模式先释放旧限制再安装新限制，销毁 Agent 时释放限制。

### 3. allowlist 使用仓库当前工具名

S01 规范中的部分工具名与当前已注册工具名存在漂移。allowlist 采用当前注册表中的 `paper_get_document`、`statistics_generate_code` 等实际名称，避免限制器接受不存在的工具。模式没有新增 S02-S05 的业务实现。

## 验证

`plugin-project/tests/mode.spec.ts` 覆盖限制替换、审计追加、服务重建后的持久化读取；`plugin-medical-ui/tests/mode-action.client.spec.tsx` 覆盖头部选择器加载和切换；`pnpm --dir plugins/med-research test` 与 typecheck 通过。
