---
requirement: R001
spec_package: S07
spec_id: SPEC-R001-S07
title: Skills Center and Builder
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 1.1.0
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: [S01, S02, S03, S04, S05, S08]
---

# Spec Package S07 — Skills Center and Builder

## 1. Objective and Traceability

Business Outcome: 用户安全地发现、创建、测试、安装和管理可审计的医学科研 Skill。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-009, REQ-R001-010, REQ-R001-016, REQ-R001-018 | SPEC-R001-S07-001..004 | AC-R001-011, 013-016 | P0 |

## 2. Scope and Architecture

In Scope: 内置目录、installed/my skills、search/category/detail、builder、validation、controlled test、local publication、workspace install、enable/disable、upgrade、uninstall、revoke、versions、permissions 和 audit。

Out of Scope: 商业 Marketplace、组织共享、未经审查的远程包、Skill 自带任意代码或直接凭据。

Architecture: 复用 DSH Skill capability 的定义与加载流程；医学 Skill service 拥有产品生命周期、Project installation 和审计；test run 通过受限制 Agent/Tool registry 执行，不改变 active registry。

## 3. Contract Behaviors

### SPEC-R001-S07-001 Inventory and inspect Skills

Given / When / Then: Given built-in/local definitions，When 打开 Skills Center，Then 区分 installed、authored、draft、testing、published-local、active、disabled、update-available 和 revoked，并显示 name、description、category、version、source、publisher、triggers、tools、schemas 和 effective permissions。

### SPEC-R001-S07-002 Author and validate a definition

Public Seam: Skill draft service/Remote、DSH Skill parser/loader validation。

Given / When / Then: Given builder fields，When save/validate，Then保留 Name、Description、Version、System Instructions、Triggers、Allowed Tools、Input/Output Schema、Knowledge、Examples 和 model preference；无效字段返回精确 path/message 并保留草稿。Allowed Tools 必须解析到当前可用工具，Skill 不能读取原始凭据。

### SPEC-R001-S07-003 Run a controlled test

Given / When / Then: Given VALIDATED draft 与 sample input/PDF，When test，Then在临时未激活 registry 中运行，显示 input、tool calls、output、errors、provenance 和 progress；取消/失败释放资源且不改变 installed/active state。Preview 明确标注为测试结果，不冒充生产结论。

### SPEC-R001-S07-004 Publish locally and manage installation

Given / When / Then: Given validated version，When publish/install/enable/disable/upgrade/uninstall/revoke，Then执行授权转换并记录 actor、source/target version、permission diff、decision 和 audit ID。新增工具或权限扩大必须重新确认；revoke 禁止新调用但保留历史记录；uninstall 只移除 Workspace membership。

## 4. UI Presentation Contract

`asset/skill工作台.png`：顶部显示“我的 Skill”、installed/my tabs、Create 和市场入口（V1 市场入口指向受信本地目录）；左列是搜索、状态筛选和高密度 Skill cards；中列是 Builder 表单、instructions、triggers、tools、schema、examples 和保存/publish；右列是 sample attachment、preview、progress、structured output 和 test action。

1672×941 保持三列且 Builder 为主列；1440×900 允许左右列收窄；390×844 依次切换 Inventory/Builder/Preview tabs，底部保存/发布/安装操作不遮挡表单。状态徽标、权限复选框、字段错误和测试/生产区别不只依赖颜色。

## 5. Data, Security, and Observability

SkillDefinitionId、SkillVersionId、InstallationId、TestRunId branded；定义和安装域单调版本。Instructions、knowledge 和 sample files 是不可信输入；测试权限是声明工具集合与当前 Agent Mode 的交集。审计不得包含凭据或未授权文件内容。

## 6. Verification and Acceptance Mapping

- 覆盖 inventory states、field validation、unknown tools、test isolation/cancel/failure、publish/install、permission reapproval、upgrade、uninstall 和 revoke。
- Client tests 覆盖三列布局、long instructions/schema、field errors、progress、narrow tabs、keyboard 和 zh/en。
- 真实 profile 使用受控 test flow 与 `skill工作台.png` 并排评审；静态 preview 不能作为证据。
- Acceptance: AC-R001-011, 013-016。

## 7. Spec Ready Check

- [x] Skills/Center/Builder 矩阵全部 P0/P1 功能已映射。
- [x] 来源、权限、测试隔离和生命周期明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)、[13 个内置 Skill](../../builtin-skills.md)。本包依赖全部业务 owner 完成集成；目录生命周期与定义执行使用同一个版本 identity。

catalog 接受 category/query/source/status/cursor，区分内置目录、已发布本地版本、已安装、我的草稿。详情包括版本、来源、publisher、更新时间、触发器、声明与有效权限、schemas、model preference、知识清单和安装作用域；update-available 是已安装版本与目录版本比较的派生值，不是覆盖定义的状态。

drafts.save/validate 使用 expectedVersion；必填 name/description/semantic version/instructions，schemas 使用 JSON Schema 2020-12 且拒绝远程 $ref，examples 必须匹配 schemas，knowledge 引用必须在当前 Workspace 授权范围，unknown tool/model 在校验时失败。trigger 为 explicit/upload/keyword，upload/keyword 需安装授权后生效。修改任何内容生成新 revision 并清除 VALIDATED/test freshness。

test 接受 validated revision、schema-valid input 和可选 PDF，临时 registry 与 Project 本地测试存储隔离；不得修改生产 Notes/Evidence/Drafts/installations。外部检索与统计执行仍需原审批，工具集合取共享权限交集。返回 testRunId、真实阶段/完成项、受控 tool trace、schema-valid output 或字段错误。取消释放任务/文件/临时 Agent，历史只保留允许的版本与脱敏证据；上传可删除并重试。

publish 创建不可变本地版本；必须当前 revision 校验通过且至少一次当前 input/output schema 测试成功，重版本号不同内容返回 VERSION_EXISTS。install 默认 DISABLED，用户明确 enable 才 ACTIVE；一次“安装并启用”可作为显式联合动作。首次安装展示工具/触发器/model/knowledge 权限确认；升级任何新增工具、文件范围、自动触发或模型外发范围要求再次确认。

升级准备失败/拒绝/取消保持旧版及其 ACTIVE/DISABLED；成功原子切换版本及授权。disable 阻止新调用并取消在途调用；uninstall 移除当前 Workspace 安装并保留定义和历史；revoke 标记发布版本不可新安装/调用，影响所有该版本安装并取消在途调用。审计记录无法回滚的已发生副作用。删除 draft 不能删除已发布版本历史。

13 个定义必须逐一满足目录行为与所属 Spec 的正/负例，不能用只有名称的卡片或空工具列表替代。Skill 测试 preview 的“已激活”只指临时测试 registry，产品徽标必须明确“测试中”，不能混淆 production active。
