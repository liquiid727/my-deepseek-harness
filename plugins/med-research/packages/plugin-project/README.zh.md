# @medresearch/dsh-plugin-project

[English](README.md) | 中文

## 概述

Med Research Workspace 的项目生命周期。提供 `ctx.medProjects`，注册 `project_create` / `project_get` / `project_get_context` / `project_save_paper`；在组合了人工命令注册表时，另注册 `/med-export` 与 `/med-import` 备份命令（SPEC §15.2）。创建项目会写入 `<workspace>/.medresearch/project.json`、把目录注册为 DSH 工作区、存储项目记录，并把会话绑定到该项目（SPEC §41）；模型只能通过工具结果看到项目上下文。服务同时提供会话级 Agent Mode，并把对应的工具 allowlist 应用到活动 Agent。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `workspaceRoot` | 必填 | 项目工作区的绝对父目录 |

`workspaceRoot` 没有普适取值，因此必填，缺失时 fail-loud。

## Patch 片段

```yaml
- name: '@medresearch/dsh-plugin-project'
  config:
    workspaceRoot: /path/to/med-workspaces
```

## 人工命令

组合了 `@deepseek-ai/dsh-commands` 时（交互式 Web profile），本插件注册 SPEC §15.2 要求的备份路径：

| 命令 | 输入 | 行为 |
|---|---|---|
| `/med-export <path>` | 备份文件路径 | 把所有已声明域与表写成一个 JSON 包（`medresearch.export`，信封版本 1）。 |
| `/med-import <path>` | 备份文件路径 | 先完整校验信封、域版本、表名与每条记录，再写入；校验被拒时存储保持不变。 |

两者都经 `ctx.fs` 写入，受文件策略约束。路径取输入 trim 后的整串，含空格的路径算一个参数。两条命令都不进入模型；命令注册表会记录 `command/run` / `command/done`。

## 模型影响

- `project_create` 返回已存储的 `Project`（JSON），并把它绑定为当前会话的项目（SPEC §41）。
- `project_get` 返回项目，或 `{ ok: false, error: { code: "PROJECT_NOT_FOUND" } }`。
- `project_get_context` 返回项目与概览计数：显式传 `projectId` 会选中并绑定它，并追加一条 `project.select` 审计记录；省略、传空串或纯空白则复用会话已绑定的项目；两者都没有时返回 `{ ok: false, error: { code: "PROJECT_NOT_BOUND" } }`。
- `project_save_paper` 只接受服务端产生的 `paperId`，从不接受模型给的 PMID/DOI 元数据。
- `medProjects.getMode` 与 `medProjects.setMode` 读取和修改会话的 `research`、`paper` 或 `statistics` 模式。模式变化追加到 `med_audit_logs`；组合了活动 Agent 注册表时，还会安装该模式的 `ctx.tools.restrict()` allowlist。
- 除这些工具结果外，没有任何项目上下文被注入请求。

## 已知限制与后续工作

- `delete` 只删记录，目录与工作区注册保留；破坏性删除需要审批策略层（SPEC §40）。
- 会话 ↔ 项目绑定存在 `med_session_project`；目前只有 `project_create` 与显式 `project_get_context` 会写。客户端可通过会话头部动作修改 Agent Mode，项目选择仍由工具驱动（SPEC §41）。
- `update` 会重写 `project.json`，但不改工作区标题。
- 创建不是原子操作：文件写入后失败可能留下目录与工作区注册而没有记录。
- `/med-import` 会写入包里携带的每条记录，不合并、也不跳过已存在的键；写入阶段发生存储失败可能留下部分导入的存储，因为 DSH 域之间没有跨域事务。
