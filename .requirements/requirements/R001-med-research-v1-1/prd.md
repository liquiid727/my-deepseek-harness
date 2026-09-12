---
id: R001
title: Med Research Workspace V1
type: feature
version: 2.1.0
status: approved
priority: P0
owner: med-research
created_at: 2026-09-10
updated_at: 2026-09-12
affects: [packages/client, plugins/med-research, asset]
---

# PRD — R001 Med Research Workspace V1

## 1. Summary

Med Research Workspace 是基于 DeepSeek Harness（DSH）的医学科研工作台。用户在一个 Project 中完成文献检索、论文阅读、证据验证、知识管理、统计分析、Skill 管理和基于证据的写作。系统必须让论文事实回到真实来源，让医学结论回到可定位的 Evidence，让统计结果回到获批代码及其执行记录。

V1 包含能力矩阵中的全部 P0 和 P1。P0 形成首个可用里程碑，P1 完成后 R001 才能通过最终验收。五张产品原型是阻塞设计输入，必须转换为可执行、可截图验收的 UI 约束。

## 2. Background

### Current Situation

- `.todo/0909/med-research-workspace-capability-feature-matrix-v1.0.md` 定义完整产品能力，`asset/` 提供五个核心工作面的视觉原型。
- 当前实现覆盖部分 Project、Research、Paper、Evidence 和 Statistics，但 Requirement Workspace 把多个矩阵能力排除为路线图，也没有把原型转换为可执行的布局和交互要求。
- 当前医学 UI 是 DSH 会话视图中的单面板投影，不能证明完整工作台、全局导航、Reader 右栏和高密度科研界面符合产品目标。

### Problem

- 产品矩阵、Requirement Workspace、实现入口和 UI 验收口径不一致，实施者可以在不违反现有合同的情况下交付明显偏离原型的结果。
- Knowledge、Evidence Table、Reader 辅助能力、Skills 和 Writing 缺少当前实现授权。
- “匹配原型层级”没有规定区域、密度、状态、响应式行为或可接受的宿主差异。

### Why Now

- R001 已进入实现阶段。继续基于缺失合同推进会扩大返工，并让旧证据错误地代表完整产品验收。

## 3. Goals

### G-R001-001 可追溯的医学研究

- User / business outcome: 用户从自然语言问题获得真实论文、可定位 Evidence、平衡结论和可解析引用。
- Success signal: Source Integrity 违规为零；Gold Set 上 Evidence relocatability ≥98%、Relation Accuracy ≥0.85、Claim Support Precision ≥0.85、Unsupported Claim Rate 为零。

### G-R001-002 完整的论文阅读与知识沉淀

- User / business outcome: 用户阅读、翻译、总结和标注论文，并把 Paper、Evidence、Note、Tag 和 Draft 沉淀到 Project。
- Success signal: 原文不被派生内容替换；每个保存对象可回到 Project、Paper 和原始选区。

### G-R001-003 可复现的统计分析

- User / business outcome: 用户审阅分析计划和代码后，在隔离环境获得真实结果、图表和 provenance。
- Success signal: 未审批执行、行级数据模型暴露和失败运行伪造产出均为零；成功结果 provenance 覆盖率为 100%。

### G-R001-004 可扩展的科研 Skill

- User / business outcome: 用户发现、创建、测试、安装和管理具有明确权限与版本的科研 Skill。
- Success signal: 草稿测试不会激活 Skill；未声明工具或凭据访问为零；权限扩大必须重新确认。

### G-R001-005 原型一致的医学工作台

- User / business outcome: 用户在一致、清晰、高密度且可访问的界面中切换 Project 和五个工作面。
- Success signal: 五张原型的规定状态通过同次真实 profile 截图并排评审，没有阻塞的布局、层级、密度、遮挡或交互偏差。

## 4. Non-Goals

