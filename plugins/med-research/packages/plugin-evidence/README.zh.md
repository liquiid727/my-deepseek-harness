# @medresearch/dsh-plugin-evidence

[English](README.md) | 中文

## 概述

证据检索、确定性定位与语义裁决落地（SPEC §24–§26）。提供 `ctx.medEvidence`，注册 `evidence_retrieve` / `evidence_save` / `evidence_verify` / `evidence_list_for_claim`。`locatorStatus` 由段落计算，模型不提供；`NOT_FOUND` 的引文永远不会变成 `VERIFIED`。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `tolerance` | `0.05` | `PARTIAL` 的最大编辑距离 / 窗口长度 |
| `windowSize` | `8` | 候选窗口长度相对引文的最大偏差 |
| `maxRetrieval` | `10` | 单次检索返回上限 |

## 模型影响

- `evidence_retrieve` 在项目文献库内返回排好序的 chunk（id + 文本）；V1 用 BM25，向量属 P1。
- `evidence_save` 返回带 `locatorStatus` 与 `supportStatus` 的证据；provenance（`extractorVersion`/`extractorModel`/`promptVersion`）必填。
- `evidence_verify` 应用模型裁决，但 `NOT_FOUND` 一律落为 `REJECTED`。
- 结果均为 JSON 文本块。

## 已知限制与后续工作

- 仅 BM25 检索；向量与 rerank 属 P1（SPEC §24）。
- 二手引用检测未自动化，`sourceType` 需调用方提供（P1）。
- SPEC §25 的 `candidate.reason` 在 §11 Evidence 模型中没有字段，因此不落库；作为待确认项上报。
- `listForClaim` 读取绑定行，绑定指向缺失证据时 fail-loud。
