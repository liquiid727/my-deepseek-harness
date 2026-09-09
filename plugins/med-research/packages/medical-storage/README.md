# @medresearch/dsh-medical-storage

English | [中文](README.zh.md)

## Summary

`@medresearch/dsh-medical-storage` is the persistence layer of the Med Research Workspace. It declares eight versioned DSH `storage-domain` domains covering the eighteen business tables (SPEC §16 plus the confirmed `med_research_queries`), opens them through `ctx.storageDomain`, and exposes typed table handles plus a backup/migration path. Tools never touch a backend: they go through the `med` services, which use these handles (SPEC §5, §15).

## Scope

- `domains.ts` — the eight `defineDomain` declarations and `medDomainByName`.
- `repository.ts` — `openMedStorage(facility)`, typed handles, and the generic `OpenedDomain` view.
- `keys.ts` — composite keys for the link tables.
- `export-import.ts` — `medExport` / `medImport` and `MedStorageError`.
- `audit.ts` — `createAuditWriter`, the only producer of `med_audit_logs` rows.

Domain grouping and its rationale: `docs/decisions/2026-09-08-storage-domain-grouping.md`. Bundle format and validation order: `docs/decisions/2026-09-08-export-import-bundle.md`. Audit scope and ordering: `docs/decisions/2026-09-09-audit-trail.md`.

## Usage

```ts
const storage = await openMedStorage(ctx.storageDomain)
await storage.projects.put(project.id, project)
const bundle = medExport(storage)
await medImport(otherStorage, bundle)
await storage.close()
```

`openMedStorage` is all-or-nothing: if any domain fails to open (for example a stored version newer than the declaration rejects with `version-mismatch`), already-opened domains are closed and the original error is rethrown unchanged.

`medImport` validates the entire bundle — envelope, domain versions, table names, and every record — before the first write, so a rejected import leaves the medium untouched.

## Audit trail

`createAuditWriter({ storage, now })` returns the one writer that appends `med_audit_logs` rows. It owns row identity (`randomUUID`) and stamps `at` from the caller's clock, so every service records the same fields:

```ts
await audit.append({ action: 'project.create', projectId: project.id, detail: { name, workspacePath } })
```

| Action | Written by |
|---|---|
| `project.create` / `project.delete` | `ProjectsService` |
| `paper.upload` | `PapersService.upload` |
| `evidence.verify` | `EvidenceService.verify` |
| `dataset.upload` | `DatasetsService.upload` |
| `statistics.approve` | `StatisticsService.generateCode` (the run becomes `approved`) |
| `code.execute` | `StatisticsService.execute` |
| `artifact.export` | `ArtifactService.export`, so a direct download route call is audited too |

Rows are append-only and never enter a model request. `detail` carries identifiers, counts, and hashes — never row-level dataset content (SPEC §47). Each append happens after the operation's own write, and the two are not transactional.

## Configuration

This package is a library in phase 1; it registers no plugin, so it owns no `Config`. The backend route (`backend` / `routes`) is configured on `@deepseek-ai/dsh-storage-domain`, and the owning plugins add their own `Config` fields when they land.

## Model Experience

### What the model sees

Nothing. The package registers no tool, prompt, or session event. `storage-domain` reads and writes never enter a request.

### Token effect

Zero.

### KV Cache effect

Independent.

## Known Limitations and Deferred Work

- Phase 1 ships the library only. The plugin that provides `ctx.medStorage` and its service wiring lands with its first consumer in phase 2; the contract test composes the real storage hub, the real SQLite backend, and the domain form directly.
- `medImport` is not atomic across records: it validates everything first, but a backend failure mid-write can still leave a partial import. There is no cross-table transaction in the domain layer, and the backend contract offers none.
- Full-text search uses SQLite FTS only from phase 3 onward; no vector index exists in V1 (SPEC §15.3).
- `package.json` exports `src/index.ts` (source plane); the published `lib/` build lands in phase 8.
- `claim.verify` is the one SPEC §49 action without a producer: the Claim Gate is a library function with no service entry point, so no claim verification is audited yet.
- Audit rows omit `sessionId`: services do not receive the DSH session, and the field stays optional in the record.
