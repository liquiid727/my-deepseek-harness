# dsh 插件架构与 Cordis 基础

## 目录
- [dsh 是什么（给新手的 30 秒）](#dsh-是什么给新手的-30-秒)
- [Cordis 生命周期：你写的代码在哪运行](#cordis-生命周期你写的代码在哪运行)
- [三大服务：Tools / Skills / SystemPrompt](#三大服务tools--skills--systemprompt)
- [双端架构：Node 干活，浏览器画画](#双端架构node-干活浏览器画画)
- [meta 传递：省 token 的持久化机制](#meta-传递省-token-的持久化机制)
- [配置与安装：profile bundles + cordis.patch](#配置与安装profile-bundles--cordispatch)
- [骨架文件清单（逐文件说明）](#骨架文件清单逐文件说明)

## dsh 是什么（给新手的 30 秒）

DeepSeek Harness（dsh）= **无特权内核**：几乎所有能力（模型适配器、工具注册表、Agent 循环、网页界面）本身都是插件，挂在名为 **Cordis** 的容器框架上。你的插件只是再往这个容器里挂一块。

- "增加新能力" = 写一个插件包，**不需要 fork 源码**。
- 核心哲学 `everything-is-a-plugin`：能换、能组合、能扩展。

## Cordis 生命周期：你写的代码在哪运行

一个插件包导出 `apply` 函数（同步或异步），dsh 启动时调用，把 **ctx（Context，容器上下文）** 传给你：

```ts
import type { Context } from '@deepseek-ai/cordis';   // 注意：包名是 @deepseek-ai/cordis

export const name = 'my-plugin';

export function apply(ctx: Context) {
  // 在这里注册工具/技能/系统提示；ctx 在插件生命周期内有效
  ctx.effect(() => { /* 副作用，挂载到插件生命周期 */ });
}
```

**最常用 API：**

| API | 作用 | 备注 |
| --- | --- | --- |
| `ctx.effect(fn, key?)` | 副作用，挂载到插件生命周期 | 插件被移除时自动清理；注册工具/技能/系统提示都包在 effect 里 |
| `ctx.on(event, fn)` | 订阅事件 | 事件结束时自动注销 |
| `ctx.inject = [...]` | 声明依赖的服务 | `export const inject = ['tools','skills','systemPrompt']` |
| `ctx.tools.register(def)` | 注册工具（defineTool 产物） | 见 tool-plugin.md |
| `ctx.skills.registerProvider(fn)` | 注册技能提供方 | 见 skill-plugin.md |
| `ctx.systemPrompt.section({name,order,text})` | 追加系统提示段落 | 见 system-prompt.md |

**给新手的心理模型**：`ctx` 是插座面板，你的插件是一次性插上去的插头；`effect` 是插头的保险丝——拔掉插头时自动断电清理，不留垃圾。

## 三大服务：Tools / Skills / SystemPrompt

工具、技能、系统提示是"给 AI 用的三样东西"，分工不同：

| 服务 | 一句话 | 给 AI 的定位 |
| --- | --- | --- |
| `ctx.tools` | AI 可调用的"动作"，有参数有返回值 | AI 的手 |
| `ctx.skills` | 教 AI"按什么规范做"的文档/技能包 | AI 的说明书 |
| `ctx.systemPrompt` | 注入给模型的固定指导文字 | AI 的入职培训 |

顺序感知：系统提示是**最底层的培训**，技能是**按需加载的规范**，工具是**可执行的行动**。三者常常配合：系统提示告诉模型"有几套教学工具可用" → 技能告诉模型"生成内容时遵循什么写作规范" → 工具实际执行。

## 双端架构：Node 干活，浏览器画画

dsh 网页端架构是"**Node 端（后端进程）+ 浏览器端（前端沙箱）**"分离，插件往往两端都要写：

```
┌─ Node 进程（可信任环境）─────────────────┐
│  · 注册工具、技能、系统提示               │
│  · 执行工具逻辑、调外部 API、访问文件系统 │
└──────────────┬───────────────────────────┘
               │ 工具结果（数据 + meta）经 JSON 跨进程传输
┌──────────────▼───────────────────────────┐
│ 浏览器端（Cordis 沙箱 iframe）            │
│  · 把工具结果渲染成卡片/组件（Toolview）  │
│  · 受限：CSP 限制、只读工具结果、无特权   │
└───────────────────────────────────────────┘
```

**双端共享的"契约层"**：把「数据怎么算出来的」抽成**纯函数契约模块**（`src/fragment.ts`），Node 端、浏览器端、测试三方共用。好处：
- 浏览器端只需用 `meta`（轻量数据）+ 契约函数就能渲染，**无需重跑 Node 逻辑**；
- 渲染结果与 Node 计算结果**回放一致**；
- 契约里可内嵌规则说明，供模型直接引用（省 token）。

**浏览器端三大硬约束**（详见 browser-side.md）：
1. 单文件产物、无动态 `import`、无多 chunk；
2. 不 import 任何 Node 内置模块；
3. 运行在沙箱 iframe，受 CSP 限制（不能内联脚本/远程脚本），必须走官方的 CDN/静态资源通道。

## meta 传递：省 token 的持久化机制

工具执行后，`output`（给模型看的文本）与 `presentationMeta`（给浏览器渲染用的数据）分离：

```ts
output: {
  render: (_args, value) => [{ type: 'text', text: value.text }],  // 模型看到的
  presentationMeta: (_args, value) => ({ kind: 'my-query', items: value.items }),  // 浏览器渲染用
}
```

- **render 出的 text**：喂给模型的文本（要省、要短）。
- **presentationMeta**：dsh 把它写进 `tool/result` 的**持久化 meta**（可含大结构），**不占模型上下文**；浏览器端 Toolview 从 `block.meta` 读回渲染，回放也一致。
- 浏览器端读取 `meta` 渲染出人看的界面 → 用户得到"模型看到文本 + 用户看到图形"的体验。

> 实战蓝本：weather 工具只回一行文字（"北京当前晴天，29°C…"），真正的结构化天气数据（类型/温度/风力/范围）都在 presentationMeta 里，浏览器据此渲染动效天气卡片。

## 配置与安装：profile bundles + cordis.patch

**安装 = 把插件放进某个 profile 的 bundle 列表**，用：

```bash
dsh plugin --profile <名> add file:<插件绝对路径>
```

它会自动把插件（含 `cordis.patch.yml` 里的 insert）写进 profile 的 `package.json` → `dsh.profile.bundles`，dsh 启动该 profile 时按 layer 顺序加载。

- **`package.json` 里插件自己的清单字段**：
  - `dsh.bundle.patch`：指向 `cordis.patch.yml`；
  - `dsh.client.inject` / `dsh.client.platform`：浏览器端注入声明；
  - `dshx.contributes.tools/skills`：工具/技能清单（发现用）。
- **`cordis.patch.yml`**：`insert` 声明插件 id + 包名，dsh 据此挂载插件实例。
- **用户覆盖配置**：插件暴露的 `Config`（schemastery z.object，带默认值）可在 profile/补丁层覆盖，无需改代码。

> 注意：`file:` 方式安装是**复制**到 profile，之后改代码需重新构建并用 `sync_profile.py` 同步产物（见 build-test.md）。

## 骨架文件清单（逐文件说明）

`assets/plugin-skeleton/` 的项目结构及每个文件的作用：

| 文件 | 作用 |
| --- | --- |
| `package.json` | 双端入口/导出、依赖、`dsh.bundle.patch`、`dsh.client.*`、`dshx.contributes` 清单 |
| `cordis.patch.yml` | insert 声明：把插件挂进 profile 的 layer 栈 |
| `tsconfig.json` | Node 端 TS 配置（`src/*.ts`，不含 src/client） |
| `tsconfig.client.json` | 浏览器端 TS 配置（`src/client/*`，lib: DOM，jsx: react-jsx） |
| `tsdown.config.ts` | 双端打包配置（Node 端 ESM + 浏览器端 CJS 单文件 + ModuleLoader 包装） |
| `scripts/build.ps1` | npm install → link_deps → tsdown → 自检 |
| `scripts/link_deps.py` | junction 链宿主依赖（dsh 发布包内的 @deepseek-ai/*） |
| `scripts/sync_profile.py` | 同步构建产物到已安装 profile（file: 依赖不感知更新） |
| `src/index.ts` | apply 入口：注册工具/技能/系统提示 + Config schema |
| `src/fragment.ts` | 共享契约纯函数（Node/浏览器/测试三方共用） |
| `src/tool.ts` | 示例工具定义（defineTool） |
| `src/skill.ts` | 示例技能定义（SkillProvider list/get） |
| `src/client/index.tsx` | 浏览器端入口：slots 注册 keyed Toolview |

> 架构细节以骨架内 `package.json`、`cordis.patch.yml`、`tsdown.config.ts` 与 `scripts/build.ps1` 的实际内容为准，本文件是通用解释。完整可运行案例见 `assets/examples/weather-plugin/`。