- NG-R001-001: 医疗诊断、治疗建议或替代医生判断。
- NG-R001-002: 团队协作、多租户细粒度权限和 Marketplace 商业交易。
- NG-R001-003: 绕过授权获取全文、自建全球医学搜索引擎或对 PubMed 全库建立 embedding。
- NG-R001-004: 不受审查的远程 Skill 包或任意代码执行。
- NG-R001-005: 用静态 mock、模型常识或模拟全文完成真实业务验收。
- NG-R001-006: 独立 Web 应用、URL 路由或替换整个 DSH shell。

## 5. Actors and Scope

| Actor | Description | Allowed / forbidden boundary |
|---|---|---|
| ACT-R001-001 Researcher | 医生、研究生或科研人员 | 管理自己的 Project、资料、分析和 Skill；必须确认检索、执行与权限扩大 |
| ACT-R001-002 Medical Reviewer | 具有医学背景的证据评审者 | 评审 Gold Set 与医学输出；不替代来源真实性检查 |
| ACT-R001-003 Skill Author | 创建 Project 本地 Skill 的用户 | 编辑和受控测试；未经授权不能激活、扩权或访问原始凭据 |
| ACT-R001-004 Operator | 配置 DSH profile、数据源和 Runner 的部署者 | 管理部署策略；不能通过配置绕过审计、隐私和隔离要求 |

### In Scope

- Project、Research、Paper Reader、Evidence、Knowledge、Statistics、Skills、Writing 和必要的 DSH 平台扩展。
- 能力矩阵中标记 P0 或 P1 的功能，以及五张原型对应的真实服务状态。

### Out of Scope

- Non-Goals 中的能力和矩阵明确标记为“后期”的 Team Collaboration。

## 6. User / Business Scenarios

### FLOW-R001-001 建立研究并形成结论

Actor: ACT-R001-001。

Preconditions: 用户进入受支持的 `med-research` profile，并选择或创建 Project。

Flow:
1. 用户描述研究问题并审阅 PICO/PECO、关键词、MeSH 和 PubMed Query。
2. 用户确认检索，筛选、排序和保存真实论文。
3. 用户阅读原文、翻译或总结内容，并从选区保存 Note 或 Evidence。
4. 系统验证 Evidence 位置和语义关系，展示 SUPPORT、AGAINST 和 UNCERTAIN。
5. 系统只输出通过 Claim Gate 的结论与后端生成的引用。

Expected Outcome: 每个 Claim 通过 Evidence ID、原文位置和 Paper 标识符完成追溯。

### FLOW-R001-002 建立 Project Knowledge

Actor: ACT-R001-001。

Preconditions: Project 已包含至少一种 Paper、Evidence、Note 或 Dataset。

Flow:
1. 用户通过项目库筛选、搜索、标记和组织资料。
2. 用户按 Claim 比较 Evidence，或对当前 Project 资料提出问题。
3. 用户创建引用 Verified Evidence 的 Draft，并导出论文引用或 Markdown。

Expected Outcome: 每个知识对象保持 Project、来源和引用关系，Project RAG 回答只使用项目资料。

### FLOW-R001-003 完成可复现统计分析

Actor: ACT-R001-001。

Preconditions: Project 已绑定，用户提供受支持的 CSV 或 XLSX。

Flow:
1. 系统展示 Dataset Preview、类型、缺失值和变量，用户可修正变量类型。
2. 用户提出统计问题并审阅 Outcome、Exposure、Covariates、方法、计划和代码。
3. 用户确认执行，Runner 在隔离环境运行代码。
4. 用户查看结构化结果、解释、适用图表、日志和 provenance，并导出图表。

Expected Outcome: 每个数字和图表解析到一次成功的 AnalysisRun；失败运行只保留代码和错误。

### FLOW-R001-004 创建并使用科研 Skill

Actor: ACT-R001-003。

Preconditions: 用户具有活动 Project，Skill 来源为内置目录或当前 Workspace 本地草稿。

