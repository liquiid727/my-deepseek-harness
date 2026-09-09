# 决策：`medExport` / `medImport` 的包格式与校验顺序

- 状态：已实施（阶段 1）
- 日期：2026-09-08
- 依据：SPEC §15.2、FR-21；AGENTS.md §2.4

## 问题

DSH 存储没有迁移框架，版本不匹配必须 fail-loud。SPEC 要求提供 `medExport` / `medImport` 作为备份与迁移路径，但没有规定包格式，也没有说明导入到一半失败时应该留下什么。

## 决定

包格式：

```ts
interface MedExportBundle {
  format: 'medresearch.export'
  formatVersion: 1              // 信封版本，与域版本无关
  exportedAt: string
  domains: Array<{ name: string; version: number; tables: Record<string, Record<string, unknown>> }>
}
```

导入分两阶段：

1. **全量校验**：信封 `format` / `formatVersion` → 域是否存在（`DOMAIN_NOT_FOUND`）→ 域版本是否等于声明版本（`DOMAIN_VERSION_MISMATCH`）→ 表是否声明（`TABLE_NOT_FOUND`）→ 每条记录是否通过该表 zod schema（`RECORD_INVALID`）。
2. **写入**：只有第一阶段全部通过后才逐条 `put`。

即「校验失败 → 一条都不写」。域版本不匹配沿用 DSH 的失败语义：不降级、不兼容、不尝试迁移。

## 放弃的方案

- **边校验边写入**：中途失败会留下半份数据，而备份/迁移场景下调用者无法判断哪些已写入；DSH 域之间没有事务，回滚不了。
- **`compatibleVersions` 静默接受旧版本**：SPEC §15.2 要求 fail-loud；自动兼容会把「需要人工迁移」的问题掩盖成「看起来能读」。
- **复用 DSH 后端文件格式直接复制 SQLite 文件**：那是物理布局，跨 backend（JSON/SQLite）不可移植，也无法在导入前做 schema 校验。

## 需要的验证

- `storage.contract.spec.ts`：跨空库的 `medExport → medImport` 往返一致；域版本不匹配、信封非法、域不存在、表不存在、记录非法各自 fail-loud 且目标库保持为空。
- `openMedStorage` 在存储介质版本高于声明版本时原样抛 `StorageError: version-mismatch`。
