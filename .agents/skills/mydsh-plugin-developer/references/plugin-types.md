# 四种插件类型与选型

## 目录
- [总览表](#总览表)
- [类型一：Service Provider（换驱动）](#类型一service-provider换驱动)
- [类型二：Event Interceptor（加关卡）](#类型二event-interceptor加关卡)
- [类型三：Tool Plugin（装软件）](#类型三tool-plugin装软件)
- [类型四：Agent Loop（换引擎）](#类型四agent-loop换引擎)
- [选型决策表](#选型决策表)

## 总览表

| 类型 | 一句话 | 实现手段 | 典型案例 | 难度 |
| --- | --- | --- | --- | --- |
| **Service Provider** | 换底层驱动 | 实现接口 + `super(ctx, 'key')` + 配置覆盖 | 换模型网关、远程文件沙箱 | 中 |
| **Event Interceptor** | 在运行关键路径加料 | waterfall 事件 + `next()` 委托/短路 | 工具执行审批、审计、改写请求 | 低~中 |
| **Tool Plugin** | 给模型加可调用的动作 | `defineTool` + 自动注册 | 查库、调 API、渲染内容 | 低（最常见） |
| **Agent Loop** | 换核心驱动循环 | 实现 `Agent` 接口 + `AgentFactory` | Plan-and-Execute、多智能体 | 高 |

## 类型一：Service Provider（换驱动）

**解决什么**：dsh 的底层能力（模型适配器、文件系统、沙箱等）是"服务"，每个服务由某个 Provider 插件提供。想换实现 → 写一个新的 Provider 插件，在同一服务键上覆盖它。

**关键手段**：实现 `Service` 接口 + `ctx.super('key')` + 配置覆盖：
```ts
import { Service } from '@deepseek-ai/cordis';

// 1. 声明本插件的服务契约
declare module '@deepseek-ai/cordis' {
  interface Context {
    mySearch: Service<MySearchService>;
  }
}
ctx.provide('mySearch', MySearchService);

// 2. 替换底层服务时，继承旧实现并"借用"其生命周期
export function apply(ctx: Context, config: Config) {
  ctx.super('mySearch', { /* 复用旧服务的配置 */ });
  ctx.provide('mySearch', class extends MySearchService { /* 覆盖方法 */ });
}
```
- `ctx.super('key')`：访问/接管已存在的服务实现（类似 `super`），把原实现"挂到"自己名下再覆盖局部。
- 配置项通过插件 `Config`（schemastery）暴露，用户可覆盖。
- **何时用**：换模型网关（把 deepseek 请求改道）、把本地 fs 换成远程沙箱、接入自研向量库等。凡是"换一个底层驱动"的需求。

## 类型二：Event Interceptor（加关卡）

**解决什么**：在 dsh 运行的关键路径（工具执行前/后、消息进出的关键节点）插入"横切"逻辑，不改主流程本身。

**关键手段**：waterfall 事件（`ctx.emit` 系列），处理器可委托 `next()` 继续、也可短路：
```ts
// 伪代码：工具执行前先过"关卡"
ctx.on("before.tool.execute", (data, next) => {
  if (!userAllowed(data)) return;      // 短路：拒绝执行
  audit(data);                          // 审计
  return next({ ...data, extra: 1 });   // 改写参数后继续
});
```
- 事件按注册顺序依次执行，`next()` 把控制权交给下一个处理器；
- 所有处理器执行完才进入真正动作；任一处理器不调 `next()` 即短路；
- **何时用**：工具调用审批流、敏感操作审计、限流、请求改写、给每次工具调用注入上下文。

## 类型三：Tool Plugin（装软件）

**解决什么**：让模型拥有新的"动作"。**这是 90% 的 dsh 插件需求，也是本 Skill 的主推路线**（完整指南见 tool-plugin.md）。

**关键手段**：
```ts
// 用 defineTool 定义，再 ctx.tools.register 注册（完整代码见 tool-plugin.md）
ctx.effect(() => ctx.tools.register(
  defineTool({
    name: 'my_tool',
    description: '做什么、何时用、注意什么（写清楚！）',
    parameters: { /* 参数 JSON Schema */ },
    output: { render: ..., presentationMeta: ... },
    async execute(args) { /* 干活，返回 { text, ... } */ },
  }),
), 'my-plugin.tool')
```
- 不需要手动登记工具清单——**工具是注册驱动的**，`package.json` 里的 `dshx.contributes.tools` 只用于发现/声明；
- 工具只有 description 能被模型看到，参数有 `description` 才进模型上下文 → **描述写得好，模型才会用**（见 system-prompt.md）。
- **何时用**：让模型查数据库、调外部 API、生成/渲染内容、执行计算……凡"模型要一个可执行动作"。

## 类型四：Agent Loop（换引擎）

**解决什么**：dsh 默认的"思考 → 调工具 → 再思考"循环整体替换成自定义驱动逻辑（Plan-and-Execute、ReAct、Multi-Agent 编排等）。

**关键手段**：实现 `Agent` 接口（`run()` 等）+ `AgentFactory`，注册进 `ctx.agent` 服务，供上层按需实例化。
```ts
export function apply(ctx: Context) {
  ctx.agent.register("my-loop", MyAgentFactory); // 提供 agent 实现
}
```
- 干预面大、风险高，通常只有做"自定义编排框架"的高级需求才用。
- **何时用**：把单 Agent 改成计划-执行、子 Agent 协作、需要自行控制工具调用节奏/中止条件的场景。

## 选型决策表

对着用户的原始需求自问：

```text
用户想"加新能力" →
├─ 想让模型多一个"能干的动作"？            → Tool Plugin（首选）
├─ 想换掉底层驱动（模型/文件/沙箱/搜索）？ → Service Provider
├─ 想在关键路径插审批/审计/限流/改写？     → Event Interceptor
├─ 想重写整个思考-行动循环？               → Agent Loop
└─ 只是想教模型"怎么写/怎么组织内容"？     → Skill 插件（见 skill-plugin.md）
```

**选型口诀**：Provider 是"换驱动"，Tool 是"装软件"，Interceptor 是"加关卡"，AgentLoop 是"换引擎"。多数需求用 Tool Plugin + Skill 组合即可解决；先做最小可用的 Tool，再补技能/系统提示，不要一上来就动 Agent Loop。
