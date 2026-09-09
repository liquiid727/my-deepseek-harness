# Tool Plugin 开发指南（defineTool，基于 dsh 0.1.1-rc.2 真实 API）

> 本文以本仓库 weather-plugin 与 dsh-openmaic 实战蓝本为准。若你的 dsh 版本不同，先 `node -e "console.log(require('@deepseek-ai/dsh-tools/package.json').version)"` 核对，再对照源码。

## 目录
- [一句话](#一句话)
- [注册方式：defineTool + ctx.tools.register](#注册方式definetool--ctxtoolsregister)
- [工具的四要素](#工具的四要素)
- [参数 Schema](#参数-schema)
- [output 与 presentationMeta 分离](#output-与-presentationmeta-分离)
- [错误处理](#错误处理)
- [完整示例：调一个外部 API 的工具](#完整示例调一个外部-api-的工具)

## 一句话

**工具 = 给模型看的"可执行函数签名" + 你写的 `execute` 实现。** 模型看到的是 `description` 和 `parameters`，模型调用后收到 `output.text`；浏览器端从持久化的 `block.meta` 里读 `presentationMeta` 投影的数据来渲染给人看。

## 注册方式：defineTool + ctx.tools.register

真实 API 是"**先 `defineTool(...)` 产出工具定义，再 `ctx.tools.register(...)` 注册**"，而不是直接往 register 里塞一个大对象：

```ts
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
// index.ts 里：
ctx.effect(() => ctx.tools.register(myQueryTool(config)), 'my-plugin.tool')
```

- `ctx.effect(() => ..., 'key')`：注册动作放进 Cordis effect，插件卸载时自动清理。
- `defineTool({...})` 返回 `ToolDefinition`，内部负责把你手写的 JSON Schema 参数自动转为模型可读格式。

## 工具的四要素

| 字段 | 作用 | 谁看 | 写作要点 |
| --- | --- | --- | --- |
| `name` | 工具名 | 模型 | 蛇形命名，唯一 |
| `description` | 说明 | **模型** | 讲清"做什么 + 何时用 + 注意什么"，直接影响模型会不会调用 |
| `parameters` | 参数 Schema | **模型** | 每个参数给 `description`，否则模型不知道要传什么 |
| `output` | 返回说明 | 模型 + 浏览器 | `schema/render` 定模型看到的文本；`presentationMeta` 定浏览器渲染的数据 |

外加 `execute(args)` 实现。

## 参数 Schema

参数是 **JSON Schema 对象**（手写，不需要 TypeBox）：

```ts
parameters: {
  keyword: { type: 'string', required: true, description: '查询关键词' },
  limit: { type: 'number', description: '返回条数（最多 20）' },
},
```

要点：
- `required: true` 标必填；缺省则可选。
- 枚举用 `{ type: 'string', enum: ['a','b'] }`。
- **每个参数都写 `description`**：模型只能看到有描述的参数。

## output 与 presentationMeta 分离

**这是 dsh 插件设计的核心套路，务必遵守：**

```ts
output: {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string', required: true },        // 给模型的一句话
      items: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true },
    },
  },
  render: (_args, value) => [{ type: 'text', text: value.text }],   // 模型看到的渲染结果
  // 把结构化数据投影进持久化 meta：浏览器端 block.meta 读它渲染卡片，回放也一致
  presentationMeta: (_args, value) => ({
    kind: 'my-query',
    items: value.items,
  }),
},
```

- **`value.text`（output 的第一字段）**：模型看到的结果文本，要**短**——模型还要把它写进自己的回复。
- **`presentationMeta`**：返回可 JSON 序列化的结构化数据，dsh 把它写进 `tool/result` 的持久化 meta，**不进入模型上下文**；浏览器端 Toolview 从 `block.meta` 读回渲染卡片。
- 浏览器端解析 meta 用共享纯函数（见 `src/fragment.ts` 的 `myMetaFrom`），保证 Node/浏览器两端解析逻辑一致。

## 错误处理

两种失败：
1. **参数/调用错误 → 直接 `throw`**：让模型知道这次调用无效，自行修正重试。
2. **业务失败（外部服务 4xx/5xx）→ 返回结构化结果**：把错误写进 `text`，模型读得懂并调整策略。

```ts
async execute(args) {
  const keyword = typeof args.keyword === 'string' ? args.keyword : ''
  if (keyword === '') throw new Error('my_query: keyword 是必填参数')
  const res = await fetch(`${config.baseUrl}/search?q=${encodeURIComponent(keyword)}`)
  if (!res.ok) throw new Error(`外部服务返回 ${res.status}`)
  const items = normalizeItems(await res.json())
  return { text: summarize(items), items }
}
```

注意：`execute` 直接**返回数据对象**（`{ text, items }`），不是 `{ output: {...} }`——output 的组装由 `defineTool` 按 `output.schema/render` 完成。

## 完整示例：调一个外部 API 的工具

```ts
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { normalizeItems, summarize, myMetaFrom } from './fragment'

export function myQueryTool(config: { baseUrl: string; timeoutMs: number }, fetchImpl?: typeof fetch): ToolDefinition {
  return defineTool({
    name: 'my_query',
    description: '查询外部服务 X 的信息。当用户需要查 X 的数据时使用；结果会以卡片形式展示。',
    parameters: {
      keyword: { type: 'string', required: true, description: '查询关键词' },
      limit: { type: 'number', description: '返回条数（最多 20）' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          items: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (_args, value) => ({ kind: 'my-query', items: value.items }),
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const keyword = typeof args.keyword === 'string' ? args.keyword : ''
      if (keyword === '') throw new Error('my_query: keyword 是必填参数')
      const limit = Math.min(typeof args.limit === 'number' ? args.limit : 10, 20)
      const fetchImpl_ = fetchImpl ?? fetch
      const res = await fetchImpl_(`${config.baseUrl}/search?q=${encodeURIComponent(keyword)}&limit=${limit}`)
      if (!res.ok) throw new Error(`外部服务返回 ${res.status}`)
      const items = normalizeItems(await res.json())
      return { text: summarize(items), items }
    },
    presentCall: () => ({ card: 'generic', title: '查询', kind: 'other' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const meta = myMetaFrom(result.meta)
      if (meta === undefined) return undefined
      return { card: 'generic', title: `查询 · ${meta.items.length} 条` }
    },
  })
}
```

> 调外部 API 的进阶（异步作业 + 轮询、可注入 fetch、超时）见 [http-client.md](http-client.md)。浏览器端把 `block.meta` 渲染成卡片见 [browser-side.md](browser-side.md)。完整可运行案例：`assets/examples/weather-plugin/`。
