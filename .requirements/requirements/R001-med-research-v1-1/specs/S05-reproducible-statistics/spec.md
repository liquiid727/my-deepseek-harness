---
requirement: R001
spec_package: S05
spec_id: SPEC-R001-S05
title: Statistics Lab
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 2.1.1
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: [S01]
---

# Spec Package S05 — Statistics Lab

## 1. Objective and Traceability

Business Outcome: 用户审阅并批准统计计划与代码，在隔离 Runner 中获得可复现结果、解释、图表和导出。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-001, REQ-R001-007, REQ-R001-008, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S05-001..004 | AC-R001-009, 010, 013-015 | P0 |

## 2. Scope and Architecture

In Scope: CSV/XLSX、preview、type inference/correction、missing analysis、Question、Outcome/Exposure/Covariates、method recommendation、plan、Python code preview、approval、isolated execution、stdout/stderr、structured effects、interpretation、charts、export 和 provenance。

Architecture: Dataset service owns files/profile；Statistics service owns plan/run；`medRunner` owns isolation；Artifact service owns exported bytes。Tool 不直接读取存储或启动进程。

### 2.1 Project/Session Context (S01 owner)

S05 只消费 S01 提供的当前 Project/Session context。Dataset、Plan、Run、Result 和 Artifact 的查询、写入与模型输入都使用该 binding；Statistics 工具不得自行绑定 Project 或改变 Session binding。S05 不注入第二份 Project context，也不创建 `medical/project-context` 自定义 Session event。缺少 binding 返回 `PROJECT_NOT_BOUND`，跨 Project 请求返回 `SCOPE_DENIED`。到达模型的 Project context 只包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据；Dataset 行、未授权 Project 数据、秘密和完整原始文献不得进入 bundle。模型可见统计输入与工具输出通过标准 `tool/result` Session 事件记录，Session replay 依据 S01 binding 与这些结果重建相同输入。

## 3. Contract Behaviors

### SPEC-R001-S05-001 Profile data and correct variables

Public Seam: dataset import、`dataset_profile/dataset_get_schema`、`medDatasets` Remote。

Given / When / Then: Given CSV/XLSX，When import，Then 在 Project 目录建立 hash identity，返回 rows/columns、前五行 preview、inferred types、missing counts 和 variable descriptions；用户修正类型形成新的 profile version，原文件不改写。

Errors: unsupported、oversize、encrypted/corrupt 和 ambiguous inputs 产生稳定错误；模型只看到 schema/profile/aggregates，不看到 preview rows。

### SPEC-R001-S05-002 Plan, generate, and approve code

Public Seam: `statistics_plan/statistics_generate_code`、approval policy、Statistics Remote。

Given / When / Then: Given统计问题和 profile，When planning，Then 显示 Outcome、Exposure、Covariates、assumptions、method、warnings、plan 和 Python code；plan/code 版本共同进入 WAITING_APPROVAL。任一输入变化使旧审批失效。

### SPEC-R001-S05-003 Execute honestly in isolation

Public Seam: `statistics_execute` 和 configured `medRunner`。

Given / When / Then: Given 当前审批，When execute，Then Runner 无网络、Dataset 只读、输出目录受控、CPU/内存/时间受限、package allowlist 生效且环境无宿主密钥；保存 status、stdout/stderr、runtime、packages、dataset/code hash。策略、超时、资源、import 或代码失败形成 FAILED 且不创建结果、解释或 artifact。

### SPEC-R001-S05-004 Render, interpret, and export results

Given / When / Then: Given successful run，When render，Then 显示 OR/RR/HR、CI、P 等结构化结果、明确为模型派生的解释，以及适用的 Histogram、Box Plot、Scatter、Forest Plot、ROC、Correlation 和 Kaplan-Meier；每个数字/图解析到 run result，每个图导出 PNG/SVG。

Malformed、mismatched 或缺 provenance 的 figure 被拒绝；不适用图表保持 disabled 并说明原因。

## 4. UI Presentation Contract

`asset/统计lab.png`：顶部显示 breadcrumb、Statistics Lab 标题和查看代码/导出/确认并执行；左列显示 Dataset、核心计数、preview 和 Variables；主列显示 Research Question、四块 Analysis Plan、Code/Results/Charts tabs、结果表和图；底部显示固定但不遮挡内容的 Execution & Provenance。