Flow:
1. 用户查看已安装和自建 Skill，编辑名称、版本、指令、触发条件、工具权限、Schema、知识和示例。
2. 系统校验定义并显示有效权限；用户用受控输入测试草稿。
3. 用户保存、发布到本地目录并安装到当前 Workspace；权限扩大时重新确认。
4. 用户启用、停用、升级或撤销 Skill，并查看对应审计记录。

Expected Outcome: 生命周期、版本、来源、权限、测试结果和激活状态一致且可审计。

## 7. Functional Requirements

### REQ-R001-001 Project Workspace

System MUST 创建、编辑、列出、选择、归档、恢复、导入/导出 Project，维护 Project 与 Workspace/Session 的绑定，并实时显示 Papers、Evidence、Datasets、Analyses 和 Charts 计数。

Observable Result: Project 元数据、`project.json`、Workspace、Session Context 和 UI 计数一致；切换 Project 后 Agent Context 同步切换。

Priority: Must (P0)。

Agent Behavior Contract: 模型可见 Project Context 100% 可从版本化 Session fixture 重建；缺失绑定时交还用户选择。

### REQ-R001-002 Confirmed Query Planning

System MUST 从自然语言问题生成可编辑的规范化问题、PICO/PECO、关键词、MeSH 候选和主/宽检索式，并在用户确认前禁止数据源请求。

Observable Result: 用户可编辑并确认 Query Plan；确认前 Connector 请求数为零。

Priority: Must (P0)。

Agent Behavior Contract: 使用版本化 PONV fixtures 和获批样本问题；记录计划、编辑、确认、调用和部分失败；缺字段时请求用户修正。

### REQ-R001-003 Authentic Literature Retrieval

System MUST 从 PubMed 响应取得 PMID/DOI 和元数据，完成去重、分页、年份/Study Type 筛选、Top 100 Rerank 到 Top 20，并区分空结果、限流、超时和部分失败。

Observable Result: 每个 Paper 标识符和书目信息可回到 Connector 数据；保存状态跨重启保留。

Priority: Must (P0)。

Agent Behavior Contract: 录制 NCBI fixtures 和显式 live E2E 上 Source Integrity 违规为零；保留请求、来源与排序 provenance。

### REQ-R001-004 Source-faithful Paper Reading

System MUST 显示 Abstract、用户 PDF 或可用 PMC XML 的真实内容及解析状态，并提供章节导航、原文/翻译/双语、缩放、选区工具条、全文/章节总结、引用复制和来源打开。

Observable Result: Reader 明确显示来源和可用性；翻译、总结和解释不会修改或替换保存的原文。

Priority: Must (P0/P1)。

Agent Behavior Contract: 派生输出保留 Paper、Document、Paragraph、模型和 Prompt 版本；来源不可用时禁止生成模拟正文。

### REQ-R001-005 Verifiable Evidence

System MUST 保存 Evidence 的原文、规范化文本、段落/页码/章节/offset、来源类型、抽取 provenance、关系、locator status 和 support status，并独立验证位置与语义关系。

Observable Result: `NOT_FOUND` 不能成为 `VERIFIED`；打开 Evidence 精确高亮保存的规范化区间。

Priority: Must (P0)。

Agent Behavior Contract: 医学评审 Gold Set 上 relocatability ≥98%、Relation Accuracy ≥0.85；保留候选、模型/Prompt 版本、决定和理由；无法判定时保持 UNCERTAIN。

### REQ-R001-006 Claims, Counter Evidence, and Citations

System MUST 拒绝无合格 Evidence 的 Claim，展示 SUPPORT、AGAINST、UNCERTAIN 和二手引用，保留反证，并由后端按首次出现顺序生成引用编号。

Observable Result: 每个输出 Claim 至少关联一条合格 Evidence，每个 `[n]` 解析到 Evidence 和 Paper；证据不足时输出不足说明。

Priority: Must (P0)。

