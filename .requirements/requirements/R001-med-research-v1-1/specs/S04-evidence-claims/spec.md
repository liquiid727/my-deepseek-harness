---
requirement: R001
spec_package: S04
spec_id: SPEC-R001-S04
title: Evidence and Claims
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 2.1.1
status: approved
owner: med-research
qualityProfile: agent-workflow
riskTier: P0
depends_on: [S02, S03]
---

# Spec Package S04 — Evidence and Claims

## 1. Objective and Traceability

Business Outcome: 用户获得可定位、可比较的 Evidence，以及只由合格 Evidence 支持的 Claim 和引用。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-004, REQ-R001-005, REQ-R001-006, REQ-R001-009, REQ-R001-014, REQ-R001-015, REQ-R001-018 | SPEC-R001-S04-001..004 | AC-R001-006, 007, 013-016 | P0 |

## 2. Scope and Architecture

In Scope: retrieval、original text、paragraph/page/section locator、SUPPORT/AGAINST/UNCERTAIN、fulltext/abstract/secondary、location/semantic verification、Claim Gate、citation serialization、Evidence Table/Compare、Counter Evidence、Reference Chasing 和 source navigation。

Architecture: Evidence service owns records and verification transitions；domain owns normalization/alignment、state invariant、Claim Gate 和 citation serializer；UI 从 raw records 派生展示状态。

### 2.1 Project/Session Context (S01 owner)

S04 只消费 S01 提供的当前 Project/Session context。Evidence、Claim、Citation 的查询、写入与模型输入都使用该 binding；Evidence 工具不得自行绑定或切换 Project。S04 不注入第二份 Project context，也不创建 `medical/project-context` 自定义 Session event。缺少 binding 返回 `PROJECT_NOT_BOUND`，跨 Project 请求返回 `SCOPE_DENIED`。到达模型的 Project context 只包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据；Dataset 行、未授权 Project 数据、秘密和完整原始文献不得进入 bundle。验证结果继续通过业务工具结果记录；模型可见输入与输出通过标准 `tool/result` Session 事件记录，Session replay 依据 S01 binding 与这些结果重建相同输入。

## 3. Contract Behaviors

### SPEC-R001-S04-001 Retrieve, save, and locate Evidence

Public Seam: `evidence_retrieve/evidence_save/evidence_verify/evidence_list_for_claim`、`medEvidence` Remote。

Given / When / Then: Given Question/Claim 与 Paper，When retrieve/save，Then Evidence 保存 original/normalized text、Paper/Document/Paragraph、page/section/start/end、sourceType、relation、extractor version/model、prompt version 和 timestamps。Locator 先 exact match，再按配置窗口执行 normalized alignment，输出 FOUND/PARTIAL/NOT_FOUND 和理由。

### SPEC-R001-S04-002 Verify relation and gate Claims

Given / When / Then: Given located Evidence，When semantic verification，Then输出 PENDING/VERIFIED/REJECTED 与 SUPPORT/AGAINST/UNCERTAIN；NOT_FOUND 强制 REJECTED。Claim Gate 要求每个 Claim 至少一条合格 Evidence，保留反证与不确定证据；不足时只输出明确不足说明。

Citation serializer: 按 Claim 首次引用顺序生成 `[n]`，相同 Evidence 复用编号；输出表包含 citation index、Evidence ID、Paper ID、PMID/DOI 和 focus。模型提供的编号或标识符不进入最终协议。

### SPEC-R001-S04-003 Compare Evidence in a table

Given / When / Then: Given Project Evidence，When 按 Claim、relation、sourceType、locator/support status、study type 或 year 筛选，Then表格显示原文摘要、Paper、位置、状态、provenance 和 source action；compare 视图并列 SUPPORT/AGAINST/UNCERTAIN，不以数量替代质量判断。

### SPEC-R001-S04-004 Chase references and open sources

Given / When / Then: Given secondary citation，When Reference Chasing，Then通过声明 Connector 解析候选原始 Paper，记录跳转链；成功建立新的直接 Evidence，不修改原 secondary record；失败保留原 secondary record 的 location 状态并记录 chase failure；新候选无原文时标 NOT_FOUND。打开任意 Evidence 委托 S03 精确 focus。

