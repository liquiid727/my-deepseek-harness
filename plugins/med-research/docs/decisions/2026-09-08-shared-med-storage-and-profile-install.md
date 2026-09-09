# 共享存储句柄与 med-research profile 安装

- 状态：已实施
- 日期：2026-09-08
- 依据：SPEC §5、§15、§42；AGENTS.md §2.1、§2.4

## 问题 1：7 个插件各自打开同一套域

真实组合启动时（`dsh --profile med-research`）宿主报错：

```
failed to apply loader entry med-literature: domain 'med_project' is already open
```

`openMedStorage(facility)` 每次调用都会打开全部 8 个域；7 个业务插件在各自 `apply` 里各调用一次，且 Cordis 并发 apply，因此第二个调用在第一个尚未注册共享状态时就再次 `facility.open()`。此外每个插件各自 `ctx.effect(() => () => storage.close())`，任一插件卸载都会把存储从同伴脚下抽走。

### 决定

`openMedStorage` 改为**每 facility 单飞 + 引用计数**：

- 首个调用同步登记 `{ opening: Promise<SharedDomains>, references }`，并发调用者 `await` 同一个 promise；
- 每次调用返回**独立句柄**（自有 `closed` 标志，`close()` 幂等），表格是共享的；
- 引用归零时才真正按逆序关闭域并删除登记项；
- 打开失败时删除登记项，失败不会毒化该 facility 的后续调用。

这样每个插件仍持有自己的句柄与 `ctx.effect` 生命周期，同时只有一个真实所有者打开/释放域。JSDoc 与模块头写明了这条契约。

### 放弃的方案

- **新增 `plugin-storage` 提供 `ctx.medStorage`**：更贴近 DSH「一个资源一个 owner」的形态，但要改 7 个插件的 `inject`/`apply`、bundle 行与测试；作为后续重构候选，当前不阻塞。
- **每个插件只打开自己需要的域**：`MedStorage` 类型是整体句柄，拆分等于重做存储接口。

## 问题 2：profile 安装

`dsh plugin --profile <name> add <spec>` 只是在 profile 目录里转发 pnpm 并按 `dsh.bundle` 声明回填 `dsh.profile.bundles`。本仓库的包未发布且内部依赖用 `workspace:*`，`file:`/`link:` 直接加 bundle 无法解析其 `workspace:*` 依赖。

### 决定：`scripts/install-local-profile.mjs` 走本地 tarball

脚本做四件事：

1. `pnpm pack` 每个 workspace 包到 `.med-run/tarballs/`；`pnpm pack` 把 `workspace:*` 改写成实际版本（如 `1.1.0`）。
2. 写 profile 的 `package.json`：`@deepseek-ai/dsh-web-app@<锁版本>` + 每个 med 包的 `file:<tarball>`，`dsh.profile.bundles` = base + web-app + bundle-medical。
3. 写 profile 的 `pnpm-workspace.yaml`：`nodeLinker: hoisted`、`autoInstallPeers: false`、`allowBuilds: { koffi: false }`，以及 `overrides` 把每个 `@medresearch/*` 指向自己的 tarball（这是让 bundle 的内部依赖解析到本地 tarball 的关键）。
4. 写 profile 的 `cordis.patch.yml`（storage path/backend、workspaceRoot、NCBI tool/email、artifactRoot），并在 profile 目录跑 `pnpm install`。

`--print-only` 只打印将要写入的内容，不碰 Harness home。

### 实测证据（scratch home）

```
$ node scripts/install-local-profile.mjs --profile med-packed --home /tmp/med-dsh-home
installed profile med-packed at /tmp/med-dsh-home/profiles/med-packed
$ DSH_HOME=/tmp/med-dsh-home pnpm dsh --profile med-packed --dump-config   # 12 行全部解析
$ DSH_HOME=/tmp/med-dsh-home pnpm dsh --profile med-packed --port 3098     # 监听成功
$ curl -L "http://127.0.0.1:3098/?token=..." | grep dsh-plugin-medical-ui  # 命中 3 次
```

boot manifest 中出现 `@medresearch/dsh-plugin-medical-ui`，说明打包安装的 profile 连客户端半边也进了启动图。

