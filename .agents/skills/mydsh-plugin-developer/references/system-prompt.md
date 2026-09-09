# 系统提示注入指南（基于 dsh 0.1.1-rc.2 真实 API）

> 真实签名：`ctx.systemPrompt.section({ name, order, text })` —— 参数是一个**对象**，不是"id + text + options"三个参数。

## 目录
- [为什么插件要注入系统提示](#为什么插件要注入系统提示)
- [API：ctx.systemPrompt.section](#apictxsystempromptsection)
- [order：控制段落顺序](#order控制段落顺序)
- [方法论：怎么写好工具/技能说明](#方法论怎么写好工具技能说明)
- [系统提示 vs 技能：什么时候用哪个](#系统提示-vs-技能什么时候用哪个)

## 为什么插件要注入系统提示

dsh 允许插件往模型的系统提示里追加自己的段落。用途：
- **教模型"什么时候该用你的工具/技能"**（工具 description 很长，但系统提示里一句话就能引导行为）；
- 声明插件的使用约定（如"拿到数据后按某技能规范播报"）；
- 覆盖/调整默认行为。

## API：ctx.systemPrompt.section

```ts
ctx.effect(() => ctx.systemPrompt.section({
  name: 'tool:weather',      // 段落唯一标识
  order: 117,                // 顺序（小的靠前）
  text: `## Query weather (weather)
Use the \`weather\` tool when the user asks about the weather, temperature,
rain/snow, or wind for any city (for example "北京天气怎么样"). Pass the city
name in \`city\`. The tool returns real-time conditions as an animated card;
report it following the weather-briefing skill.`,
}), 'weather-plugin.prompt')
```

- `name`：段落唯一 id。
- `text`：段落正文，**模型能看到并遵循**。
- `order`：排序用的数字（见下）。

## order：控制段落顺序

系统提示由多个插件各自追加，顺序有讲究：**通用规则在前、具体约定在后**。用 `order` 排序：

```ts
{ name: 'a-general', order: 1,   text: '通用说明……' }
{ name: 'z-specific', order: 117, text: '特定插件的约定……' }
```

- order 小的靠前。约定类段落给较大 order 放后面，避免干扰模型对通用指令的理解（weather-plugin 用 117）。

## 方法论：怎么写好工具/技能说明

**模型只通过文字理解工具。** 写好说明（description）直接决定模型会不会正确调用：

1. **一句话说清"做什么"**：`查询某城市实时天气。`
2. **写清"何时用"**：`当用户询问天气、温度、雨雪、风力时使用。`
3. **写清"何时不用/注意"**：`仅当用户要求华氏度时才传 unit 参数。`
4. **给出调用样例（可选，极有效）**：`例：用户问"北京天气" → 调用 { city: "北京" }`
5. **参数逐个给 description**：模型只能看到带描述的参数。

> 实战检验：weather-plugin 的系统提示 + 工具 description 按"做什么 + 何时用 + 注意"三件套写，浏览器实测模型准确调用 weather 工具。

## 系统提示 vs 技能：什么时候用哪个

| 维度 | 系统提示 | 技能 |
| --- | --- | --- |
| 加载 | 常驻（始终在上下文） | 按需触发加载 |
| 体量 | 宜短（占用每一轮上下文） | 可长（触发时才读） |
| 用途 | 引导"何时用工具/遵守约定" | 提供"怎么写/怎么组织"的完整规范 |
| 典型 | `遇到 X 就调用工具 Y` | `写产品文案时按这 5 条规范` |

**原则**：全局的、简短的、每轮都需要的 → 系统提示；局部的、详细的、只在特定任务用到的 → 技能。别把长规范塞进系统提示。
