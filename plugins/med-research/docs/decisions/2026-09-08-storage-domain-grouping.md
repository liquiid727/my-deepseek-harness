# 决策：存储域分组

- 状态：已实施（阶段 1）
- 日期：2026-09-08
- 依据：SPEC §15–§16、AGENTS.md §2.4

## 问题

SPEC §16 列出 17 张最小数据表，但只说「每个域用 `defineDomain` + zod 表 schema 声明」，没有规定这些表如何划分成 `defineDomain` 的域。域是版本与导出/导入的最小单位（SPEC §15.2），分组方式直接影响后续 schema 变更的爆炸半径。

## 决定

按**变更生命周期**分成 8 个域，每个域一个 `version`，初始为 1：

| 域 | 表 |
|---|---|
| `med_project` | `med_projects`、`med_session_project` |
| `med_literature` | `med_research_queries` |
| `med_paper` | `med_papers`、`med_paper_sources`、`med_project_papers` |
| `med_document` | `med_documents`、`med_sections`、`med_paragraphs`、`med_evidence_chunks` |
| `med_evidence` | `med_evidences`、`med_claims`、`med_claim_evidences` |
| `med_dataset` | `med_datasets`、`med_dataset_columns` |
| `med_analysis` | `med_analysis_runs`、`med_artifacts` |
| `med_audit` | `med_audit_logs` |

`med_literature` 由用户在 2026-09-08 的契约修正中确认新增，用于承载 `Claim.researchQueryId` 指向的 research query（SPEC §12、§17–§18）。

## 放弃的方案

- **单域 `med` 装全部表**：实现最省事，但任一表变更都要 bump 全局版本，且 DSH 无迁移框架，一次 bump 会让所有域数据 fail-loud 拒绝。风险与收益不匹配。
- **一表一域（17 个域）**：版本粒度最细，但链接表与主表必须跨域保持一致（例如 `med_claim_evidences` 与 `med_claims`），而 DSH 域之间没有事务；跨域一致性无法保证，反而制造出必须自证的伪边界。
- **按 FR 编号分组**：编号是需求索引，不是数据生命周期，分组会随需求改动漂移。

## 需要的验证

- 存储契约测试覆盖全部 8 个域的读写与重开（`storage.contract.spec.ts`）。
- `medExport` 的 `domains` 长度固定为 8；`medImport` 对单个域的版本不匹配 fail-loud。