## 4. UI Presentation Contract

`asset/搜索研究.png`：首屏结论卡显示结论文本、更新时间、总体 CONFLICTING/CONSISTENT/INSUFFICIENT 状态和 SUPPORT/AGAINST/UNCERTAIN 数量；下方 tabs 和高密度 Evidence cards 使用绿/红/灰语义色，卡片包含来源、研究类型、PMID、year、journal、locator、quote 和 citation index；选中卡驱动右侧 Reader 精确高亮。

Evidence Table 使用相同 tokens 和状态组件。Partial 保留可核验条目并逐项标错；不能把全部页面变为通用 error。窄屏按 Conclusion → filters → Evidence → source drawer 排列。

## 5. Data, Security, and Observability

Evidence/Claim/Citation IDs branded；所有验证转移持久化且可审计。模型输入、候选、版本、决策、理由、反证和最终映射可重建；不得把全文缓存或未授权 Project Evidence 暴露给模型。

## 6. Verification and Acceptance Mapping

- Gold Set 覆盖 direct support/against、abstract、secondary、wrong paragraph、quote mismatch、relation reversed、claim without evidence、conflict、normalization 和 PARTIAL。
- 阻塞指标：relocatability ≥98%、Relation Accuracy ≥0.85、Claim Support Precision ≥0.85、Unsupported Claim Rate 0；Counter Evidence Miss Rate 单独报告。
- 浏览器覆盖 conclusion、三关系筛选、Evidence Table、partial、source focus 和窄屏，与 `搜索研究.png` 并排评审。
- Acceptance: AC-R001-006, 007, 013-016。

## 7. Spec Ready Check

- [x] Evidence Engine 全部 P0/P1 功能已映射。
- [x] 状态不变量、Claim Gate、引用与 Reference Chasing 明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)、[评估协议](../../evaluation.md)。本包向 S03 Reader registry 注册 Evidence、source navigation 和 Reference Chasing 动作；不反向要求 Reader 依赖本包。

retrieve 输入 Project、Claim/question、选中 Paper/Document versions，返回候选 Evidence 与 matched anchors；save 接受共享 anchors 并重新读取原文验证，忽略客户端自报的验证结果。verify 保存独立 location 与 semantic decision、理由及验证版本；source 更新/withdraw 使依赖 Claim/Draft 失效。FOUND/PARTIAL、SECONDARY 与 UNCERTAIN 的资格按共享约定执行；PARTIAL 没有精确 matched anchors 必须降为 NOT_FOUND。

gate 输入目标命题与 Evidence IDs，输出 grounded Claim 或 insufficient；VERIFIED 不自动等于 SUPPORT。关系与命题绑定，改变 Claim 文本必须重新语义验证。结论聚合的 CONFLICTING/CONSISTENT/INSUFFICIENT、待验证计数和 citation revision 按共享约定，Table 与 Research 卡必须一致。

table/compare 返回每条 Evidence 的 Paper、quote、样本/研究设计/结局/效应（原文未报告为空）、relation、sourceType、locator/support status 和 provenance。比较使用用户选择的一组 Evidence，显示不同人群/结局/方法与双方原文；不按票数合并或生成无依据的效应量。

counter-search 委托 S02 的反向 plan/approval，验证新候选后合入同一 Claim 的反证组并保留原 run provenance。chase 输入 secondary Evidence 和 source reference，只经用户确认的 Connector 范围解析；每 hop 保存 parent/child source、状态与理由，维护 visited 标识防循环，达到已配置 maxHops 返回 CHASE_LIMIT。找到原文后新建直接 Evidence 并重新验证；追踪失败只更新 chase status，不篡改已存在 secondary quote 的 locator。

CitationMap 的每个 index 可解析到 Evidence/Paper/focus；UI 不能信任模型编号。PONV Evidence Reviewer 的风险因素、效应、质量与局限输出按内置目录，Claim Gate 与医学评估同样阻塞。
