# 存储介质：base 的 storage-domain 行必须被路由到 SQLite

- 状态：已实施
- 日期：2026-09-09
- 依据：SPEC §15.1、AGENTS.md §2.4（#13）、§2.1（#4 patch 非 deep merge）

## 问题

真实 Research 链跑通后核对存储介质，发现 med 域写进了 `~/.dsh/storages/med_*.json`，而 profile 明明配置了 SQLite。`--dump-config` 里同时存在两行：

```
- id: storage-domain        name: '@deepseek-ai/dsh-storage-domain'   config: { backend: json }
- id: med-storage-domain    name: '@deepseek-ai/dsh-storage-domain'   config: { backend: sqlite }
```

原因：`dsh-storage-domain` 的 `apply` 在自己的注入 fiber 里 `domainCtx.provide('storageDomain', facility)`，因此**第二行提供的 facility 只在该 fiber 作用域内可见**；兄弟 med 插件解析到的仍是 base 那行（JSON）。于是 `med-storage-domain` 行完全无效，且失效是静默的 —— 违反 SPEC §15.1「med 存储 = storage-domain + sqlite backend」。

## 决定

1. `bundle-medical/cordis.patch.yml` 只插入 **SQLite backend** 行（`med-storage-sqlite`），删除 `med-storage-domain` 行。行数 12 → 11。
2. profile 的用户补丁层把 **base 的 `storage-domain` 行**路由到 SQLite：

```yaml
- id: med-storage-sqlite
  config: { path: /path/to/med.sqlite }
- id: storage-domain
  config: { backend: sqlite }
```

`install-local-profile.mjs` 生成的补丁已按此改写；bundle README 的「Required profile config」同步更新。

**副作用（已接受并记录）**：`ctx.storageDomain` 是全进程一个服务，把 base 那行改成 SQLite 会让 DSH 自己的域（会话投影缓存、workspace）也走 SQLite。对新部署无影响；对已有 JSON 数据的 profile，旧数据不会迁移（换介质即换存储）。

## 放弃的方案

- **保留 `med-storage-domain` 行并让 med 插件注入一个专属服务键**：需要改九个插件的 `inject` 与 Service Definition，超出本次范围。
- **让 `dsh-storage-domain` 支持多实例共享**：属于 DSH 设计问题，不改 checkout。

## 验证

```
$ pnpm dsh --profile med-research --port 3099     # 应用新补丁后启动
$ sqlite3 读取 .med-run/med.sqlite 的表
  units, unit_globals,
  u_session_projcache_sessions, u_workspace_workspaces,
  u_med_project_med_projects, …, u_med_audit_med_audit_logs
$ 真实模型轮次（36.1K tok，2 步）：project_create name="SQLite 验证" → 回复 done
$ u_med_project_med_projects 有 1 行：SQLite 验证 | …/workspaces/sqlite-0c1d5c51
$ ~/.dsh/storages 不再出现 med_*.json
```

测试侧：`bundle-medical/tests/patch.spec.ts` 断言只插入 SQLite backend、不再插入 `dsh-storage-domain`；`medical-e2e/tests/install-profile.spec.ts` 断言生成的补丁路由 base 的 `storage-domain`。

## 已知限制

- 换介质不迁移既有 JSON 数据（med 域在换介质前只有测试数据）。
- DSH 自身的域一并迁到 SQLite，属于该 profile 的部署选择，已写入 bundle README。
