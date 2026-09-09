# @medresearch/dsh-medical-storage

[English](README.md) | 中文

## 概述

`@medresearch/dsh-medical-storage` 是 Med Research Workspace 的持久化层。它声明 8 个带版本的 DSH `storage-domain` 域，覆盖 18 张业务表（SPEC §16 加上已确认的 `med_research_queries`）；通过 `ctx.storageDomain` 打开这些域，对外提供类型化表句柄与备份/迁移路径。工具不直接接触 backend，一律经 `med` 服务使用这些句柄（SPEC §5、§15）。

## 范围

- `domains.ts` — 8 个 `defineDomain` 声明与 `medDomainByName`。
- `repository.ts` — `openMedStorage(facility)`、类型化句柄与通用 `OpenedDomain` 视图。
- `keys.ts` — 链接表的复合键。
- `export-import.ts` — `medExport` / `medImport` 与 `MedStorageError`。
- `audit.ts` — `createAuditWriter`，`med_audit_logs` 行的唯一生产者。

域分组理由见 `docs/decisions/2026-09-08-storage-domain-grouping.md`；包格式与校验顺序见 `docs/decisions/2026-09-08-export-import-bundle.md`；审计范围与写入顺序见 `docs/decisions/2026-09-09-audit-trail.md`。

## 用法

```ts
const storage = await openMedStorage(ctx.storageDomain)
await storage.projects.put(project.id, project)
const bundle = medExport(storage)
await medImport(otherStorage, bundle)
await storage.close()
```

`openMedStorage` 是全有或全无：任一个域打不开（例如介质版本高于声明版本，抛 `version-mismatch`），已打开的域会被关闭，原始错误原样重抛。

`medImport` 在写入第一条记录之前校验整个包——信封、域版本、表名、每条记录；被拒绝的导入不会改动介质。

## 审计日志

`createAuditWriter({ storage, now })` 返回唯一的写入器，向 `med_audit_logs` 追加行。它自己负责行标识（`randomUUID`），`at` 取自调用方的时钟，因此每个服务写入的字段一致：

```ts
await audit.append({ action: 'project.create', projectId: project.id, detail: { name, workspacePath } })
```

| 动作 | 写入方 |
|---|---|
| `project.create` / `project.delete` | `ProjectsService` |
| `paper.upload` | `PapersService.upload` |
| `evidence.verify` | `EvidenceService.verify` |
| `dataset.upload` | `DatasetsService.upload` |
| `statistics.approve` | `StatisticsService.generateCode`（run 变为 `approved`） |
| `code.execute` | `StatisticsService.execute` |
| `artifact.export` | `ArtifactService.export`，因此直接走下载路由也会留痕 |

行只追加，永不进入模型请求。`detail` 只带标识、计数与哈希，绝不带数据集行级内容（SPEC §47）。每次追加都在该操作自身写入之后发生，两者不是事务关系。

## 配置

阶段 1 本包是库，不注册插件，因此没有自己的 `Config`。backend 路由（`backend` / `routes`）配置在 `@deepseek-ai/dsh-storage-domain` 上；属主插件落地时再各自增加 `Config` 字段。

## 模型影响

本包不注册工具、提示词或会话事件，`storage-domain` 的读写不进入请求，因此对模型零可见、零 token、对 KV cache 无影响。

## 已知限制与后续工作

- 阶段 1 只交付库；提供 `ctx.medStorage` 与插件接线的部分随阶段 2 的首个消费方落地。契约测试直接组合真实 storage hub、真实 SQLite backend 与 domain form。
- `medImport` 不是跨记录原子：它先做全量校验，但写入过程中 backend 失败仍可能留下部分数据；域层没有跨表事务，backend 契约也不提供。
- 全文检索自阶段 3 起才使用 SQLite FTS；V1 没有向量索引（SPEC §15.3）。
- `package.json` 当前导出 `src/index.ts`（source plane），发布用 `lib/` 构建随阶段 8 落地。
- `claim.verify` 是 SPEC §49 里唯一还没有写入方的动作：Claim Gate 是库函数，没有服务入口，因此 claim 校验目前不留痕。
- 审计行不写 `sessionId`：服务拿不到 DSH 会话，该字段在记录里保持可选。
