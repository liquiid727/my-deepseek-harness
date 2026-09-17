---
requirement: R001
spec_package: S01
spec_id: SPEC-R001-S01
title: Project Workspace and Workbench Shell
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 2.1.3
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: []
---

# Spec Package S01 — Project Workspace and Workbench Shell

## 1. Objective and Traceability

Business Outcome: 用户创建、切换和恢复 Project，并从统一医学工作台进入全部 V1 能力。

| PRD Requirement | Contract Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-001..004 | AC-R001-001, 013-015 | P0 |

## 2. Existing System Analysis

现有 `workspaceRegistry` 拥有 Workspace/Session 分组；医学 Project 服务拥有 `project.json`、业务域记录和 Project/Session 绑定；DSH sidebar 已提供品牌、Workspace、footer 和 settings slots，`conversation.view` 提供会话视图。当前缺少可叠加的主导航区域，医学首页只在单个会话面板内渲染。

## 3. Scope and Architecture

In Scope: Project CRUD、PICO/PECO 元数据、Workspace/Session 绑定、项目列表和会话、Overview 计数、Agent Mode、备份恢复、医学品牌、主导航、首页和共同视觉系统。

Out of Scope: 替换 `root`/整个 sidebar、独立 Web 应用、URL 路由、静态业务 mock、Team Collaboration。

Session replay: 所有模型可见工具输出都通过标准 `tool/result` Session event 记录；本 Spec 不引入也不依赖 `medical/project-context` 自定义 Session event。

Responsibilities:

- DSH sidebar 保持几何和折叠所有权，并声明可叠加的 `sidebar.primary.action` list slot；owner props 只提供 `wide`，条目以 `id/order/label` 注册并拥有自己的导航行为。
- 医学客户端注册首页、研究、文献库、统计和技能入口，复用 `sidebar.brand.mark/name`、Workspace browser、settings 和 session-scoped `conversation.view`。
- Project service 和存储是唯一业务状态；客户端不维护第二份 Project、Mode 或计数真相。

## 4. Contract Behaviors

### SPEC-R001-S01-001 Persist and bind Project

Public Seam: Project service、`project_create/project_get/project_get_context` tools、`medProjects` Remote、Workspace registry、Session binding 和 DSH 标准 `tool/result` Session log。

Given / When / Then: Given 合法目录与 Project 输入，When 创建、编辑、选择、归档、恢复或重载，Then `project.json`、版本化存储、Workspace registration 和 Session binding 均在成功返回前持久化；任一步失败都返回明确错误，不报告为成功。`project_create` 创建 Project 并绑定初始 Session，写入 `project.create` 审计；客户端 `selectProject` 重新绑定当前 Session，写入 `project.select` 审计；显式调用 `project_get_context(projectId)` 也重新绑定当前 Session，并写入同样的 `project.select` 审计。`project_get_context()` 不带 `projectId` 时读取已有 binding。UI 选择本身不向模型请求注入项目事实；`project_get_context` 是组合 Project Context bundle 的唯一入口，结果由标准 `tool/result` Session event 记录并可从 Session log 重建。

`project_create` 可以返回创建操作结果，`project_get` 可以返回单 Project 读取结果；二者都不承担组合 Project Context bundle 的职责。

Data and Errors: Project/Session/Workspace ID 使用 branded 类型；没有 `projectId` 且没有 binding 时 `project_get_context` 返回 `PROJECT_NOT_BOUND`，不得静默使用上一个 Project 或返回空 bundle；重复创建按规范化 workspace path 拒绝；不兼容导入、越界路径或无效 PICO 字段在写入前失败。成功只在该操作声明的持久化写入、binding 和审计都完成后返回；这些跨存储步骤不提供事务回滚，失败可能留下已写入的部分状态，调用方必须看到明确失败结果并按实际状态恢复，不能报告为成功。

### SPEC-R001-S01-002 Project roster, sessions, and overview

Public Seam: `medProjects.list/get/overview/sessions/create/update/archive/restore`。

Given / When / Then: Given 真实 Project 数据，When 用户搜索、选择或展开项目，Then 左侧区域显示 Project 和所属 Sessions，选择同步当前 Session Context；Overview 返回 Papers、Evidence、Datasets、Analyses、Charts 的实时计数和更新时间。

Failure: 单个计数域失败时显示 partial 及失败域，不用零覆盖未知值；Remote 失败保留当前选择并提供本地化重试。

### SPEC-R001-S01-003 Navigate the workbench shell

Public Seam: `sidebar.primary.action`、品牌 slots、`conversation.view`、right-pane tabs、settings 和 overlay。

Given / When / Then: Given 活动 Session，When 选择首页、研究、文献库、统计或技能，Then 激活对应会话视图并保留 Project/Session；无活动 Session 时医学会话视图不渲染，导航引导创建或选择 Session。

Compatibility: 新 slot 是 root-scoped additive list，不改变已有 single-slot owner；没有条目时 sidebar 几何和行为保持不变。右栏公开 client 类型/导出允许 out-of-tree 插件类型安全注册，但不改变现有 key dispatch。

### SPEC-R001-S01-004 Control mode, audit, and recovery

Public Seam: Session-header Mode action、`medProjects.getMode/setMode`、`ctx.tools.restrict()`、settings、`medExport/medImport`。

Given / When / Then: Given Research/Paper/Statistics 模式，When 用户切换，Then 服务记录模式与 audit ID 并替换活动 Agent allowlist；失败恢复前一限制。导出包含所有声明域版本，导入在验证全部版本和引用后一次提交。