主布局在 1672×941 保持左 1/3、右 2/3；1440×900 允许压缩表格列；390×844 按 Dataset → Question/Plan → Approval → Code/Results/Charts → Provenance 单列，执行按钮保持可见但不绕过审批。代码区等宽字体，表格和图例保持可读；success 绿、failure 红、waiting 蓝/中性色不只依赖颜色。

## 5. Data, Security, and Observability

Dataset、Profile、Plan、Approval、Run、Result 和 Artifact IDs branded；域版本单调。记录 approval identity、input versions、policy decision、runner limits 和 artifacts。导出 route 验证 Project scope 和 exact artifact identity。

## 6. Verification and Acceptance Mapping

- Fixtures 覆盖 CSV/XLSX、类型修正、missing、计划、审批失效、无审批、网络/路径/资源/timeout/import/code failure、结果与全部图表。
- 隔离测试证明无网络、只读 Dataset、受控输出、无密钥和失败无产出。
- 浏览器覆盖 plan、waiting、executing、success、failure、tabs、图表、导出和窄屏，与 `统计lab.png` 并排评审。
- Acceptance: AC-R001-009, 010, 013-015。

## 7. Spec Ready Check

- [x] Statistics 矩阵全部 P0/P1 功能已映射。
- [x] 审批、隔离、失败、图表和 provenance 明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)、[内置 Skill](../../builtin-skills.md)。本包向 S01 贡献 Dataset/Run/Chart 概览和历史导航。

import 接受 CSV/XLSX 文件和 Project，CSV 默认 UTF-8/逗号/首行列名，无法确定编码或分隔符时要求用户选择；XLSX 多 sheet 必须用户选 sheet，公式使用文件保存值、无缓存值标缺失，不执行公式/宏。重复列名、空列名拒绝并指出列；重复文件 hash 复用原文件，可新建 profile revision。用户类型修正为 numeric/categorical/boolean/datetime/text；不可转换单元格显示计数并要求确认置 missing，不能静默丢行。Preview 前五行只到鉴权 UI。

planning 明确 Outcome/Exposure/Covariates、事件/参考水平、缺失处理、方法、假设检查与警告；模糊变量不生成可审批方案。默认双侧 alpha=0.05、CI=95%，在 plan 可编辑并保存；缺失处理默认 complete-case，显示排除数量，不做隐式插补。代码生成后才 WAITING_APPROVAL，详细审批与重试按共享状态约定。

V1 方法：描述统计/分组汇总；连续 Outcome 的线性回归；二分类 Logistic（OR）；二分类风险比较的 log-link Poisson + robust variance（RR）；生存数据 KM/log-rank 及 Cox（HR）；inverse-variance Meta Analysis。随机效应使用 REML tau² 与 Wald CI，同时输出固定效应、Q/I²/tau²，尺度 OR/RR/HR 在 log space 合并后还原；不能混合尺度。模型不收敛、奇异设计、完全分离、无有效样本时拒绝发布估计。所有方法需要声明实际样本、假设/诊断、runtime/package versions，S07 复用这些能力而不自建 Runner。

Histogram=numeric 单变量；Box=numeric 与可选 group；Scatter=两个 numeric；Forest=同尺度有效 effect/CI；ROC=二分类 Outcome 与预测概率，报告 AUC；Correlation=至少两个 numeric，注明 Pearson/Spearman 与样本量；Kaplan-Meier=非负 time、0/1 event 与可选 group。每类有适用正例；不适用应解释且禁用，不能以全禁用通过覆盖。缺 provenance、结果 schema 错误、路径逃逸、SVG 外部资源/脚本或 hash 不符的产物一律拒绝发布。

Runner stdout/stderr 先按输出策略限长和脱敏，不自动发送模型；只把通过 schema 的 aggregates/effects 传给 interpretation，禁止原始行、逐人预测和含秘密异常进入模型/浏览器证据。用户可查看代码与合规日志；解释失败保留成功数值/图表，标 INTERPRETATION_FAILED 并可重试解释，不重跑统计。

listDatasets/listRuns/getRun/listCharts 返回 Project scoped 历史与输入版本。用户重新运行成功历史也创建新审批/run；同一 run 的 result/chart/export 不改写。导出 PNG/SVG 保存 MIME/hash/size/runId 并用鉴权 exact artifact identity 下载。取消/重启失败不发布临时图；执行与产出提交间故障需证明没有半成功记录。
