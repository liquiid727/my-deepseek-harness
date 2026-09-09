/**
 * my-plugin: a canonical dsh plugin skeleton demonstrating the three node-half
 * extension points plus the browser-half toolview:
 * - `my_query` tool: query an external service via fetch (see src/tool.ts)
 * - `my-writing-style` skill: a writing style guide for the model (src/skill.ts)
 * - a system-prompt section that teaches the model when to call `my_query`
 * The browser half (src/client) renders the tool result as a small card.
 * @module @yourscope/your-plugin
 */

import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import type SkillService from '@deepseek-ai/dsh-skill'
import type ToolRegistry from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { myQueryTool } from './tool.js'
import { myWritingStyleProvider } from './skill.js'
import type { ApiClientConfig } from './fragment.js'

type Context = CordisContext & {
  tools: ToolRegistry
  systemPrompt: SystemPrompt
  skills: SkillService
}

export const name = 'my-plugin'

export const inject = ['tools', 'systemPrompt', 'skills']

export interface Config extends ApiClientConfig {}

export const Config: z<Config> = z.object({
  baseUrl: z.string().default('https://api.example.com')
    .description('外部服务基地址；可指向 mock 服务做离线开发。'),
  timeoutMs: z.number().step(1).min(1_000).default(10_000)
    .description('单次请求超时（毫秒）。'),
})

const PROMPT_TEXT = `## Query service X (my_query)
Use the \`my_query\` tool when the user asks for information about service X (for example "查一下 X 里关于 Y 的内容"). Pass the keyword in \`keyword\`. The tool returns a card; summarize it following the my-writing-style skill.`

export function apply(ctx: Context, config: Config): void {
  const resolved: ApiClientConfig = {
    baseUrl: config.baseUrl ?? 'https://api.example.com',
    timeoutMs: config.timeoutMs ?? 10_000,
  }

  ctx.effect(() => ctx.tools.register(myQueryTool(resolved)), 'my-plugin.tool')
  ctx.effect(() => ctx.skills.registerProvider(() => myWritingStyleProvider), 'my-plugin.skill')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'tool:my_query',
    order: 117,
    text: PROMPT_TEXT,
  }), 'my-plugin.prompt')
}
