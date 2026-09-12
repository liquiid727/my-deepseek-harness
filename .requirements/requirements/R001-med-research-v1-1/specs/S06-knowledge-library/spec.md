---
requirement: R001
spec_package: S06
spec_id: SPEC-R001-S06
title: Knowledge and Library
source_entry: ../../prd.md
source_entry_kind: prd
source_prd: ../../prd.md
source_prd_version: 2.1.0
version: 1.1.0
status: approved
owner: med-research
qualityProfile: fullstack-flow
riskTier: P0
depends_on: [S01, S03, S04]
---

# Spec Package S06 — Knowledge and Library

## 1. Objective and Traceability

Business Outcome: 用户在 Project 和个人库中组织、检索并复用 Papers、Evidence、Notes、Tags 和 Drafts。

| PRD Requirement | Behaviors | Acceptance Criteria | Risk |
|---|---|---|---|
| REQ-R001-001, REQ-R001-009, REQ-R001-012, REQ-R001-015, REQ-R001-017, REQ-R001-018 | SPEC-R001-S06-001..004 | AC-R001-008, 014, 015 | P0 |

## 2. Scope and Architecture

In Scope: Project Papers、My Papers、Uploaded Papers、Evidence Library/Groups、Project/Paper/Selection Notes、Tags、search、Project RAG、Draft inventory 和引用关系。

Architecture: 新的 Knowledge Service Definition/Provider/Consumer 组合现有 Paper/Evidence records，并拥有 Tag、Draft 和 project-index records；Note 由 S03 唯一拥有；客户端通过 `medKnowledge` Remote 投影，不扫描本地文件拼装状态。

## 3. Contract Behaviors

### SPEC-R001-S06-001 Manage Paper and Evidence libraries

Given / When / Then: Given 用户可访问的 Projects，When 打开 library，Then Project Papers 只显示当前 Project，My Papers 聚合用户 Projects 并保留 membership，Uploaded Papers 标记 upload source；Evidence 可按 Claim、Paper、relation、status 和 tag 分组。删除 membership 不删除共享 Paper source；删除最后 membership 仍需显式确认 source cleanup。

### SPEC-R001-S06-002 Create linked Notes and Tags

Public Seam: S03 Note service、S06 Tag service、tools 和 `medKnowledge` Remote。

Given / When / Then: Given Project、Paper 或 Selection，When 保存 Note，Then记录 owner scope、body、tags、Paper/Document/Paragraph/start/end 和 timestamps；手写 Project Note 可没有 Paper anchor。Tag rename 原子更新引用；删除 tag 不删除对象。

### SPEC-R001-S06-003 Search project knowledge

Given / When / Then: Given query，When 搜索 title、author、PMID、Note 或 tag，Then返回 typed results、匹配字段、Project membership 和 source action；空 query 不执行全库昂贵扫描，跨 Project 结果只有在 My Library 明确范围下出现。

### SPEC-R001-S06-004 Answer with Project RAG and manage Drafts

Given / When / Then: Given 当前 Project corpus，When 问答，Then retrieval 只索引该 Project 的 Paper text、Verified Evidence 和 Notes，返回 candidates、scores、citations 和不足状态。Draft 保存 Claim/Evidence references；引用失效时 Draft 回到 DRAFT 并阻塞 REVIEWABLE/EXPORTED。

## 4. UI Presentation Contract

Knowledge 没有独立原型，必须复用首页/Research/Reader 的 token、边框、间距、状态徽标和高密度列表，不创造第二套视觉语言。桌面使用 filter/sidebar + result list + detail；窄屏使用 filter drawer + list + detail drawer。Paper、Evidence、Note、Draft 类型必须在不依赖颜色的情况下可区分。

## 5. Data, Security, and Observability

Note、Tag、Draft、index IDs branded；所有记录含 Project scope 和版本。Project RAG 记录 corpus version、query、candidate IDs/scores 和引用，但不复制未授权全文到日志。索引可重建，不是唯一数据源。

## 6. Verification and Acceptance Mapping

- 覆盖 membership、聚合库、upload、Evidence groups、三类 Note、selection anchor、tags、search、跨 Project 隔离、RAG insufficient 和 stale Draft citation。
- 浏览器覆盖 empty/populated/search/filter/detail/partial/narrow/keyboard/zh-en，并检查与共享视觉系统一致。
- Acceptance: AC-R001-008, 014, 015。

## 7. Spec Ready Check

- [x] Knowledge/Library 矩阵全部功能已映射。
- [x] 聚合、删除、检索、RAG 和 Draft 语义明确。
- [x] 逐项覆盖、共享接口、状态与 UI 约束已复核；批准仅适用于设计，执行验收仍独立阻塞。

## 8. Executable Interface Details

规范性共用约定：[接口与状态](../../interfaces.md)、[逐项覆盖](../../coverage.md)、[UI 验收](../../ui-acceptance.md)。本包拥有 Tag 关系、索引、Draft/Revision；Note CRUD 调用 S03，Paper membership 调用 S02，Evidence Group 调用 S04。

Library list 接受 scope=currentProject/myLibrary/uploaded、kind、query、filters、cursor；默认 currentProject。My Papers/Uploaded 是用户可访问 Project 的显式聚合视图，每行显示 memberships；从聚合视图执行保存/删除必须明确目标 Project，不能自动改变当前 Project。移除最后 membership 也保留被 Note/Evidence/Draft 引用的 source；source cleanup 有引用则 SOURCE_IN_USE，确认后仅删除无引用孤立文件，历史引用不悬空。

search 支持 title/author/PMID/Note/tag，默认按相关度再更新时间/ID 排序；空 query 返回所选 scope 的分页列表，不做全文扫描。Tag 创建/重命名去首尾空白，Project 内名称大小写折叠唯一；重名返回 TAG_EXISTS，删除仅移除 Tag 和关联。Evidence 按 Claim 分组仍保持原 ID，不复制记录。

RAG 检索 corpus 为当前 Project 的 Paper 段落、Verified Evidence 与 Notes；lexical FTS 是必交检索，按候选分数与稳定 ID 排序，输出 corpusVersion、候选/得分、引用和不足原因。Note 可用于发现问题或来源，不能作为医学事实唯一支持；选中的原文候选交 S04 verify/gate 后才能产生答案。移除 membership 后新 query 不能命中旧索引；重建期间返回 INDEX_REBUILDING，不能跨 Project 或模型常识补齐。

drafts.create/get/list/saveRevision 保存 title、outline、body、事实片段映射、Claim/Evidence versions、状态与 timestamps。用户空白 Draft 可保存为 DRAFT；REVIEWABLE 只能由 S08 校验后提交。S06 提供 Draft editor action registry，S08 注册 generate/translate/validate/export，避免反向静态依赖；完整 profile 必须具备这些动作。

Dataset/Run 导航消费 S01 注册的 S05 目标，不在 Knowledge 重建统计数据；Project 目录与个人库明确可见 scope。批量操作逐项返回结果，失败项保留选中并可重试，成功项不重复写入。