Agent Behavior Contract: 同一 Gold Set 上 Claim Support Precision ≥0.85、Unsupported Claim Rate 为零；保留 Claim/Evidence 映射、反证和不足理由。

### REQ-R001-007 Dataset Profile and Approved Analysis

System MUST 处理 CSV/XLSX，显示 Preview、类型、缺失值和变量，持久化用户修正，并生成可审阅的 Outcome、Exposure、Covariates、方法、计划、代码和警告。

Observable Result: 执行保持 `WAITING_APPROVAL`，直到用户确认当前计划与代码。

Priority: Must (P0)。

Agent Behavior Contract: 未审批执行和行级数据模型暴露均为零；变量含糊时交还用户修正。

### REQ-R001-008 Reproducible Statistics

System MUST 在无网络、只读 Dataset、受控输出、资源限制、包 allowlist 且无宿主密钥的 Runner 中执行获批代码，生成结构化结果、解释、Histogram、Box Plot、Scatter、Forest Plot、ROC、Correlation 和适用的 Kaplan-Meier，并导出 PNG/SVG。

Observable Result: 成功运行显示 Dataset/Code hash、runtime、包版本、结果、图表和日志；失败运行显示代码/stderr 且不产生结果、解释或图表。

Priority: Must (P0/P1)。

Agent Behavior Contract: 版本化统计 fixtures 上结果确定且 provenance 覆盖率 100%；保留审批、代码、Runner 状态、输出和失败。

### REQ-R001-009 Integrated Accessible UI

System MUST 通过 DSH 客户端扩展点呈现真实服务状态、类型化 zh/en 文案、语义化控件、键盘操作、可见焦点、足够对比度、reduced motion 和桌面/窄屏布局。

Observable Result: 五张原型规定的区域、信息顺序、主要操作、密度和状态在真实 profile 中可见且不重叠。

Priority: Must (P0/P1)。

Agent Behavior Contract: Not applicable；UI 只投影已持久化或已记录状态。

### REQ-R001-010 Controlled Operation

System MUST 验证配置、记录并限制 Agent Mode、审计受保护动作、通过版本化备份恢复，并提供不泄露密钥或行级数据的稳定本地化错误。

Observable Result: Mode、allowlist、审批、拒绝、审计和恢复结果确定；不兼容导入在写入前失败。

Priority: Must (P0)。

Agent Behavior Contract: 版本化 mode/security matrix 上禁止调用和泄露均为零；保留 actor、mode、allowlist、decision 和 audit ID。

### REQ-R001-011 Workbench Shell and Navigation

System MUST 在保留 DSH shell 所有权的前提下提供医学品牌、Project 区、首页/研究/文献库/统计/技能主导航、顶部宿主区、面包屑、会话视图和右侧阅读区。

Observable Result: 导航切换正确的 Project/Session 作用域视图，侧栏折叠和窄屏抽屉不丢失当前工作状态。

Priority: Must (P0)。

Agent Behavior Contract: Not applicable。

### REQ-R001-012 Knowledge and Library

System MUST 提供 Project Papers、My Papers、Uploaded Papers、Evidence Library、按 Claim 分组、Project/Paper/Selection Notes、Tags、标题/作者/PMID/Note 搜索、Project RAG 和 Draft。

Observable Result: 用户可增删、筛选、标记、检索和回到来源；Draft 只能引用可解析的 Verified Evidence。

Priority: Must (P0/P1)。

Agent Behavior Contract: Project RAG 只使用当前 Project 的版本化检索 corpus；记录检索候选和引用；无合格资料时交还用户。

### REQ-R001-013 Advanced Discovery

System MUST 提供 Full Text Filter、Counter Search、Related Papers 和可解释的 Rerank 结果。

Observable Result: 用户可区分普通结果、反向检索和相关论文，并查看筛选/排序依据与来源状态。

Priority: Must (P1)。

