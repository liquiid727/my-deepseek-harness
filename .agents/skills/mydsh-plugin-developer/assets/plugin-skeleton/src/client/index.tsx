/**
 * my-plugin, browser half: registers a keyed toolview for the `my_query` tool
 * under the atomic `tool.call.toolview` hole. Data comes from the persisted
 * `tool/result` meta projected by the node half, so replay reproduces the same
 * card. Clients without this half degrade to the tool's text result.
 * Runs in the sandboxed iframe: no external CDN, self-contained inline CSS.
 * @module @yourscope/your-plugin/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { myMetaFrom, type QueryItem } from '../fragment'

export const name = 'my-plugin'

export const inject = ['slots']

/** 查询结果卡片（纯 CSS，无外部依赖） */
function ResultCard({ items }: { items: QueryItem[] }) {
  return (
    <div style={{
      fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      borderRadius: 12, border: '1px solid #e4e3dd', padding: 12,
      maxWidth: 420, fontSize: 13, color: '#1a1b1c',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>查询结果（{items.length} 条）</div>
      {items.map((it, i) => (
        <div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid #f0efea' : 'none' }}>
          <div style={{ fontWeight: 500 }}>{it.title}</div>
          {it.summary && <div style={{ color: '#6b7280', marginTop: 2 }}>{it.summary}</div>}
        </div>
      ))}
    </div>
  )
}

/** 结果文本首行，用于降级单行展示 */
function firstResultLine(content: readonly { type: string; text?: string }[]): string {
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
      const newline = block.text.indexOf('\n')
      return newline === -1 ? block.text : block.text.slice(0, newline)
    }
  }
  return '查询失败'
}

/** Keyed toolview for the `my_query` tool. */
function MyQueryCardView({ callId, block }: ToolCallViewProps) {
  if (!('kind' in block)) {
    return <div style={{ fontSize: 12, opacity: 0.65 }}>⏳ 查询中…</div>
  }
  if (block.isError) {
    return <div style={{ fontSize: 12, opacity: 0.65 }}>{firstResultLine(block.content)}</div>
  }
  const meta = myMetaFrom(block.meta)
  if (meta === undefined) {
    return <div style={{ fontSize: 12, opacity: 0.65 }}>{firstResultLine(block.content)}</div>
  }
  return <ResultCard key={callId} items={meta.items} />
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'my_query' },
    MyQueryCardView,
  ))
}
