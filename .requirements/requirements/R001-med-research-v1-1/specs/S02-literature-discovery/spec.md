---
requirement: R001
spec_package: S02
spec_id: SPEC-R001-S02
title: Research Discovery
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 2.1.1
status: approved
owner: med-research
qualityProfile: agent-workflow
riskTier: P0
depends_on: [S01]
---

# Spec Package S02 — Research Discovery

## 1. Objective and Traceability

Business Outcome: 用户确认透明检索计划后，发现、筛选、排序并保存真实医学论文。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-002, REQ-R001-003, REQ-R001-009, REQ-R001-013, REQ-R001-018 | SPEC-R001-S02-001..004 | AC-R001-002, 003, 013-016 | P0 |

## 2. Scope and Architecture

In Scope: Question normalization、PICO/PECO、Keyword/MeSH expansion、editable PubMed Query、approval、ESearch/EFetch/ESummary、dedup、pagination、year/study/full-text filters、Rerank、Counter Search、Related Papers、save 和 Research UI。

Architecture: tools 只调用 `medLiterature`；Connector 负责 NCBI wire parsing/retry；domain 负责 dedup/ranking input；Project paper repository 负责保存。模型不能提供 PMID/DOI。

### 2.1 Project/Session Context (S01 owner)

S02 只消费 S01 提供的当前 Project/Session context。QueryPlan、SearchRun、Paper membership 的查询、写入与模型输入都使用该 binding；搜索工具不得自行选择、切换或重新绑定 Project。S02 不注入第二份 Project context，也不创建 `medical/project-context` 自定义 Session event。缺少 binding 返回 `PROJECT_NOT_BOUND`，跨 Project 请求返回 `SCOPE_DENIED`。到达模型的 Project context 只包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据；Dataset 行、未授权 Project 数据、秘密和完整原始文献不得进入 bundle。模型可见查询与检索工具输出通过标准 `tool/result` Session 事件记录，Session replay 依据 S01 binding 与这些结果重建相同输入。

## 3. Contract Behaviors

### SPEC-R001-S02-001 Plan and approve query

Public Seam: `literature_plan_query`、Query Plan service/Remote 和 Research view。

Given / When / Then: Given 中文或英文研究问题，When planning 完成，Then 返回 normalized question、PICO/PECO、concepts、keywords、MeSH、primary/broad queries、filters 和 warnings；用户编辑后形成版本化 approved plan。在 approved plan 存在前 `literature_search_pubmed` 拒绝且 Connector 调用为零。

### SPEC-R001-S02-002 Retrieve and normalize authentic papers

Public Seam: `literature_search_pubmed/literature_get_paper`、`medLiterature.search/get/listForProject`。

Given / When / Then: Given approved query，When 检索，Then 只从 Connector response 建立 Paper，按 PMID、DOI、规范化 title 确定性去重，保留来源、页码、总数和逐项 parse status。

Errors: timeout、rate limit、invalid response、empty 和 partial 使用不同稳定 code；重试不得重复保存或覆盖更完整元数据。

### SPEC-R001-S02-003 Filter, rerank, counter-search, and relate

Public Seam: discovery request/spec resolution 和结果 Remote。

Given / When / Then: Given 最多 100 个候选，When 应用年份、Study Type、Full Text filter 或 AI Rerank，Then 返回 filter trace、原始 rank、最终 score/reason 和最多 20 个结果；Rerank 失败保留词法顺序并显示降级。Counter Search 标记独立 query provenance；Related Papers 标记来源关系，不混入主结果。

### SPEC-R001-S02-004 Inspect and save results

Given / When / Then: Given 结果或部分失败，When 用户展开、打开来源或保存，Then 显示 title、authors、journal、date、study type、PMID/DOI、abstract/fulltext state、rank reason 和 save state；保存写入当前 Project，跨 Project 操作被拒绝。

## 4. UI Presentation Contract

`asset/搜索研究.png` 左中主区属于 S02/S04：面包屑和研究问题位于顶部；Research Conclusion 及 Evidence 状态位于首屏；证据筛选和列表占主列；宿主 composer 固定在主列底部但不遮挡列表。S02 拥有查询确认、检索进度、论文候选、筛选和保存状态；S04 拥有结论/证据分组；S03 拥有右侧来源阅读区。