Agent Behavior Contract: 使用同一版本化检索样本报告 Recall@20/Precision@20 和 Counter Evidence Miss Rate；指标算法与阈值冻结流程遵循[医学评估协议](evaluation.md)；阈值未批准阻塞最终验收，未达到时保留词法结果并标明降级，降级不豁免质量门槛。

### REQ-R001-014 Reader Assistance and Annotations

System MUST 对选区提供翻译、术语解释、简单解释、问 AI、Note、Highlight、Evidence、Copy 和 Citation，并提供结构化全文/章节摘要和与当前 Project 的相关性分析。

Observable Result: 每个派生项保留原选区和 Paper 引用；取消或失败不会创建 Note、Highlight 或 Evidence。

Priority: Must (P0/P1)。

Agent Behavior Contract: 医学输出保留输入选区、模型/Prompt 版本和结果；Evidence 与 Claim 使用 REQ-R001-005/006 的阈值与降级规则。

### REQ-R001-015 Evidence Table and Reference Exploration

System MUST 按 Claim、关系、来源类型和验证状态组织跨论文 Evidence，支持冲突比较、二手引用追原文和相关参考文献探索。

Observable Result: 表格中的每一行解析到 Evidence 与 Paper；追不到原文时保留原 secondary 记录的定位状态并记录 chase failure；新候选无原文时为 NOT_FOUND，不提升为直接证据。

Priority: Must (P0/P1)。

Agent Behavior Contract: Reference Chasing 只使用已声明 Connector；记录每次解析跳转和失败；关系判断沿用 Gold Set 门槛。

### REQ-R001-016 Skills Center and Builder

System MUST 显示内置、已安装和自建 Skill，并支持搜索、分类、详情、创建、编辑、校验、受控测试、本地发布、安装到 Workspace、启停、升级、卸载和撤销。

Observable Result: 名称、版本、来源、状态、触发条件、允许工具、Input/Output Schema、知识、示例、测试结果和有效权限一致可见；[内置目录](builtin-skills.md) 的 13 个 Skill 均能完成规定业务流程。

Priority: Must (P0 基础框架/P1 完整生命周期)。

Agent Behavior Contract: 生命周期与权限 fixtures 上草稿激活、未声明工具/凭据访问和未确认权限扩大均为零；内置医学 Skill 的语义质量由其所属 REQ 评估。

### REQ-R001-017 Evidence-based Writing and Export

System MUST 用已验证 Evidence 辅助 Literature Review 和学术中英互译，并从真实 Paper 元数据导出 RIS、BibTeX 和 Markdown 引用。

Observable Result: Draft 中每个事实引用可回到 Evidence；导出字段来自保存的 Paper，不由模型补造。

Priority: Must (P1)。

Agent Behavior Contract: Unsupported Claim Rate 为零；保留 Draft/Claim/Evidence 映射；证据不足时插入明确占位并交还用户处理。

### REQ-R001-018 DSH Platform Integration

System MUST 通过完整的 Service Definition/Provider/Consumer、Tool、Approval、Sandbox、Session Context、Plugin 和客户端扩展面提供能力，且所有注册均可释放。

Observable Result: 受支持 profile 是唯一启动入口；模型可见输入可从 Session log 重建；缺少依赖或错误配置在最早可判定点失败。

Priority: Must (P0)。

Agent Behavior Contract: 所有模型可见输入 100% 已记录；禁止工具调用和受保护动作使用版本化策略 fixtures 验证。

## 8. Business Rules, Lifecycle, and Edges

