# @medresearch/dsh-medical-domain

[English](README.md) | 中文

## 概述

`@medresearch/dsh-medical-domain` 是 Med Research Workspace 的纯逻辑层：段落归一化、引文对齐、Evidence 状态机、论文去重与 Citation Gate。它不依赖 DSH、不做 IO，因此同一批函数可以在 host 插件、测试与（后续的）worker 进程里复用。所有随部署变化的可调参数都是入参，不是模块常量。

## 范围

| 模块 | 职责 | 规格 |
|---|---|---|
| `normalize.ts` | `normalizeParagraph` — 固定六步归一化，产出 offset 基准 | §22.3 |
| `alignment.ts` | `alignQuote` — 精确匹配 → `FOUND`，滑动窗口编辑距离 → `PARTIAL`，否则 `NOT_FOUND` | §22.3 |
| `evidence-state.ts` | `assertEvidenceStatusPair` / `applyLocatorResult` — `VERIFIED ⇒ FOUND|PARTIAL`、`NOT_FOUND ⇒ REJECTED` | §11 |
| `dedup.ts` | `paperIdentityKey` / `dedupePapers` — PMID → DOI → PMCID → normalized(title + year) | §20、FR-4 |
| `claim-gate.ts` | `verifyClaim` — SPEC §28 Citation Gate，返回稳定 reason 码 | §28、FR-12–FR-14 |

`AlignmentOptions.tolerance` 与 `.windowSize` 是必填入参；领域层不提供默认值，属主插件必须从可校验的 `Config` 解析后传入（AGENTS.md §4）。

## 模型影响

### 模型可见内容

本包不直接产生模型可见内容；函数返回机器可读结果，只有当属主插件把它放进工具结果或已记录会话事件时模型才会看到。

### Token 影响

单独存在时为零。

### KV Cache 影响

独立。

## 已知限制与后续工作

- `alignQuote` 在 `[quote.length - windowSize, quote.length + windowSize]` 长度范围内滑动，并用带界 Levenshtein 距离；段落很大且 `windowSize` 很大时开销上升，接线插件必须选择有界配置。
- `verifyClaim` 把「语义方向正确」视为存储的 `supportStatus === 'VERIFIED'`；语义判定本身属于 verifier（模型 + 人工 Gold Set，SPEC §53），不在本包范围内。
- 归一化严格按 SPEC §22.3 执行，包括把 `’` 映射为 `"`；因此用 ASCII 撇号书写的引文只有在同样归一化后才会匹配。
- `package.json` 当前导出 `src/index.ts`（source plane），发布用 `lib/` 构建随阶段 8 落地。
