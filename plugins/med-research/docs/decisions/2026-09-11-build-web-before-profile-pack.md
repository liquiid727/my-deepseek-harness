# Profile 安装先构建 Web 产物

- 状态：已实施
- 日期：2026-09-11
- 范围：`scripts/install-local-profile.mjs`

## 问题

profile 安装脚本会把 `apps/web` 打成 tarball，并让 profile 从这个 tarball 提供 Web shell。若安装前没有构建 `apps/web`，tarball 可能继续携带上一次构建留下的旧 `dist`，而安装和启动仍然成功，导致源码修复没有进入 profile。

## 决定

安装脚本在所有打包操作前执行仓库的 `pnpm run build:web`，再执行 Med Research 客户端构建。脚本把 `@deepseek-ai/dsh-web-frontend` 作为 profile 的本地 tarball 依赖和 override，并检查归档包含刚构建的 `dist/index.html` 及其引用的资产。打包顺序或 `files` 配置错误会在安装前失败。

## 放弃的方案

- 仅依赖调用方预先运行构建：无法保证全新 profile 与当前源码一致，且安装脚本会继续静默打包旧产物。
- 只检查 `dist` 目录存在：不能排除归档遗漏文件或携带旧的 hashed asset。

## 验收

- 组合测试断言 Web frontend tarball 同时出现在 profile 依赖和 pnpm override 中。
- 在全新的临时 `DSH_HOME` 中运行安装脚本，随后用该 profile 执行 `--dump-config`，确认安装产物可被真实 profile 解析。