- BR-R001-001: 能力矩阵中的 P0/P1 属于 R001 V1；实现状态不能改变产品范围。
- BR-R001-002: 原型规定产品视觉和信息层级；真实服务与持久化状态规定事实。
- BR-R001-003: 用户确认 PubMed 检索、统计执行和 Skill 权限扩大。
- BR-R001-004: 原文、Connector 响应和 Runner 输出分别优先于翻译、总结、模型解释和缓存。
- BR-R001-005: P0 完成只形成阶段里程碑；P1 未完成时 R001 不能 accepted。
- INV-R001-001: 所有模型可见输入可从 Session log 重建。
- INV-R001-002: Paper、Evidence、Citation、Result、Figure 和导出字段不得被发明。
- INV-R001-003: `VERIFIED` 只能对应 `FOUND` 或 `PARTIAL`；`NOT_FOUND` 必须被拒绝。
- INV-R001-004: 每个最终 Claim 和 Draft 事实都有合格 Evidence。
- INV-R001-005: 每个统计数字和图表解析到成功 AnalysisRun。
- INV-R001-006: Dataset 行不能进入模型或 Session；真实患者行、宿主密钥和未授权跨 Project 数据不能进入浏览器证据。合成数据可用于 Preview 截图。
- INV-R001-007: Skill 只能调用已声明且已批准的工具；测试草稿不能改变激活状态。

| ID | Case | Expected Behavior |
|---|---|---|
| EDGE-R001-001 | 无活动 Project/Session | 显示可操作空态；不注册会话作用域视图，不伪造数据 |
| EDGE-R001-002 | Connector 或全文部分失败 | 保留真实成功结果，逐项显示失败和重试 |
| EDGE-R001-003 | Citation span 失效 | 拒绝支持关系并显示 NOT_FOUND/REJECTED |
| EDGE-R001-004 | 只有 Abstract | 明确显示 abstract-only，禁用依赖全文的动作 |
| EDGE-R001-005 | Runner 失败或超限 | 保留代码/stderr，不创建结果、解释或图表 |
| EDGE-R001-006 | 窄屏 | 主导航、Project 列表和右栏按 Spec 折叠为抽屉/tab，主操作可达 |
| EDGE-R001-007 | 重试、重复或并发 | 按稳定 identity 复用或拒绝，不产生冲突终态 |
| EDGE-R001-008 | 不兼容导入 | 任何持久写入前失败 |
| EDGE-R001-009 | Skill 升级扩大权限 | 保持旧版本状态，直到用户重新确认 |
| EDGE-R001-010 | Project RAG 无合格命中 | 明确报告资料不足，不使用跨 Project 或模型常识补齐 |

Lifecycle:

- Research: `IDLE -> PLANNING -> PLAN_READY -> SEARCHING -> PAPERS_READY -> RETRIEVING_EVIDENCE -> LOCATING -> VERIFYING -> ANSWER_READY`；任一阶段可进入 `ERROR_PARTIAL`。
- Statistics: `NO_DATASET -> PROFILING -> READY -> PLANNING -> PLAN_READY -> GENERATING_CODE -> WAITING_APPROVAL -> EXECUTING -> SUCCEEDED|FAILED`。
- Skill: 定义、测试、发布和安装分别持有状态；安装默认 DISABLED，显式启用才 ACTIVE。编辑和测试不能改变安装状态，转换见[共享状态约定](interfaces.md)。
- Draft: `DRAFT -> REVIEWABLE -> EXPORTED`；任一来源失效后回到 DRAFT 并标记缺失引用。

## 9. UX, Non-Functional Goals, and Constraints

五张 `asset/*.png` 是设计输入。每个拥有资产的 Spec 必须写出 prototype-to-DSH 映射，包括页面区域、信息顺序、主次操作、卡片密度、字体层级、语义颜色、图标、滚动区、固定区、桌面与窄屏行为。未预先记录的宿主差异不能在验收时作为豁免。

| Area | Requirement |
|---|---|
| Performance | Research 在声明环境和最多 20 篇最终论文下 P50 ≤90s、P95 ≤240s；UI 操作不得被同步业务工作阻塞 |
| Reliability | 部分结果可用；重试、重启、取消和恢复不得发明或破坏状态 |
| Security / privacy | 行级数据可由鉴权数据接口在用户本地 Preview 查看及由隔离 Runner 处理；不进模型、Session 日志或含真实患者行的截图；密钥不进日志/模型；受保护动作审批；Skill 无原始凭据访问 |
| Accessibility | 键盘操作、可见焦点、语义控件、对比度、reduced motion 和 200% zoom 可用 |
| Compatibility / migration | DSH profile 启动；SQLite 域单调版本；Session 格式相邻迁移；不兼容导入写入前失败 |

