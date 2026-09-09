# Skill（技能）开发指南（基于 dsh 0.1.1-rc.2 真实 API）

> 与旧版 API（`fetchCandidates`/`load`/`Skill.instructions`）不同，当前版本是 **`SkillProvider { name, list(), get() }`**。以 weather-plugin 的 `weather-briefing` 技能为实战蓝本。

## 目录
- [技能是什么](#技能是什么)
- [注册技能：SkillProvider（list + get）](#注册技能skillproviderlist--get)
- [候选与正文：两级加载](#候选与正文两级加载)
- [创作契约：让模型"按规范写"](#创作契约让模型按规范写)
- [延迟加载：技能别全塞进上下文](#延迟加载技能别全塞进上下文)

## 技能是什么

**技能 = 给 AI 的"写作规范手册"。** 工具给 AI"手"（动作），技能给 AI"说明书"（怎么做、按什么规范产出）。一个 dsh 插件可以同时提供**多个技能**，每个技能是一个独立的"规范包"。

对用户的价值：模型平时不知道"某类内容该怎么写"；当触发某技能时，模型按技能里写死的规范来产出，保证格式、结构、风格一致。

## 注册技能：SkillProvider（list + get）

真实 API 是一个 provider 对象：**`list()` 返回"候选清单"（轻量），`get(candidate)` 返回"完整正文"（重，按需加载）**。

```ts
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate, type SkillDefinition, type SkillProvider,
} from '@deepseek-ai/dsh-skill'

const PROVIDER_NAME = 'my-plugin'
const INVOCATION = { modelInvocable: true, userInvocable: true } as const

const CANDIDATES: SkillCandidate[] = [{
  name: 'my-writing-style',
  description: '写「产品文案」时使用：统一风格、结构、话术。',
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  rank: BUNDLED_SKILL_RANK,
  locator: 'my-writing-style',
}]

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
      content: BODY,   // 完整规范正文，触发时才真正被加载进上下文
    }
  },
}
```

在 `index.ts` 里注册：

```ts
ctx.effect(() => ctx.skills.registerProvider(() => myWritingStyleProvider), 'my-plugin.skill')
```

要点：
- `candidate.description` 决定模型**何时加载这个技能** → 要写清触发条件。
- `get(candidate)` 返回 `SkillDefinition`，其中 `content` 是规范正文。
- `BUNDLED_SKILL_RANK` 是官方给的优先级常量；`source: 'bundled'` 表示随插件内置。

## 候选与正文：两级加载

| 层 | 内容 | 何时被加载 |
| --- | --- | --- |
| 候选 `list()` | name + description + 元信息（轻量） | 常驻，模型据此判断是否触发 |
| 正文 `get()` | 完整 `content`（重） | 仅当模型决定使用该技能时 |

## 创作契约：让模型"按规范写"

**技能正文（`content`）就是"创作契约"**：写清楚产出物的结构、必含章节、格式、字数、语气。写契约的方法论：

1. **结构契约**：明确固定结构。例：`先报城市与天气类型 → 温度体感 → 风力 → 高低温范围 → 建议`。
2. **必含要素**：列出缺一不可的内容。
3. **格式契约**：字数范围、语言、是否用 markdown。
4. **示例驱动**：给出 1~2 个"好例子"比抽象描述有效得多。
5. **边界**：写明"不做什么"（例：weather 技能要求"只依据工具返回的实时数据，不编造预报"）。

> 一个插件可含多个技能（候选清单一次返回多条，每条 `get` 各自的正文）。

## 延迟加载：技能别全塞进上下文

**关键性能原则：技能正文只在触发时才 `get`。** 不要把全部技能的完整正文常驻上下文——模型上下文是稀缺资源。所以写技能时：**候选 description 写精炼**（让模型知道何时用），**正文写完整**（触发时才读）。

这既是 dsh 的设计，也是本 Skill 应当遵循的结构：`SKILL.md` 精炼 + 正文/规范放 references 按需读。
