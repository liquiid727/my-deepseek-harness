---
requirement: R001
spec_package: S08
spec_id: SPEC-R001-S08
title: Evidence-based Writing and Export
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 1.1.1
status: approved
owner: med-research
qualityProfile: agent-workflow
riskTier: P1
depends_on: [S04, S06]
---

# Spec Package S08 — Evidence-based Writing and Export

## 1. Objective and Traceability

Business Outcome: 用户使用 Verified Evidence 辅助综述和学术翻译，并导出来自真实 Paper 元数据的引用。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-006, REQ-R001-009, REQ-R001-012, REQ-R001-017, REQ-R001-018 | SPEC-R001-S08-001..003 | AC-R001-008, 012, 014-016 | P1 |

## 2. Scope and Architecture

In Scope: Literature Review Draft、academic zh/en translation、Claim/Evidence citations、unresolved citation state、RIS/BibTeX/Markdown export 和 Draft provenance。

Architecture: Writing service consumes S04 verified Claim/Evidence and S06 Draft/Paper membership；citation export is deterministic code over Paper metadata；模型只生成 Draft/translation content，不生成 source identifiers。

### 2.1 Project/Session Context (S01 owner)

S08 只消费 S01 提供的当前 Project/Session context。Draft、Revision、generate、validate 与 export 涉及的 Project 输入都必须属于该 binding；translate 对 Project Draft/Revision 使用该 binding，纯用户文本沿用既有无来源翻译规则。S08 不自行绑定 Project，不注入第二份 Project context，也不创建 `medical/project-context` 自定义 Session event。缺少 binding 返回 `PROJECT_NOT_BOUND`，跨 Project 请求返回 `SCOPE_DENIED`；显式跨 Project 操作必须经过已有 scope 与授权规则并明确目标范围。到达模型的 Project context 只包含当前 Project 允许暴露的摘要、PICO/PECO、Overview 和授权元数据；Dataset 行、未授权 Project 数据、秘密和完整原始文献不得进入 bundle。模型可见写作工具输出通过标准 `tool/result` Session 事件记录，Session replay 依据 S01 binding 与这些结果重建相同写作输入。

## 3. Contract Behaviors

### SPEC-R001-S08-001 Draft from verified evidence

Public Seam: writing Skill/service/Remote 和 Draft editor。

Given / When / Then: Given selected Claims/Evidence，When生成 Literature Review，Then每个医学事实携带 internal Evidence references，引用编号由 S04 serializer 提供；无支持、失效或冲突证据显示明确 placeholder/status，不生成确定性陈述。用户编辑涉及事实时保留引用供重新验证，验证完成前转 DRAFT；解除引用后的事实不能保持合格状态。

### SPEC-R001-S08-002 Translate academic text without changing citations

Given / When / Then: Given Draft/text 与方向，When翻译，Then保持标题、段落、表格标记、数字、统计符号和 citation identities；原文和译文并存。无法对齐的段落标错，不覆盖已有译文版本。

### SPEC-R001-S08-003 Export citations and Drafts

Public Seam: citation/export tool、Artifact service 和 authenticated exact route。

Given / When / Then: Given saved Papers，When导出 RIS/BibTeX/Markdown，Then字段只来自保存的 author/title/journal/date/PMID/PMCID/DOI/source URL；缺字段按格式规则省略并报告，不由模型填补。Draft export 在任何 unresolved citation 存在时阻塞完成版，但允许标明 incomplete 的预览。

## 4. UI Presentation Contract

Writing 没有独立原型，复用 Knowledge 的 list/detail/editor 布局、Reader 的双语呈现和 Evidence 的状态/引用组件。桌面显示 Draft outline/editor 和 citation inspector；窄屏切为 Outline/Editor/Citations tabs。Verified、conflicting、missing 和 secondary 状态必须在正文和 inspector 同步可见。

## 5. Data, Security, and Observability

Draft/Revision/Export IDs branded；保存 source Claim/Evidence versions、model/prompt version、用户编辑和 export format。生成输入限于用户选择的 Project 内容；Artifact 下载验证 Project scope。不得在日志复制完整 Draft 或受限 Paper text。

## 6. Verification and Acceptance Mapping

- 覆盖 supported/conflicting/missing Evidence、citation stability、user edits、双语数字/引用保持、缺失元数据和三种导出格式。
- Gold Set 验证 Unsupported Claim Rate 0，并由医学 reviewer 检查 sampled Draft；模型自评不能接受。
- 浏览器覆盖 editor、citation inspector、translation、incomplete preview、export 和窄屏。
- Acceptance: AC-R001-008, 012, 014-016。

## 7. Spec Ready Check

- [x] Writing 与 citation export 功能已映射。
- [x] Claim/Evidence、翻译和导出所有权明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)、[评估协议](../../evaluation.md)。S06 拥有 Draft/Revision 存储，本包注册写作/翻译/导出动作并提供验证服务。

generate 输入由 S01 当前 binding 确定的 Project、selected Claim/Evidence versions、outline、language；只对选中且仍属于该 Project 的资料工作。输出医学事实片段、对应 internal references、可编辑正文和不足/冲突标记；不足标记是有明确原因的业务结果，不允许用它代替全部正例的生成能力。

validate 重新验证用户编辑涉及的事实与引用；编辑改变事实、删除或解除引用后立即转 DRAFT，禁用完成导出，不能以隐藏旧引用保持支持。冲突不禁止讨论，但每一侧陈述需合格 Evidence，并显式保留限制。纯标题/格式编辑保留事实验证，新的 citation map 按当前正文顺序由 S04 生成。

translate 输入 source revision 或用户文本、source/target language；按段落与表格单元保留对应关系，统计数字、单位、符号和引用 token 做确定性比对，差异标 TRANSLATION_MISMATCH；原文/既有译文不覆盖，用户修正后重新验证。无来源自由文本允许翻译但不能伪装已验证的医学 Draft，后续作为完成 Draft 仍需事实验证。

export 接受当前 binding 的 Project、Draft revision 或明确 Paper IDs、format=ris/bibtex/markdown、mode=complete/preview；complete Draft 要求 REVIEWABLE 且引用仍可解析，导出时并发失效返回 CITATION_STALE 且不发布文件。preview 明确标 incomplete 并保留缺失原因。单独书目导出不要求 Claim，但只能使用真实 metadata，且 Paper IDs 必须通过当前 Project scope/授权规则。

RIS 用 TY/AU/TI/JO/PY/DO/UR/ER，BibTeX 用 article 条目及 author/title/journal/year/doi/url，key 由稳定 Paper ID 派生；缺 author/year 省略并在 warnings 记录，缺 title 返回 METADATA_INCOMPLETE。Markdown 输出当前 citation index、题录及来源链接。UTF-8 编码，按所选顺序去重 Paper，正确转义换行、花括号与 Markdown 字符；不通过模型补元数据。Artifact identity 含 exportId/format/revision/hash，下载鉴权，不接受任意路径。

AC-R001-012 主责；与 S06 共同覆盖 AC-R001-008 的 Draft 创建/失效，AC-R001-016 包含两个 Writing Skill 的医学事实与翻译验收。
