# 构建与测试（基于 dsh 0.1.1-rc.2 + Node 22 实战）

## 目录
- [前置：Node 22 与宿主依赖](#前置node-22-与宿主依赖)
- [双端打包（tsdown）](#双端打包tsdown)
- [浏览器产物包装（ModuleLoader）](#浏览器产物包装moduleloader)
- [产物自检（三大硬约束）](#产物自检三大硬约束)
- [build.ps1 干了什么](#buildps1-干了什么)
- [测试金字塔](#测试金字塔)

## 前置：Node 22 与宿主依赖

**第一个坑：dsh 0.1.x 必须 Node 22+。** 它用到了 `Promise.withResolvers`、`node:zlib` 的 zstd 解压、`node:module` 的 `stripTypeScriptTypes`，Node 20 直接崩。验证：`node -v` 必须 ≥ 22。

**宿主依赖从哪来？** 不需要 dsh 源码 checkout。dsh 发布包（`npm i -g @deepseek-ai/dsh` 或 `npx @deepseek-ai/dsh`）的 `node_modules` 里就带全了 `@deepseek-ai/cordis`、`dsh-tools`、`dsh-skill` 等。用 **junction（Windows 目录联接）** 把它们链进插件的 `node_modules`，保证与运行的 dsh 完全同版本。

```bash
python scripts/link_deps.py   # 按需改缓存路径（scripts/link_deps.py 内有说明）
```

> 重要：`npm install` 会清掉 junction 链接，所以 **link_deps 必须放在 npm install 之后**（build.ps1 已按此顺序编排）。

## 双端打包（tsdown）

**第二个坑：tsdown 0.22+ 也要 Node 22**；Node 20 环境请降级到 `tsdown@^0.19`。真实配置（见 skeleton `tsdown.config.ts`）：

- **Node 端**：`src/index.ts` → `lib/index.js`（ESM + `.d.ts`），`deps.neverBundle` 里放 `@deepseek-ai/schemastery` 与 `@deepseek-ai/cordis`（schemastery 必须让 Loader 看到自己的实例来校验 `Config` schema）。
- **浏览器端**：`src/client/index.tsx` → `lib/client.js`（CJS 单文件），`format: 'cjs'` + `platform: 'browser'`，platform 模块表 externals（`react`、`@deepseek-ai/dsh-client-*` 等），`inlineDynamicImports: true`。

```ts
// tsdown.config.ts（要点）
export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024',
    dts: true, clean: true,
    deps: { neverBundle: ['@deepseek-ai/schemastery', '@deepseek-ai/cordis'] },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib', format: 'cjs', platform: 'browser',
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: `window.__ModuleLoader__.load({ id: "<插件id>", factory: (require) => {`,
      footer: `return module.exports; } });`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
```

## 浏览器产物包装（ModuleLoader）

web 端加载插件浏览器端代码的方式：`window.__ModuleLoader__.load({ id, factory })`。所以 `client.js` 必须以那段 banner/footer 包裹——这是**从旧 API 迁移时最容易漏的一环**，漏了前端会报 `__ModuleLoader__ is not a function` 之类的错。

## 产物自检（三大硬约束）

构建脚本在打包后**自动检查浏览器产物**，任一不过即报错：

1. **require 白名单**：`lib/client.js` 只允许 import 平台模块表里的白名单模块（`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-*`），不允许 import Node 内置模块或 Node 端源码；
2. **无动态 import**：产物里不允许 `import(`（会破坏沙箱单文件约束）；
3. **无多 chunk**：浏览器端必须是单文件，不能产出 `client-xxx.js` 等拆包文件。

## build.ps1 干了什么

```powershell
# 1) npm install --legacy-peer-deps      （装 tsdown/typescript；注意 legacy-peer-deps 避免 dsh 内部 peer 冲突）
# 2) python scripts/link_deps.py         （junction 链宿主依赖；必须在 npm install 之后）
# 3) npx tsdown                         （双端打包）
# 4) 检查 lib/index.js 与 lib/client.js 是否生成
```

失败常见原因：Node < 22、tsdown 版本、宿主依赖未链接、浏览器产物违反硬约束 → 见 [troubleshooting.md](troubleshooting.md)。

## 测试金字塔

从下到上，越下越便宜、越该多写：

```
        ▲  集成测试（真实容器组合，验证注册/系统提示/技能）
        │  客户端测试（假 fetch 模拟全部外部依赖）
        │  纯函数契约测试（fragment 契约，钉死规则）
```

1. **纯函数契约测试**：针对 `src/fragment.ts`（共享契约）。把"数据怎么算/怎么组装"钉死，保证 Node/浏览器/测试三方一致。最便宜、最该多写。
2. **客户端测试**：针对 API 客户端。注入假 `fetch`，模拟成功/失败/超时，**不碰真实网络**（weather-plugin 用独立 Python 脚本 + Open-Meteo 实测比对，也属于这一层）。
3. **集成测试 / 冒烟**：
   - headless：`dsh --profile headless "<问题>"`（需配置 LLM key），验证"模型识别意图 → 调用工具 → 技能规范播报"全链路。
   - web：`dsh --profile web` 后浏览器打开 `http://127.0.0.1:3080`，输入问题，验证界面级动效卡片渲染（**这是最终验收**，命令行跑通不算完）。