结果卡采用可扫描的高密度行，不用首页的大型营销卡。Loading 显示阶段和已取得数量；partial 保留列表并在对应条目显示失败；empty 提供编辑 Query；failure 保留 approved plan 和重试。窄屏按“结论/结果 → Evidence → Reader”顺序切为 tabs/drawers。

## 5. Data, Security, and Observability

QueryPlan、SearchRun、Paper 和 Project save relation 使用 branded IDs 与版本化存储；记录 plan edits、approval、Connector request identity、pagination、filters、rank provenance 和 partial errors。缓存键包含标准化 query、filters 和 Connector version，不跨 Project 暴露保存状态。

## 6. Verification and Acceptance Mapping

- Fixtures 覆盖确认前零请求、成功、空、限流、超时、畸形 XML、partial、dedup、filter、Rerank 降级和 Counter Search。
- Eval 报告 Recall@20、Precision@20、Counter Evidence Miss Rate、dataset version 和 reviewer；未批准阈值不伪装通过。
- 浏览器覆盖 query edit/approval、结果、partial、empty、failure 和窄屏，与 `搜索研究.png` 主区并排评审。
- Acceptance: AC-R001-002, 003, 013-016。

## 7. Spec Ready Check

- [x] 所有 Research/PubMed P0/P1 功能已映射。
- [x] 来源、审批、降级、持久化和 UI 状态明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)、[评估协议](../../evaluation.md)。本包拥有 QueryPlan/SearchRun/Paper/membership 与确定性 Paper 书目格式化；S04 拥有医学结论引用编号。

QueryPlan 包含 id/revision、question、normalizedQuestion、PICO 或 PECO、concepts、keywords、meshCandidates、primaryQuery、broadQuery、filters、warnings 与 approval。MeSH planning 使用本地版本化目录，不调用外部 Connector；确认前包括 MeSH 查询在内的外部请求均为零。确认记录用户和 plan revision。编辑 query、filters 或 scope 立即清除 approval；主/宽 query 分别显示，宽检索只在用户明确选择后执行。停止 planning 不保存部分 approved plan。

search 接受 approvedPlanId/revision 与 cursor；候选按 PubMed 返回顺序最多取前 100 个唯一 Paper，AI rank 返回其中最多 20 个，禁止新造 ID。分页浏览使用同一 search run 的冻结候选及 filter trace；继续检索下一批必须显式创建并确认新计划范围，不能让翻页静默扩大网络查询。只返回被取回 metadata 的总量，PubMed total 与本地候选数分列显示。

去重依次精确 PMID、规范化 DOI（去 resolver 前缀、lowercase）、规范化 title + publication year；标识冲突保留两个记录并标识人工检查，不能仅同标题合并不同年份研究。保留全部来源别名、response hash、query/page provenance；用户可打开每一来源。

年份含起止年；Study Type 用 PubMed publication types，未知标为 unknown；Full Text 为 ANY/AVAILABLE，只在 resolver 验证上传 PDF 或合规 PMC 来源可读时算 AVAILABLE，Abstract 不算全文，未知不假装可用。filter trace 记录排除原因。AI rank 只处理题录与获准的摘要，score 越大越相关，同分按初始 rank；无效模型 ID、重复或缺 score 使整个 rank 降级为词法顺序。

Counter Search 从用户选中 Claim 生成可编辑反向 plan，遵守同一确认；S04 调用本接口，拥有验证与结论。Related Papers 使用声明的 PubMed related-link Connector，带 relationship/source/query identity；Reader 点击相关查询也显示确认，不能借 Reference Explorer 绕过网络批准。解析直接 PMID/DOI 的 metadata fetch 仅限用户已确认的文献/引用解析范围。

save/unsave 只改当前 Project membership，重复 save 幂等。Library 删除、Reader 收藏都调用本接口；旧 source/history 不删除。浏览结果用 runId/page/filter/sort 保存，失败重试只重试失败请求，不覆盖成功项与用户保存。
