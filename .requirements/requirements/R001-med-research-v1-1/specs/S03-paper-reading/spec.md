---
requirement: R001
spec_package: S03
spec_id: SPEC-R001-S03
title: Paper Reader
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 2.1.1
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: [S01, S02]
---

# Spec Package S03 — Paper Reader

## 1. Objective and Traceability

Business Outcome: 用户阅读真实论文来源，并把翻译、总结、问答、标注、Note 和 Evidence 保持在精确原文上下文中。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-004, REQ-R001-009, REQ-R001-012, REQ-R001-014, REQ-R001-015, REQ-R001-018 | SPEC-R001-S03-001..004 | AC-R001-004, 005, 013-016 | P0 |

## 2. Scope and Architecture

In Scope: Abstract、上传 PDF、PMC XML、Document/Section/Paragraph、page data、原文/翻译/双语、目录、zoom、AI summary、selection toolbar、Highlight、Note、Evidence、Ask AI、Citation、Reference Explorer 和 Related Papers。

Architecture: resolver 选择真实 source；parser 建立不可变 source document；派生服务保存 translation/summary/annotation provenance，并拥有 Project/Paper/Selection Notes；Reader 通过 `conversation.view` 和公开的 `sidebar.right.pane.tab` client face 渲染同一数据。

### 2.1 Project/Session Context (S01 owner)

S03 只消费 S01 提供的当前 Project/Session context。Reader action 的 Project/Session 输入、Document、Note、Annotation 与派生结果的查询和写入都使用该 binding；Reader 不复制 Project context，也不跨 Project 读取文档或 Note。S03 不自行绑定、选择或切换 Project，也不创建 `medical/project-context` 自定义 Session event。缺少 binding 返回 `PROJECT_NOT_BOUND`，跨 Project 请求返回 `SCOPE_DENIED`。到达模型的 Project context 只包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据；Dataset 行、未授权 Project 数据、秘密和完整原始文献不得进入 bundle。模型可见 Reader 输入与工具输出通过标准 `tool/result` Session 事件记录，Session replay 依据 S01 binding 与这些结果重建相同输入。

## 3. Contract Behaviors

### SPEC-R001-S03-001 Resolve and represent source truth

Public Seam: `paper_get/paper_get_document/paper_resolve_fulltext/paper_search_content`、`medPapers` Remote。

Given / When / Then: Given Paper，When resolve，Then 按上传 PDF、合规 PMC XML、Abstract 的可用性返回 sourceType、parseStatus、ordered sections、paragraphs、normalized text、page/section anchors 和 source URL；失败或 abstract-only 不创建模拟全文。

### SPEC-R001-S03-002 Render reading modes and AI summary

Given / When / Then: Given source document，When 选择原文、翻译或双语，Then 原文列保持不可变，翻译按 paragraph 对齐并显示状态；全文/章节摘要输出 Research Question、Study Design、Population、Sample Size、Intervention/Exposure、Comparator、Outcome、Methods、Statistics、Key Results、Effect Size、Conclusion、Limitations、Bias、Project Relevance 和值得追踪的 Reference。

Errors: 派生调用失败只影响对应块；原文仍可读。每个派生结果记录 model、prompt version、document version 和 paragraph inputs。

### SPEC-R001-S03-003 Act on exact selections

Given / When / Then: Given 非空原文选区，When 用户选择翻译、术语解释、简单解释、问 AI、Note、Highlight、Evidence、Copy 或 Citation，Then 请求携带 Paper/Document/Paragraph/start/end 和 original text；成功对象保存相同 anchor，取消/失败不写入。

Selection toolbar: 定位在选区附近且不遮挡文本；键盘选区可以打开相同操作；翻译、解释和问答显示在右栏；Note/Evidence 成功显示可撤销确认。

### SPEC-R001-S03-004 Open citation and explore references

Given / When / Then: Given encoded focus，When 打开来源，Then Reader 加载对应 Paper/Document，滚动并高亮精确 normalized span；stale anchor 显示失败且不近似到错误段落。Reference Explorer 提供来源 reference list；S02/S04 通过 Reader action registry 贡献查询与追踪动作，保持来源和 secondary 状态。

## 4. UI Presentation Contract

`asset/论文阅读器.png`：顶区显示 breadcrumb、title、study type、citation、DOI 和动作；左列为固定章节目录；中列为 reading modes、zoom 和正文；右列为 AI 阅读助手、Notes、引用与 Evidence。正文采用阅读型字体和可控行宽，工具区使用 DSH UI 字体。

