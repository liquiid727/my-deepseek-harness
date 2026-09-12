# @medresearch/dsh-medical-contracts

[English](README.md) | 中文

## 概述

`@medresearch/dsh-medical-contracts` 是 Med Research Workspace 的共享词汇表：品牌化记录 id、每个领域实体的严格 zod schema、`med` 前缀的服务定义与错误模型。插件、工具与 Web 层共用这些类型，实现放在各自的属主包里。本包不依赖 DSH，只依赖 `zod`，因此纯领域层与任何消费方都能在不 import Harness 内部实现的前提下依赖它（SPEC §2、§3）。

## 范围

- `ids.ts` — 品牌化 id（Project / Paper / Document / Section / Paragraph / EvidenceChunk / Evidence / Claim / ResearchQuery / Dataset / AnalysisRun / Artifact / AuditLog）。
- `research.ts` — Project、Paper、来源记录、Document、Section、Paragraph、Chunk、Evidence、Claim、QueryPlan、FulltextResolution，以及会话 Agent Mode 联合类型（SPEC §7–§12、§17–§18、§20–§23）。
- `statistics.ts` — Dataset、DatasetColumn、AnalysisPlan、AnalysisRun、Artifact、Runner 输入/输出，以及 `StatisticsRunner` 能力接缝（SPEC §13–§14、§34–§38）。
- `audit.ts` — 追加式审计行（SPEC §49）。
- `errors.ts` — `DomainError` 与稳定错误码表（SPEC §46）。
- `services.ts` — 九个 `med` 服务定义，含项目模式读写（SPEC §5、§30–§38）。

所有实体 schema 都是 `z.strictObject`：未声明字段在持久化边界被拒绝，而不是被静默丢弃。

## 模型影响

### 模型可见内容

本包不注册工具、提示词或会话事件。模型只有在属主插件通过工具结果或已记录会话事件投影这些字段时才会看到它们。

### Token 影响

单独存在时为零。

### KV Cache 影响

不影响请求前缀。

## 已知限制与后续工作

- 服务定义在本阶段只声明、无 provider，阶段 2 起逐个落地。
- `Author`、链接表记录、`SessionProject`、`AuditLog`、`ProjectOverview` 是 SPEC §7–§14 未定义时的最小形状，见 `docs/decisions/2026-09-08-underspecified-entity-shapes.md` 的待确认项。
- `Claim.researchQueryId` 指向的 research query 在 §16 没有对应表；作为待确认项上报，不自行扩表。
- `package.json` 当前导出 `src/index.ts`（source plane），发布用 `lib/` 构建随阶段 8 的 bundle 落地。
