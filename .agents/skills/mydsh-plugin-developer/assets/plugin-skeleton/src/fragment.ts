// 共享契约层：Node 端、浏览器端、测试三方共用的纯函数。
// 把"数据怎么算/怎么组装"钉死在这里，保证双端回放一致、可单测。
// 注意：本文件不 import 任何 @deepseek-ai 包，Node 端与浏览器端都可直接打包。

export interface ApiClientConfig {
  baseUrl: string
  timeoutMs: number
}

export interface QueryItem {
  title: string
  summary: string
  link: string
}

/** 把外部 API 的原始条目规整成渲染/展示用的 QueryItem[]（纯函数，可测） */
export function normalizeItems(raw: Array<{ title?: string; description?: string; url?: string }>): QueryItem[] {
  return (raw ?? [])
    .filter((r) => r && r.title)
    .map((r) => ({
      title: r.title!,
      summary: (r.description ?? '').slice(0, 120),
      link: r.url ?? '',
    }))
}

/** 给模型看的一句话摘要（output.text 要短） */
export function summarize(items: QueryItem[]): string {
  if (items.length === 0) return '未找到相关结果。'
  return `查到 ${items.length} 条结果，第一条：${items.title}`
}

/** 从持久化 tool/result meta 还原结构化数据（Node 端写入、浏览器端读取） */
export function myMetaFrom(meta: unknown): { kind: string; items: QueryItem[] } | undefined {
  if (typeof meta !== 'object' || meta === null) return undefined
  const m = meta as { kind?: unknown; items?: unknown }
  if (m.kind !== 'my-query') return undefined
  if (!Array.isArray(m.items)) return undefined
  return { kind: 'my-query', items: m.items as QueryItem[] }
}
