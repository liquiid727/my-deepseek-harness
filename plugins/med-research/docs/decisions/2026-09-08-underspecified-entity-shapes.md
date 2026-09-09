# 决策（含待确认项）：SPEC 未定义的实体形状

- 状态：已实施（阶段 1），其中标注「待确认」的字段需要你拍板
- 日期：2026-09-08
- 依据：SPEC §7–§14、§16、§20；PRD §34、§37

## 问题

SPEC 给出了主要实体的字段，但下列形状没有定义，而阶段 1 的存储域必须能表达 §16 的全部表：

1. `Author`：SPEC §8 用 `authors: Author[]`，但没有 `Author` 定义。
2. 链接表 `med_paper_sources`、`med_project_papers`、`med_claim_evidences`：只出现在 §16 的表名清单里，没有字段。
3. `med_session_project`（§41 只说明绑定 `projectId ↔ sessionId`）与 `med_audit_logs`（§49 只列出事件种类）没有字段。
4. `Claim.researchQueryId`（§12）引用了 research query，但 §16 没有对应的 `med_research_queries` 表。
5. `ProjectOverview`（US-001 要求 Questions / Papers / Evidence / Datasets / Analyses / Charts 计数）不在 SPEC 中。

## 采取的临时形状（最小、可校验、可回退）

- `Author = { name: string; affiliation?: string; orcid?: string }`。
- `PaperSourceRecord = { paperId, source, sourceId, rawMetadata: unknown }`（SPEC §20 已给出字段，补了 `sourceId` 作为复合键的一部分）。
- `ProjectPaper = { projectId, paperId, savedAt }`。
- `ClaimEvidence = { claimId, evidenceId, role: 'support' | 'counter' }`。
- `SessionProject = { sessionId, projectId, updatedAt }`。
- `AuditLog = { id, projectId?, sessionId?, action, at, detail }`，`action` 取 §49 的事件闭集。
- `ProjectOverview = { projectId, questions, papers, evidences, datasets, analyses, charts }`（定义在 `medical-contracts`，阶段 2 实现计数）。
- `ResearchQuery = { id, projectId, question, normalizedQuestion, pico?, concepts, queries, filters, createdAt }`（用户已确认新增；存于 `med_literature` 域）。

链接表的键是复合字符串（`a|b`）；记录本身仍带两个 id，读回时可自描述。

## 待确认（需要你决定，不自行发挥）

用户在 2026-09-08 的修正答复中只勾选「新增 `med_research_queries` 表」，因此：

- **已采纳**：新增域 `med_literature` + 表 `med_research_queries`，实体 `ResearchQuery = { id, projectId, question, normalizedQuestion, pico?, concepts, queries, filters, createdAt }`；`Claim.researchQueryId` 不再是悬空引用。
- **未采纳（保持当前最小形状）**：`Author` 结构化字段、`ProjectPaper` 的 `excluded/note/relevance`、`Dataset.storageKey`、`PaperSourceRecord.retrievedAt`、`AuditLog` 动作闭集确认。这些仍是待确认项，阶段 2–5 若需要必须先回来确认。

其余仍开放的问题：

1. `Author` 是否需要结构化字段（lastName/foreName/initials/collectiveName）？当前只有 name/affiliation/orcid。
2. `Dataset.storageKey`：SPEC §35 的 Runner 需要 `datasetPath`，但 §13 的 `Dataset` 没有文件位置；阶段 5 前必须定。
3. `ProjectPaper` 是否需要 `excluded` / `note` / `relevance`（PRD §12）？
4. `AuditLog.action` 闭集是否就是 §49 的 9 种？

这些不阻塞阶段 1 的验收（存储域能表达全部实体），但会影响阶段 2–4 的实现；请确认或给出修正。

## 放弃的方案

- **把未定义实体存成 `Record<string, unknown>`**：可以绕过定义，但会让「模型可见 ⟺ 已记录」与 schema 校验同时失效。
- **为 research query 另建一张表**：§16 没列，属于自行扩表；先保留 id 字段并上报。

## 需要的验证

- 上述每个形状都有 zod schema 并被 `defineDomain` 引用；存储契约测试覆盖每张表的读写与 `medExport` 往返。
