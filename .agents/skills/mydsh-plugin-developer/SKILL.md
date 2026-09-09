---
name: mydsh-plugin-developer
description: '指导并帮助开发 DeepSeek Harness（dsh）插件与功能。当用户要求开发/编写/创建/搭建 dsh 插件或为 dsh 增加新能力时使用，包括：新增工具（Tool）、技能（Skill）、系统提示注入、调外部 API 的工具（含异步作业+轮询、代理出网、图生图）、浏览器端渲染组件（Toolview）、双端打包、构建与测试；理解 dsh 插件架构（@deepseek-ai/cordis 生命周期、ctx.effect/inject、defineTool、SkillProvider、presentationMeta、沙箱与 CSP）；诊断 dsh 插件报错与常见坑（Node 22 硬要求、junction 链接宿主依赖、profile 安装与 file: 依赖同步、output schema 校验、undici 代理）；按四种插件类型（Service Provider / Event Interceptor / Tool Plugin / Agent Loop）做选型与实现；或直接生成 dsh 插件项目脚手架。内置两个完整可运行、已通过 web 界面实测的实战案例：天气插件（assets/examples/weather-plugin，查天气 + 动效卡片）与电商出图插件（assets/examples/ecom-details-image-plugin，Claude Skill 改造成 dsh 插件 + 代理异步出图 + 画廊卡片）。基于 dsh 0.1.1-rc.2 与 dsh-openmaic 完整实战经验。'
---

# dsh 插件开发

## Overview

在 DeepSeek Harness（dsh）中"增加新能力" = 写一个插件挂载到 Cordis 容器，**不需要 fork 源码**。dsh 没有特权内核：模型适配器、工具注册表、Agent 循环都是插件。本 Skill 提供从 0 到发布 dsh 插件的完整工作流、可复用模板与参考资料，以 dsh-openmaic 插件为实战蓝本。

## 工作流

### 第 0 步：诊断需求 + 选型（先判断该写哪种插件）

动手前先回答"用户要加的新能力属于哪一类"。四种插件类型：

| 类型 | 解决什么问题 | 关键手段 | 何时用 |
| --- | --- | --- | --- |
| **Service Provider** | 替换底层能力（模型/文件系统/沙箱） | 实现接口 + `super(ctx,'key')` + 配置覆盖 | 换模型网关、换 fs 为远程沙箱、接自研搜索 |
| **Event Interceptor** | 在运行关键路径上"加料"（审批/日志/限流） | waterfall 事件 + `next()` 委托/短路 | 工具执行前审批、审计、改写请求 |
| **Tool Plugin** | 让模型拥有新能力（最常见） | `defineTool` + Schema 推导 + 自动注册 | 让模型查库、调 API、渲染内容 |
| **Agent Loop** | 替换核心驱动循环 | 实现 `Agent` 接口 + `AgentFactory` | 改成 Plan-and-Execute、Multi-Agent |

选型细节、机制与例子见 [plugin-types.md](references/plugin-types.md)。
**判断口诀**：Provider 是"换驱动"，Tool 是"装软件"，Interceptor 是"加关卡"，AgentLoop 是"换引擎"。

### 第 1 步：环境准备

1. **Node.js 必须 22+**（dsh 0.1.x 用到 `Promise.withResolvers`、`node:zlib` zstd、`node:module` stripTypeScriptTypes，Node 20 必崩）。验证：`node -v`。
2. **确定 dsh 发布包缓存位置**：不需要 dsh 源码 checkout。`npx @deepseek-ai/dsh` 或全局安装后，其 `node_modules` 里已带全 `@deepseek-ai/*` 宿主依赖；把它在 `scripts/link_deps.py` 里配成 `CACHE_AI` 即可（构建时 junction 链进插件）。
3. 确认能运行 `dsh`（如 `dsh --profile web` 验证环境）。跑 dsh 也要 Node 22：PATH 前置 node22 目录或用其 node.exe 直接调 dsh 的 `lib/bin.js`。

### 第 2 步：搭插件项目骨架

用脚手架脚本一键生成（推荐）：
```bash
python scripts/scaffold_plugin.py <项目目录> --name <@scope/plugin-name>
```
或手动复制模板 [assets/plugin-skeleton/](assets/plugin-skeleton/)。骨架含：
`package.json`（双端入口/导出/依赖/`dsh.bundle.patch`/`dsh.client.*`/`dshx.contributes`）· `cordis.patch.yml`（insert 挂载）· 双 `tsconfig`（Node 端 + 浏览器端）· `tsdown.config.ts`（双端打包 + ModuleLoader 包装）· `build.ps1`/`link_deps.py`/`sync_profile.py` · `src/index.ts`（apply 入口）。

骨架各文件逐行说明见 [architecture.md](references/architecture.md) 的"骨架文件清单"。

### 第 3 步：实现插件能力（按需读对应指南）

- **写一个工具**（Tool Plugin，最常见）：见 [tool-plugin.md](references/tool-plugin.md) —— `defineTool` 四要素、参数、output、meta、错误处理、完整示例。
- **写一个技能**（给 AI 的"写作规范"）：见 [skill-plugin.md](references/skill-plugin.md) —— `SkillCandidate`/`SkillProvider`、注册、创作契约、模板系统、延迟加载。
- **注入系统提示**（教模型何时用工具）：见 [system-prompt.md](references/system-prompt.md) —— `ctx.systemPrompt.section`、order、方法论。
- **写调外部 API 的工具**（异步作业 + 轮询）：见 [http-client.md](references/http-client.md) —— 可注入 fetch、Cookie、状态机、配置。
- **写浏览器端渲染组件**（Toolview/沙箱/流式预览）：见 [browser-side.md](references/browser-side.md)。
- **共享契约纯函数 + meta 传递**（双端共用、省 token、回放一致）：见 [architecture.md](references/architecture.md) 的"meta 传递"与 [tool-plugin.md](references/tool-plugin.md)。

