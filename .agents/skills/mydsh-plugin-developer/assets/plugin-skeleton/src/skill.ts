/**
 * Bundled skill provider for my-plugin: one skill that teaches the model how to
 * write product copy. Mirrors the official provider shape: candidates listed by
 * `list()`, full bodies served by `get()`.
 * @module @yourscope/your-plugin/skill
 */

import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'

const PROVIDER_NAME = 'my-plugin'
const INVOCATION = { modelInvocable: true, userInvocable: true } as const

const CANDIDATES: SkillCandidate[] = [
  {
    name: 'my-writing-style',
    description:
      '写「产品文案」时使用：统一风格、结构、话术。' +
      '在调用 my_query 拿到数据后，按此规范组织文案。',
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: 'bundled',
    rank: BUNDLED_SKILL_RANK,
    locator: 'my-writing-style',
  },
]

const BODY = `# 产品文案写作规范
1. 开头用一句话讲清卖点，不铺垫。
2. 结构固定：卖点 → 证据 → 行动号召。
3. 全文 60~120 字；语气自然，不用"亲爱的用户"。
4. 不编造数据；涉及数字时标注来源或写"示例"。
5. 结尾给一个明确行动：点击 / 领取 / 查看。`

/** The bundled provider registered on `ctx.skills`. */
export const myWritingStyleProvider: SkillProvider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve(CANDIDATES),
  async get(candidate): Promise<SkillDefinition> {
    return {
      name: candidate.name,
      description: candidate.description,
      invocation: candidate.invocation,
      provider: PROVIDER_NAME,
      source: 'bundled',
      rank: candidate.rank,
      content: BODY,
    }
  },
}