Constraints:

- 医学业务保留在 out-of-tree `plugins/med-research`；DSH 只增加可复用的最小客户端扩展点。
- 不替换 `root`、整个 sidebar 或 shell；不新增医学专用 URL 路由。
- UI 文案全部由类型化 zh/en 字典拥有。
- 每个可见业务状态来自真实服务、持久化记录或明确标注的受控测试运行。

## 10. Acceptance Criteria

- AC-R001-001: Given 创建或恢复 Project，When 切换并重载，Then 元数据、Workspace、Session Context 和全部概览计数一致。
- AC-R001-002: Given 自然语言问题，When 用户尚未确认计划，Then Query Plan 可编辑且 Connector 请求为零。
- AC-R001-003: Given 已确认检索，When 获得成功、空结果、限流、超时或部分失败，Then UI 和持久化准确区分状态且每个 Paper 可追源。
- AC-R001-004: Given Abstract、PDF、PMC XML 或解析失败，When 打开 Reader，Then 只显示真实可用内容、正确来源状态和对应动作。
- AC-R001-005: Given 选区、Note、Highlight 或 Evidence，When 保存并重开，Then 原文不变且对象回到精确 Paper/Paragraph/offset。
- AC-R001-006: Given 候选 Evidence，When 定位和语义验证完成，Then 状态满足不变量且 source navigation 精确高亮。
- AC-R001-007: Given 支持、反对和不确定证据，When 生成结论，Then 每个 Claim 有合格 Evidence、引用可解析且证据不足不生成 Claim。
- AC-R001-008: Given Project Knowledge，When 搜索、筛选、分组、RAG 或创建 Draft，Then 默认结果限制在当前 Project 并保持来源关系；显式 My Library 聚合视图只显示用户授权 Projects，并标明 membership，RAG 始终只用当前 Project。
- AC-R001-009: Given CSV/XLSX，When 修正变量并审阅计划/代码，Then 执行保持等待确认且行级数据不进入模型。
- AC-R001-010: Given 获批或失败 AnalysisRun，When 查看和导出结果，Then 成功产出完整图表/provenance，失败不产生结果、解释或图表。
- AC-R001-011: Given Skill 草稿或安装版本，When 校验、测试、发布、安装、升级、停用或撤销，Then 生命周期、权限、版本和审计一致且无越权。
- AC-R001-012: Given Verified Evidence 和真实 Paper 元数据，When 生成 Draft 或导出引用，Then 所有事实与字段可追溯且未解析引用阻塞完成。
- AC-R001-013: Given 1672×941、1440×900 和 390×844 视口，When 运行五个规定的真实 profile 场景，Then 并排评审确认布局、间距、字体、颜色、图标、密度、滚动、主操作和遮挡无阻塞偏差。
- AC-R001-014: Given 键盘、200% zoom、reduced motion 和 zh/en，When 完成每个核心流程，Then 控件、焦点、语义、文案和响应式操作均可用。
- AC-R001-015: Given 受支持 profile，When 运行 P0 Research/Statistics 里程碑和完整 P1 流程，Then 真实 Service/Tool/Remote/storage/Session 边界完成且全部 required Spec 被接受。
- AC-R001-016: Given 医学评审 Gold Set，When 独立评审 Evidence、Claim、Counter Evidence 和内置医学 Skill，Then 记录版本、样本、指标、阈值和 reviewer，禁止模型自评分代替。

## 11. Capability Traceability

