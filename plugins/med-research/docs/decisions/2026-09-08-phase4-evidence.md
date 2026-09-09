# 决策：阶段 4 —— 证据定位与语义裁决的职责边界

- 状态：已实施（阶段 4）
- 日期：2026-09-08
- 依据：SPEC §24–§28、§56；PRD §30；AGENTS.md §2.3 #10、§2.6

## 1. 检索单位是 chunk，返回 `EvidenceChunk[]`

SPEC §24 的检索对象是 chunk（§23），§25 才由模型产出候选引文。

**决定**：`MedEvidenceService.retrieve` 返回 `EvidenceChunk[]`（阶段 1 的契约原为 `Evidence[]`，已修正）。`plugin-paper` 在落库文档时按 section 生成 chunk，检索在项目文献库范围内做 BM25。

**放弃**：检索直接返回 `Evidence`（会迫使检索凭空发明 id 与 provenance）。

## 2. 语义裁决由模型给出，插件只做确定性落地

PRD §30：Agent 决策、Tool 确定性动作。§11 把「能否定位」与「是否支持」拆开。

**决定**：`evidence_verify(evidenceId, verdict)` 接收模型的语义裁决；`applyLocatorResult` 保证 `NOT_FOUND ⇒ REJECTED`，即使模型传 `VERIFIED` 也落为 `REJECTED`。`evidence_save` 只计算 `locatorStatus`，初始 `supportStatus = PENDING`。

**放弃**：`evidence_save` 直接置 `VERIFIED`（会把定位成功等同于语义支持）；插件内调用 LLM 判定（AGENTS.md §2.3 #10，路由未定）。

## 3. 二手引用暂由调用方声明

SPEC §26 的自动检测属 P1。

**决定**：`sourceType` 可由调用方显式指定为 `secondary_citation`；未指定时按文档类型推导为 `fulltext`/`abstract`。UI 标注「可能为二手引用」属阶段 7。

## 4. `candidate.reason` 没有存储位置（待确认）

SPEC §25 的候选 JSON 含 `reason`，但 §11 的 Evidence 模型没有该字段。

**决定**：不落库，工具不暴露该参数；作为待确认项上报，不自行给 §11 加字段。