### 第 4 步：构建（双端打包）

```bash
powershell -ExecutionPolicy Bypass -File scripts/build.ps1    # Windows
# 或 python scripts/link_deps.py && npx tsdown
```
构建做的事：npm install → **junction 链宿主依赖**（必须在 npm install 之后）→ `tsdown` 分别打包 Node 端（`lib/index.js`）与浏览器端（`lib/client.js` 单文件 + ModuleLoader 包装）→ 自检。详见 [build-test.md](references/build-test.md)。注意：**Node < 22 或 tsdown 0.22+ 都会因 `Promise.withResolvers` 报错**，Node 20 环境用 tsdown@^0.19。

### 第 5 步：测试

- **headless 冒烟**（优先）：`dsh --profile headless "<问题>"`，验证"模型识别意图 → 调用工具 → 技能规范播报"全链路（需配置 LLM key）。
- **纯函数契约测试**：对 `src/fragment.ts` 写单测，钉死"数据怎么算"。
- **web 界面验收（最终）**：`dsh --profile web` 起服务，浏览器打开 `http://127.0.0.1:3080` 输入问题，确认工具调用 + 动效卡片渲染。模式见 [build-test.md](references/build-test.md)。

### 第 6 步：交付与发布

- 校验产物：`lib/index.js` + `lib/client.js` 已生成并通过自检；`cordis.patch.yml` 的 insert 与 `package.json` 包名一致。
- 安装验证：`dsh plugin --profile web add file:<插件绝对路径>`（自动加入 profile bundles）；改代码后重建并用 `python scripts/sync_profile.py` 同步产物（file: 依赖是复制，不感知更新）。
- 常见报错与调试：见 [troubleshooting.md](references/troubleshooting.md)。

## 参考资料索引（按需读取）

| 文件 | 内容 | 何时读 |
| --- | --- | --- |
| `references/architecture.md` | dsh/Cordis 架构、生命周期、三大服务、meta、配置三层、骨架文件清单 | 搭建骨架 / 理解全局时 |
| `references/plugin-types.md` | 四种插件类型机制、示例、选型表、决策表 | 第 0 步选型时 |
| `references/tool-plugin.md` | defineTool 完整指南 + 示例 | 写工具时 |
| `references/skill-plugin.md` | Skill 开发指南 + 创作契约 + 模板 | 写技能时 |
| `references/system-prompt.md` | 系统提示注入 | 教模型用工具时 |
| `references/http-client.md` | 异步作业 + 轮询 + 可注入 fetch | 调外部 API 时 |
| `references/browser-side.md` | Toolview、沙箱、CSP、主题桥接、流式预览 | 写浏览器端时 |
| `references/build-test.md` | 双端打包 + 测试金字塔 | 构建/测试时 |
| `references/troubleshooting.md` | 常见报错与坑 | 排错/优化时 |

## 模板与脚手架

- **插件项目骨架**：`assets/plugin-skeleton/` —— 复制或由 `scripts/scaffold_plugin.py` 生成，改 `@scope/name` 即可起步。
- **脚手架脚本**：`scripts/scaffold_plugin.py` —— 一键生成项目，自动替换包名、入口、清单、构建脚本。

## 实战案例（整包参考）

- **`assets/examples/weather-plugin/`**：一个**完整、可运行、已通过 web 界面实测**的 dsh 插件（查天气 + 动效卡片）。它演示了真实 API 的全部要点：`defineTool` + `presentationMeta` 投影、`SkillProvider {name,list,get}`、`systemPrompt.section`、浏览器端 `slots.inject` 动效 Toolview、双端共享 fragment 契约、Node 22 + junction 构建、profile 安装与 headless/web 双测试。写插件时遇到"该怎么做"，直接对照它的源码。
- **`assets/examples/ecom-details-image-plugin/`**：把 **Claude Skill 改造成 dsh 插件**的完整案例（电商图片生成）。它演示了调外部生成 API 的进阶要点：**异步作业 + 轮询**（apimart 提交/查询/超时）、**受限网络走代理**（undici `ProxyAgent({uri})` 注入 + 轮询重试）、**output schema 校验坑**（`additionalProperties:false` 下 execute 返回值字段必须与 schema 一致）、**file: 依赖同步与重启流程**、浏览器端**骨架屏加载占位 → 画廊卡片**（无 meta 时渲染"正在生成…"）、25 个场景模板资产随插件打包、环境变量注入密钥/代理。它对应"把别的 AI 产品的 Skill/脚本改造成 dsh 插件"这一常见需求，方法论（SKILL.md）→ 技能正文、脚本 → 工具、输出 → 浏览器 Toolview 的映射可直接复用。

> 真实蓝本：dsh-openmaic 插件（4 工具 + 4 技能 + 系统提示 + 双端渲染 + 沙箱安全）。它的核心设计：共享契约纯函数（Node/浏览器/测试三方共用）+ meta 传递（省 token、回放一致）+ 双端分离（Node 干活、浏览器画画）。