### 手工符号链接（更早验证的替代路径）

1. `dsh plugin --profile med-research add @deepseek-ai/dsh-web-app@0.1.3-alpha.2`（初始化 profile；`latest` dist-tag 指向旧版 `0.0.1-rc.1`，必须显式锁版本）。
2. 在 profile 的 `node_modules/@medresearch/` 下按**包名**建符号链接指向 `packages/<dir>`（目录名与包名不同，链接名必须用包名）。
3. 其余配置同上。

两条路径都依赖"每 facility 单飞共享句柄"这一修复，否则启动即报 `already open`。

## 真实模型请求的两个前置条件（2026-09-09 实测）

首次在 med-research profile 里发起真实模型轮次时，请求在到达模型前就失败：

```
本轮运行失败  DeepSeek request extension preparation failed  REQUEST_EXTENSION
```

排查与结论：

1. **每个 bundle 行命名的 DSH 包必须装进 profile。** `@deepseek-ai/dsh-plugin-package-inventory-deepseek` 的 `prepare` 会遍历 Loader 的 active entries，并只从 profile 树的 base URL 解析包身份；解析不到就抛 `cannot resolve active package "…"`，进而让**每个**模型请求失败。实测缺失的是 `@deepseek-ai/dsh-storage-sqlite`（DSH 安装里有、profile 依赖里没有）。安装脚本现在从 `bundle-medical/cordis.patch.yml` 派生全部 `@deepseek-ai/*` 行并写入 profile 依赖。
2. **`workspaceRoot` 必须落在会话工作区内。** `project_create` 通过 `ctx.fs` 写 `<workspace>/.medresearch/project.json`，受 DSH 文件沙箱约束；workspaceRoot 在会话工作区之外时报 `FS_SANDBOX_DENIED`（工具如实失败，不伪造）。

修好这两点后的真实模型证据（med-research profile，`--port 3099`）：

```
prompt: 只调用一次 project_create 工具（name="PONV 试点"），不要执行任何其他操作，然后只回复 done
结果:   1 轮 · 2 步；1 次工具调用；回复 done；36K tok
磁盘:   .med-run/workspaces/ponv-de25ad6e/.medresearch/project.json（name = "PONV 试点"）
UI:     研究视图列出 "PONV 试点"（Remote → 浏览器）
```

## 验证证据

- `pnpm dsh --profile med-research --dump-config`：12 行全部解析，配置按用户补丁层生效。
- `pnpm dsh --profile med-research --port 3099`：插件树加载成功，`GET /` 返回 401（需 token），带 token 的 URL 可打开。
- 浏览器实测（真实服务器，无模型轮次）：
  - 会话视图 tab 出现 `对话 | 轨迹 | 研究 | 论文 | 证据 | 统计`；
  - 四个 Med 视图分别渲染 `请审阅检索式 / 尚无项目`、`论文已就绪 / 尚无论文`、`正在校验结论 / 尚无证据`、`尚无数据集 / 尚无数据集`；
  - 在输入框输入文本后切换到「研究」视图，草稿仍在（输入框可用）；
  - 设置面板出现 `Med Research` 分节；
  - FR-25：清空客户端状态后进入 hero（无活跃会话），view tab 为空、无 Med 文案，CDP `Log` + `Runtime` 零异常事件（截图 `06-no-session.png`）。
  - 截图存于 `med-research/.med-run/screenshots/`（`.med-run/` 已 gitignore）。
- tarball 安装路径：scratch home 上 `--dump-config` 解析成功、`--port 3098` 监听成功、boot manifest 含 `@medresearch/dsh-plugin-medical-ui`。
- `pnpm run typecheck`、`pnpm run test`（35 files / 200 tests）、`pnpm run verify:client` 全绿。

## 已知限制

- GIF 录制被依赖阻塞：本机缺 `ffmpeg` / `ffprobe`，`record-browser-gif` 的编码步骤无法执行；本轮以截图 + 语义快照作为浏览器可见证据。
- 打包安装仍要求目标机器能访问 npm 拉取 `@deepseek-ai/*` 依赖；`@medresearch/*` 已全部指向本地 tarball。
