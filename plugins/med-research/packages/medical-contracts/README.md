# @medresearch/dsh-medical-contracts

English | [中文](README.zh.md)

## Summary

`@medresearch/dsh-medical-contracts` is the shared vocabulary of the Med Research Workspace: branded record identifiers, every domain entity as a strict zod schema, the `med`-prefixed service definitions, and the error model. Plugins, tools, and the Web layer agree on these types; implementations live in their owning packages. The package has no DSH dependency — only `zod` — so the pure domain layer and any consumer can depend on it without importing harness internals (SPEC §2, §3).

## Scope

- `ids.ts` — branded `ProjectId`, `PaperId`, `DocumentId`, `SectionId`, `ParagraphId`, `EvidenceChunkId`, `EvidenceId`, `ClaimId`, `ResearchQueryId`, `DatasetId`, `AnalysisRunId`, `ArtifactId`, `AuditLogId`.
- `research.ts` — project, paper, source record, document, section, paragraph, chunk, evidence, claim, query plan, full-text resolution, and the session Agent Mode union (SPEC §7–§12, §17–§18, §20–§23).
- `statistics.ts` — dataset, dataset column, analysis plan, analysis run, artifact, runner input/result, and the `StatisticsRunner` seam (SPEC §13–§14, §34–§38).
- `audit.ts` — append-only audit rows (SPEC §49).
- `errors.ts` — `DomainError` and the stable code vocabulary (SPEC §46).
- `services.ts` — the nine `med` service definitions, including project mode reads and writes (SPEC §5, §30–§38).

Every entity schema is `z.strictObject`: an undeclared field is rejected at the durable boundary rather than silently stripped.

## Model Experience

### What the model sees

Nothing. This package registers no tool, prompt, or session event; it is a type and schema library. A model sees these fields only when an owning plugin projects them through a tool result or a logged session event.

### Token effect

Zero on its own.

### KV Cache effect

Independent: no request prefix is affected.

## Known Limitations and Deferred Work

- The service definitions are declared here but implemented from phase 2 onward; until then they have no provider.
- `Author`, the link-table records, `SessionProject`, `AuditLog`, and `ProjectOverview` are minimal shapes chosen because SPEC §7–§14 leave them undefined. See `docs/decisions/2026-09-08-underspecified-entity-shapes.md` for the open questions.
- There is no `med_research_queries` table although `Claim.researchQueryId` references one; reported as an open question, not silently invented.
- `package.json` currently exports `src/index.ts` (source plane). The published `lib/` build lands in phase 8 with the bundle.