[逐项覆盖表](coverage.md) 是本 PRD 的规范性附件，逐项绑定矩阵能力、REQ、Spec 行为与计划验证；[共享接口](interfaces.md)、[UI 验收](ui-acceptance.md)、[内置 Skill](builtin-skills.md) 和[医学评估协议](evaluation.md) 同样随本版本批准。P0/P1 或必交细化项缺少行为/验收归属会阻塞 Spec Ready，不允许基础占位 UI 或后续完善替代正例交付。

## 12. Spec Package Decomposition

| Package | Business Outcome | Covers | Depends On | Required |
|---|---|---|---|---|
| S01 Project Workspace & Workbench Shell | 创建、切换和恢复 Project，并从原型一致的工作台进入全部能力 | REQ-001, REQ-009, REQ-010, REQ-011, REQ-018 | None | true |
| S02 Research Discovery | 审阅查询并发现、筛选、排序、保存真实论文 | REQ-002, REQ-003, REQ-009, REQ-013, REQ-018 | S01 | true |
| S03 Paper Reader | 阅读真实来源并完成可追溯的翻译、总结、选区和定位 | REQ-004, REQ-009, REQ-012, REQ-014, REQ-015, REQ-018 | S01, S02 | true |
| S04 Evidence & Claims | 验证、比较和组织 Evidence，输出受约束的 Claim 与引用 | REQ-004, REQ-005, REQ-006, REQ-009, REQ-014, REQ-015, REQ-018 | S02, S03 | true |
| S05 Statistics Lab | 审批、执行、解释、导出并复现统计分析 | REQ-001, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-018 | S01 | true |
| S06 Knowledge & Library | 管理和检索 Project 的 Papers、Evidence、Notes、Tags 与 Drafts | REQ-001, REQ-009, REQ-012, REQ-015, REQ-017, REQ-018 | S01, S03, S04 | true |
| S07 Skills Center & Builder | 安全地发现、创建、测试、安装和管理全部 13 个科研 Skill | REQ-009, REQ-010, REQ-016, REQ-018 | S01, S02, S03, S04, S05, S08 | true |
| S08 Evidence-based Writing & Export | 使用 Verified Evidence 写作、翻译并导出真实引用 | REQ-006, REQ-009, REQ-012, REQ-017, REQ-018 | S04, S06 | true |

## 13. Risks and Open Questions

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| DSH 宿主缺少主导航扩展点 | 原型工作台无法实现 | High | S01 同步增加最小通用 Slot，不替换 shell |
| 右栏客户端类型不可被 out-of-tree 包消费 | Reader/Evidence 联动受阻 | High | S01/S03 提供公开 client type/export 并做 profile smoke |
| 完整矩阵扩大交付量 | 里程碑延期 | High | P0/P1 依赖顺序推进，但全部 required 才最终接受 |
| 医学 Gold Set 评审资源不足 | 语义验收阻塞 | Medium | 指定 Medical Reviewer；结构门槛不能代替语义评审 |
| Skill 指令或权限不可信 | 数据或工具越权 | High | 限制来源、显式权限、受控测试、重新审批和撤销 |
| 原型与宿主响应式规则冲突 | 视觉返工 | Medium | Spec 预先记录映射与允许差异，同次截图评审 |

Blocking Open Questions: 设计无待决产品问题。医学 reviewer 身份、正式 Gold Set 和检索指标阈值须按评估协议在正式执行前批准；未满足时 AC-R001-016 和最终 QA 保持 blocked，不能由模型或实施者自行宣布通过。

## 14. PRD Ready Check

- [x] Goals、Non-Goals、Actors、Scope、REQ、BR/INV/EDGE 和 AC 明确。
- [x] 每项矩阵 P0/P1 能力有当前 Requirement 和 Spec owner。
- [x] 每个 Requirement 和 AC 有可观察结果。
- [x] 八个 Spec Package 有独立业务结果和依赖。
- [x] UI 原型、Agent 评估、安全、兼容和平台约束明确。
- [x] 没有阻塞产品问题。