Security: 密钥、Dataset 行和未授权跨 Project 标识不得出现在日志、备份预览或错误中。`project_get_context` 的组合 bundle 只返回当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据，不返回 Dataset 行、未授权 Project 数据、秘密或完整原始文献。

## 5. UI Presentation Contract

`asset/首页.png` 的 DSH 映射：现有 DSH sidebar 承载医学品牌、主导航和 Project/Session 列表；宿主顶部区域保留全局搜索/连接/账户能力；会话视图承载 Hero、研究问题输入、快捷能力、Project Overview、三张核心能力卡和研究灵感。

Desktop 1672×941: 左侧导航和 Project 列表保持独立视觉层级；主区 Hero 居中但不挤压 Overview；输入是首要操作；Overview 为单行高密度计数；核心能力为三列；宿主 composer 不遮挡最后内容。

首页 Hero 通过 `conversation.view` 的 `mountComposer` 放置唯一宿主 composer，不另建 textarea。宿主保留附件、引用、命令、权限、模型选择、发送/停止/排队和审批交互。普通消息准入成功后进入当前 Session 的 Chat；失败留在首页并按宿主规则恢复草稿。Research 由明确的快捷入口进入，灵感只填入草稿。切换 View 不重新创建编辑器；旧 Session、旧 View 或已释放注册的完成回调不得改变当前导航。

1440×900: 卡片与计数允许缩小间距但不改变顺序。390×844: sidebar/Project 列表进入宿主抽屉，快捷能力横向滚动或两列换行，计数两列，核心能力单列；主要输入和创建按钮始终可达。

Style: 使用 DSH font 和主题 token；医学蓝为主操作，绿/紫/橙只表达 Evidence/Statistics/警告语义；边框、阴影和圆角建立两级卡片层次；禁止 emoji 作为最终图标。Loading、empty、success、partial 和 failure 使用相同几何，避免状态跳动。

## 6. Verification and Acceptance Mapping

- Service/Remote/持久化测试覆盖创建、切换、计数、并发、Mode、审计和导入失败。
- Project context 测试覆盖 binding reload、审计记录、`project_get_context` 成功结果、无 binding 的 `PROJECT_NOT_BOUND`、标准 `tool/result` Session log 记录和未授权字段排除；不要求或产生未知的 `medical/project-context` event。
- Client tests 覆盖 slot 缺失/存在、导航、无 Session、zh/en、键盘和窄屏。
- 真实 profile 在 1672×941、1440×900、390×844 生成首页状态截图，与原型并排评审布局、间距、字体、颜色、图标、密度、滚动和遮挡。
- Acceptance: AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015。

## 7. Spec Ready Check

- [x] 每个行为有公开入口、数据所有者、失败语义和验收映射。
- [x] DSH 扩展保持 additive，不替换 single owner。
- [x] 首页原型的桌面和窄屏映射明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；本轮设计修订处于 review，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)。本包拥有通用 Project/Mode/backup/navigation 接口，业务贡献由各 Spec 向本包注册；所有贡献通过 effect 释放。

Project 输入包含 name、question、background、PICO/PECO 和 workspacePath；name 非空，PICO/PECO 每字段为可编辑文本，未填写保留空而不由模型补造。create 建立 active Project 与初始 Session；update 使用 expectedVersion；archive 使 Project 只读并移出活动列表，保留 Session/来源/运行历史；restore 恢复相同 ID。归档前如有运行中受保护操作，返回 PROJECT_BUSY，用户可等待或显式取消。未知 ID、重复路径、版本冲突分别失败且无部分写入。

list/sessions 返回稳定分页、当前选择与归档状态；overview 的五项计数分别为未撤销 membership Papers、未撤销 Evidence、Datasets、全部 AnalysisRuns、成功发布 Charts，随业务持久化通知刷新。Analyses 同时列状态统计，不能把失败 run 当成功。概览点击调用对应业务导航贡献，Datasets/Analyses/Charts 的列表由 S05 拥有。

无 Session 的导航请求先展示选择/创建 Project/Session；创建成功后激活目标视图，保留用户输入。每个 Session 保存当前 view、Paper focus、Dataset/run 选择；重载恢复，切换 Project 不复用另一 Project 的 focus。医学导航只使用已声明 view IDs 与 scope，不接管宿主 URL。

Project context reconstruction: Project selection persists the current Session binding and its audit record. The three binding paths are `project_create` with `project.create`, client `selectProject` with `project.select`, and explicit `project_get_context(projectId)` with `project.select`. `project_get_context()` reads the current binding when no `projectId` is supplied and returns `PROJECT_NOT_BOUND` when no binding exists. Model-visible Project facts enter only through its composed Project Context bundle; the standard `tool/result` event is the reconstructable Session-log source. The bundle contains the current Project's allowed summary, PICO/PECO, Overview, and authorized metadata. It excludes Dataset rows, unauthorized Project data, secrets, and complete raw literature. The tool must not fall back to a previous Project or an empty success response, and no `medical/project-context` event is emitted.

Research/Paper/Statistics Mode 的操作集合与权限交集按共享约定逐项执行；设置失败恢复旧 mode 与工具集合并记录拒绝。Profile backup 导出与恢复遵循共享域清单；域 Provider 必须贡献 prepare/validate/commit/rollback 与版本，不允许少备份一个 required 域而显示成功。

验收责任：AC-R001-001 主责，AC-R001-013/014 的共享 shell 与 AC-R001-015 的集成汇总主责；后者只有全部 required Spec accepted 才通过。本包的批准与局部实现不代表该集成 AC 已通过。
