# 决策：审计日志（SPEC §49）

- 状态：已实施
- 日期：2026-09-09
- 依据：SPEC §47、§49、§50；AGENTS.md §2.4、§2.8.30

## 问题

SPEC §49 要求对 project create / delete、paper upload、evidence verify、claim verify、dataset upload、statistics approval、code execute、artifact export 留审计。`med_audit_logs` 表、`auditLogSchema`、`auditActionSchema` 从阶段 1 就存在，但没有任何代码写入：审计域是空表。需要裁决四件事：写入器放哪、服务如何拿到它、写在哪一层、以及没有服务入口的动作（claim verify）怎么办。

## 决定

### 1. 写入器属于存储层，行标识由它自己生成

新增 `medical-storage/src/audit.ts`：

```ts
export interface AuditEntry { action: AuditAction; projectId?: ProjectId; sessionId?: string; detail?: Record<string, unknown> }
export interface AuditWriter { append(entry: AuditEntry): Promise<AuditLog> }
export function createAuditWriter(options: { storage: MedStorage; now: () => string }): AuditWriter
```

`append` 用 `randomUUID()` 生成行 id，用调用方的 `now()` 打时间戳。行标识归审计域自己所有，而不是由每个服务各自注入——这样 6 个服务写出的记录字段完全一致，也不需要在每个服务上再加一个 id 工厂依赖。

### 2. 服务在构造时从已有依赖建写入器，不改服务选项

每个服务已经有 `storage` 与 `now`，因此构造器里直接 `this.audit = createAuditWriter({ storage, now })`。服务选项与既有测试夹具一行都不用改；审计表就在同一个共享存储句柄里，测试可以直接读 `storage.auditLogs` 断言。

### 3. 在服务层写，不在工具层写

`ctx.on('tools/post-execute')` 之类只能看到模型工具，覆盖不到 `project.delete`、`paper.upload`、`dataset.upload`、`statistics.approve` 这些没有工具名的动作（PRD §34 的 P0 工具清单里没有它们），而且工具参数与领域动作不是一一对应。服务层是动作真正发生的地方，也是唯一能覆盖全部动作的一层。

动作映射：

| SPEC §49 事件 | 写入点 |
|---|---|
| project create / delete | `ProjectsService.create` / `delete` |
| paper upload | `PapersService.upload` |
| evidence verify | `EvidenceService.verify` |
| dataset upload | `DatasetsService.upload` |
| statistics approval | `StatisticsService.generateCode`（run 转为 `approved`） |
| code execute | `StatisticsService.execute`（终态落库之后、artifact 注册之前） |
| artifact export | `ArtifactService.export`（工具与下载路由共用） |

### 4. 追加在业务写入之后，失败外显，不做事务

每次 `append` 都在该操作自己的写入之后；追加失败会原样抛出，不吞错（AGENTS §2.8.30）。域之间没有事务，因此「业务已写、审计未写」这种状态可能出现，README 与本节都如实写明。反过来把审计写在前面会让失败动作留下假记录，更糟。

### 5. `claim.verify` 暂不写，并在文档里标明

Claim Gate 是 `medical-domain` 的纯函数，没有任何服务入口（SPEC §6 没有对应工具，SPEC §27–§29 未定义调用路径，见 HANDOFF 的待决项）。没有调用点就没有审计点；这条记录在 `medical-storage/README` 的已知限制里，而不是假装已覆盖。

## 放弃的方案

- **给每个服务加 `audit: AuditWriter` 必填选项**：诚实但会把 6 个服务、约 10 个测试夹具全部改一遍，收益只是把 `createAuditWriter` 的构造点从服务内挪到插件里；服务已经持有 `storage` 与 `now`，没有额外信息。
- **在工具管线里集中写**：覆盖不到无工具名的动作，且需要从工具参数猜领域动作。
- **审计写入静默失败**：违反失败诚实性；审计是合规与复现依据，不能悄悄丢。
- **把审计做成新插件**：SPEC §3 的包结构是既定布局，为一个写表动作新增包会牵动 bundle patch、安装脚本与组合测试。

## 需要的验证

- `medical-storage/tests/audit.spec.ts`（4 例）：单行字段与时钟、`projectId`/`sessionId` 缺省、`detail` 缺省为空对象、多行 id 唯一且只追加。
- `medical-e2e/tests/research-chain.spec.ts`：真实链路上 `project.create` → `evidence.verify` 各一行且 `projectId`/`at` 正确。
- `medical-e2e/tests/statistics-chain.spec.ts`：`dataset.upload` → `statistics.approve` → `code.execute` → `artifact.export` 四行按序，`dataset.upload` 的 detail 只含标识与计数。
- `plugin-project/tests/service.spec.ts`：删除项目后审计序列为 `project.create`、`project.delete`。
- `plugin-paper/tests/pdfjs.spec.ts`：上传留痕且 detail 只带 `paperId`/`filename`，不带正文。
- `plugin-project/tests/backup.spec.ts`、`medical-e2e/tests/composition.spec.ts`：审计行随备份包一起导出/导入（往返记录数从 1 变 2）。
- `pnpm run typecheck` 与 `pnpm run test`。

## 已知限制

- `sessionId` 不写：服务拿不到 DSH 会话，字段保持可选。
- 审计追加与业务写入不是事务；追加失败会让调用方看到错误，但业务记录可能已经落库。
- `claim.verify` 没有写入点，直到 Claim Gate 有服务入口。
