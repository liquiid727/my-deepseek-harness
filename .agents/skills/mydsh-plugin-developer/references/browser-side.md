# 浏览器端渲染：Slots Toolview、沙箱与安全（基于 dsh 0.1.1-rc.2 真实 API）

> 与旧版 API（`ctx.tools.registerView`）不同，当前版本是 **`ctx.slots.inject('tool.call.toolview', ...)` + `ctx.slots.register({name, key}, Component)`**。以 weather-plugin 的动效天气卡片为实战蓝本。

## 目录
- [浏览器端在架构中的位置](#浏览器端在架构中的位置)
- [注册 Toolview：把工具结果画出来](#注册-toolview把工具结果画出来)
- [从 block.meta 读数据](#从-blockmeta-读数据)
- [沙箱 iframe 与 CSP 安全](#沙箱-iframe-与-csp-安全)
- [流式预览与降级](#流式预览与降级)

## 浏览器端在架构中的位置

Node 端负责"干活"（执行工具、调 API），浏览器端负责"画画"（把工具结果渲染成好看的界面）。两端通过 `tool/result` 的持久化 meta 衔接：

```
工具 presentationMeta ──► block.meta（持久化）──► 浏览器端 Toolview ──► 用户看到的卡片/图表/界面
```

浏览器端代码最终被打包成 `lib/client.js`，由 harness 以 `/plugins/<插件id>/client.js` 提供，在 **沙箱 iframe** 里运行。

## 注册 Toolview：把工具结果画出来

浏览器端入口模块声明 `name` + `inject: ['slots']`，在 `apply(ctx)` 里向 slot 注入 keyed 组件：

```tsx
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

export const name = 'my-plugin'
export const inject = ['slots']

function MyQueryCardView({ callId, block }: ToolCallViewProps) {
  // 渲染逻辑…
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'my_query' },   // key = 工具名
    MyQueryCardView,
  ))
}
```

要点：
- **key = 工具名**：只有这个工具的结果才走你的组件；其他工具用默认渲染。
- `ToolCallViewProps` 含 `callId`（作 React key）与 `block`（工具调用的数据块）。
- 组件**只读 meta**（轻量结构化数据），不重复执行 Node 逻辑 → 渲染快、回放一致。
- 客户端没有此组件时自动降级为工具文本结果（不报错）。

## 从 block.meta 读数据

组件接收的 `block` 有两种形态，务必区分：

```tsx
if (!('kind' in block)) {
  // 运行中/未定态：block 没有 kind，显示 loading
  return <div>⏳ 查询中…</div>
}
if (block.isError) {
  return <div>查询失败</div>
}
const meta = myMetaFrom(block.meta)   // 从持久化 meta 还原结构化数据
```

- 运行中（pending）的 `block` **没有** `kind` 字段；settled 的 `block` 才有。
- `block.meta` 里存的是 Node 端 `presentationMeta` 投影的数据（见 tool-plugin.md）。
- 解析 meta 用共享纯函数（fragment 里的 `xxxMetaFrom`），保证两端一致。

## 沙箱 iframe 与 CSP 安全

浏览器端插件代码运行在受 CSP 约束的 iframe 里，安全边界：

| 约束 | 原因 | 对策 |
| --- | --- | --- |
| 不能内联 `<script>`/远程脚本 | CSP 防注入 | 产物由 harness 静态通道加载；代码用 React + 内联 CSS |
| 不能随意加载第三方 CDN | 供应链安全 | 动效全部用纯 CSS/自绘（weather-plugin 的 6 种天气动画零外部依赖） |
| 只读工具结果 | 防止篡改 | 把"计算"放在 Node 端（契约函数），浏览器只渲染 |
| 无特权 API | 最小权限 | 需要能力时通过 Node 端工具暴露，不在浏览器端直连 |

**浏览器端产物三大硬约束**（构建自检会查）：
1. **单文件**：一个 `lib/client.js`，无多 chunk（tsdown `inlineDynamicImports: true`）；
2. **无动态 import**：`import()` 一律禁止；
3. **不 import 任何 Node 内置模块**（`fs`/`path`/`os` 等）；只 import 平台模块表里的 `react`、`@deepseek-ai/dsh-client-*`。

> 浏览器端打包细节（banner/footer、platform externals）见 [build-test.md](build-test.md) 与 `assets/plugin-skeleton/tsdown.config.ts`。

## 流式预览与降级

- **流式预览**：耗时工具可在等待时展示"进度态"（loading 旋转 + 呼吸文案），用 `!('kind' in block)` 分支驱动；完成后无缝切换为结果卡片。
- **降级**：`block.meta` 缺失或字段不全时，显示文本回退（取 `block.content` 首行），**不留白屏**；组件对 meta 判空。