`asset/搜索研究.png` 的右栏是紧凑 Reader：顶部 tab/action、Paper metadata、摘要/全文/图表/相关文献、章节目录和高亮正文。它与完整 Reader 使用同一 Document/selection 组件和 focus，不建立第二份状态。

窄屏按 metadata → content → assistant 顺序切为 tabs/drawers；目录可收起；选区工具条在 viewport 内换行；右栏关闭后焦点回到触发元素。

## 5. Data, Security, and Observability

Document、Paragraph、Annotation、Note 和派生结果使用 branded IDs；source bytes/text 与派生内容分开存储。PDF/XML 是不可信输入，限制大小和解析资源；错误不回显本地绝对路径。模型只收到用户选择或明确请求范围内的段落；显式全文摘要/翻译可发送该 Document 全部段落，不因打开 Reader 自动发送全文。

## 6. Verification and Acceptance Mapping

- 覆盖 Abstract/PDF/PMC、parse failure、section/page anchors、三种阅读模式、每个 selection action、取消/失败、stale focus 和 right-pane 生命周期。
- 浏览器在完整 Reader 与 Research 右栏生成桌面/窄屏截图，检查选择、toolbar、滚动、高亮、焦点、长标题和中英文。
- Acceptance: AC-R001-004, 005, 013-016。

## 7. Spec Ready Check

- [x] Reader、AI Reading 和全部选区功能已映射。
- [x] 原文所有权、派生 provenance 和 right-pane 行为明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)、[内置 Skill](../../builtin-skills.md)。本包拥有 Document、Note 与 Annotation；S06 只聚合这些记录，不另建 Note 存储。

resolve 输入 PaperId 与可选 sourceDocumentId，默认顺序为用户选定源、上传 PDF、合法 PMC XML、Abstract。每个源保留独立 Document identity；没有 OCR 的扫描 PDF 返回 TEXT_UNAVAILABLE，仍可看原始 PDF 但禁用依赖文本选区的动作并说明原因。XML 外部实体与网络解析关闭；PDF/XML 失败不得回退成伪全文。多份上传须可选择，失败原文仍能下载或查看来源状态。

summary 接受 documentVersion、scope=whole/section 与 mode=oneSentence/threeMinute/structured；三分钟版按 Research Question、Design/Population、Results、Limitations、Project Relevance 排列，结构化版包含正文列出的全部字段。缺失字段写“未报告”；效应值必须有原文 anchor。Supporting/Counter Evidence 使用 S04 注册的验证动作，摘要本身不能直接把候选置 VERIFIED。

ask 接受 question 与 scope=selection/document；selection 只检索选区，document 在用户明确选择后检索该文档段落，结果逐事实附原文定位；不足时回答资料不足。医学 Claim 最终发布经 S04 action，只有来源摘录/未验证派生预览可在 S03 单独运行；完整 V1 集成必须装载 S04。

notes.create/update/delete/get/list 覆盖 Project/Paper/Selection 三种 scope；保存内容与原文 anchor 分开，手工改 Note 不修改 anchor。annotations.create/delete/list 拥有高亮颜色与原文范围。工具条取消不写入；Note/Highlight 保存后提供撤销，Evidence 撤销由 S04 contribution 处理；撤销与版本冲突返回明确状态。

focus 接受共享 SourceAnchor 或有序 anchors；加载准确版本并高亮匹配区间，打开 right pane 后把键盘焦点置标题，关闭恢复原触发控件。源损坏返回 STALE_ANCHOR，S04/S06 收到源失效通知。Reader 提供 action registry 的输入为 Project/Session、anchor、selectionText、Paper metadata 和可取消请求；返回 action status/result reference，注册返回 disposer。

Reference Explorer 展示来源 reference list 与可解析 DOI/PMID；无 ID 的参考文献保留原文且标 unresolved，不能由模型补 ID。S02 注册 Related 查询动作，S04 注册 chase/direct Evidence 操作。下载、复制、zoom、目录、全屏/折叠与助手 tabs 的具体交互按 UI 验收文档。

本包还拥有 Critical Appraisal、Thoracic Paper Extractor、Clinical Guideline Reader 的结构化派生接口：按内置 Skill 目录返回字段、缺失状态与 anchors；S04 负责证据验证，S07 负责装载定义与语义流程联通。
