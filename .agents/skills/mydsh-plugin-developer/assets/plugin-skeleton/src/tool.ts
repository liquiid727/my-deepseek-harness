/**
 * The `my_query` tool: query an external service and project structured items
 * into the persisted `tool/result` meta so the browser half can render a card
 * and replay reproduces the same card. The model-facing result is a one-line
 * summary (the full items travel via meta, not context).
 * @module @yourscope/your-plugin/tool
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { ApiClientConfig, QueryItem } from './fragment.js'
import { normalizeItems, summarize, myMetaFrom } from './fragment.js'

const DESCRIPTION =
  '查询外部服务 X 的信息。当用户需要查 X 的数据时使用；结果会以卡片形式展示。'

/** 定义 my_query 工具（由 index.ts 注册到 ctx.tools） */
export function myQueryTool(config: ApiClientConfig, fetchImpl?: typeof fetch): ToolDefinition {
  return defineTool({
    name: 'my_query',
    description: DESCRIPTION,
    parameters: {
      keyword: {
        type: 'string',
        required: true,
        description: '查询关键词',
      },
      limit: {
        type: 'number',
        description: '返回条数（最多 20）',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          items: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
      // 把结构化条目投影进持久化 meta，前端据此渲染卡片并支持回放。
      presentationMeta: (_args, value) => ({
        kind: 'my-query',
        items: value.items,
      }),
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const input = args as { keyword?: unknown; limit?: unknown }
      const keyword = typeof input.keyword === 'string' ? input.keyword : ''
      if (keyword === '') throw new Error('my_query: keyword 是必填参数')
      const limit = Math.min(typeof input.limit === 'number' ? input.limit : 10, 20)
      const fetchImpl_ = fetchImpl ?? fetch
      const res = await fetchImpl_(`${config.baseUrl}/search?q=${encodeURIComponent(keyword)}&limit=${limit}`)
      if (!res.ok) throw new Error(`外部服务返回 ${res.status}`)
      const items: QueryItem[] = normalizeItems(await res.json())
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
