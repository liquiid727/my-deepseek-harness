# 决策：`/med-export` / `/med-import` 的用户入口

- 状态：已实施
- 日期：2026-09-09
- 依据：SPEC §15.2、FR-21；AGENTS.md §2.4、§2.1.3、§2.8.30

## 问题

SPEC §15.2 要求「必须提供 `medExport` / `medImport` 命令或工具，作为备份与迁移路径」。阶段 1 只交付了库函数 `medExport(storage)` / `medImport(storage, bundle)` 与契约测试，没有任何用户可触发的入口：真实用户既不能在 DSH 里执行备份，也不能在迁移时导入旧包。需要裁决三件事：命令还是工具、由哪个包注册、路径与失败如何呈现。

## 决定

### 1. 用人工命令，不新增工具

注册为 DSH 人工命令 `/med-export` 与 `/med-import`（`@deepseek-ai/dsh-commands`）。理由：

- SPEC §6 的工具清单是封闭的 22 个模型可调用工具；备份/恢复是用户维护动作，不是模型能力，加工具会扩大模型面并需要新增客户端卡片。
- 命令结果只进会话日志（`command/run` / `command/done`），不进入模型请求，天然满足「模型可见 ⟺ 已记录」。
- 命令名直接来自 SPEC 的 `medExport` / `medImport`，转成 DSH 命令名合法字符集内的 `med-export` / `med-import`。

### 2. 由 `plugin-project` 注册，`commands` 作为可选表面

`plugin-project` 是第一个打开共享 `MedStorage` 句柄的 med 插件，`medExport` 需要覆盖全部域的句柄，因此命令与它同处一包。命令注册沿用 `plugin-artifact` 的「可选表面」写法：`ctx.get('commands')` 存在时用 `ctx.effect(() => commands.register(...))` 注册；headless / ACP 组合没有命令注册表，此时备份路径整体缺席，而不是加载失败。`inject` 不追加 `commands`，避免让无 UI 组合无法加载项目插件。

### 3. 路径取整段输入，经 `ctx.fs` 读写

`rawInput.trim()` 就是备份文件路径，含空格的路径算一个参数（不做引号解析）。读写走 `ctx.fs.resolve` + `ctx.fs.writeText` / `ctx.fs.readText`，因此文件策略对备份文件同样生效，而不是绕过沙箱直接 `node:fs`。缺路径时返回 usage 错误，不猜默认位置（部署可变的位置不做隐藏默认值）。

### 4. 失败原样上报

命令处理器返回 `{ kind: 'error', text }`，文本是真实的失败原因（`ENOENT`、`JSON.parse` 诊断、`MedStorageError` 的域版本/表/记录错误）。导入沿用库的两阶段语义：全量校验通过后才写入，校验被拒时目标存储一条不改。

## 放弃的方案

- **新增 `med_export` / `med_import` 工具**：扩大 SPEC §6 的封闭工具清单，给模型一个破坏性的写入口，还要为它加客户端卡片；备份是用户动作，不是模型能力。
- **新建 `plugin-maintenance` 包**：SPEC §3 的包结构是既定布局，为一个命令新增包会改动结构文档与 bundle patch、安装脚本、组合测试；`plugin-project` 已经持有该句柄。
- **`scripts/med-backup.mjs` 独立 CLI**：绕过 DSH 应用启动约定（AGENTS §2.1），且用户得先知道 sqlite 路径与后端类型，等于把存储细节泄漏到用户面（SPEC §15.3）。
- **`/med-export` 不带参数、写到固定默认目录**：默认目录是部署可变选择，藏默认值违反「显式优于隐式」；缺参数直接报 usage。

## 需要的验证

- `packages/plugin-project/tests/backup.spec.ts`（7 例）：真实存储上导出→导入往返一致；含空格路径；缺路径报 usage；不可读路径、非法 JSON、域版本不匹配、未声明域各自原样上报且目标库保持为空。
- `packages/medical-e2e/tests/composition.spec.ts` → `registers the backup commands and round-trips the store through the real fs`：真实 Loader 组合（含 `@deepseek-ai/dsh-commands`）里两个命令已注册，删除记录后经真实 `ctx.fs` 导出的文件导入能恢复记录。
- `pnpm run typecheck` 与 `pnpm run test`。

## 已知限制

- 导入是「全量校验 + 逐条 put」，不是跨域事务：校验阶段失败不写任何记录，但写入阶段发生存储失败可能留下部分导入的存储。DSH 域之间没有事务，这一点写进插件 README。
- `/med-import` 覆盖同名键，不合并；没有 dry-run。
- 命令描述是英文单串（`@deepseek-ai/dsh-commands` 的描述字段没有 locale 维度），与本仓库客户端插件的 zh/en 字典约束无关。
