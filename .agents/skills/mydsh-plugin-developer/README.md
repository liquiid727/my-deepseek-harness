# mydsh-plugin-developer — DeepSeek Harness 插件开发 Skill

> 指导 AI Agent 从 0 到 1 开发、构建、安装、测试 DeepSeek Harness（dsh）插件。基于 **dsh 0.1.1-rc.2** 与 dsh-openmaic 项目的完整实战经验，并内置两个**已通过 web 界面实测**的整包参考案例：天气插件（查天气 + 动效卡片）、电商出图插件（Claude Skill 改造成 dsh 插件 + 代理异步出图 + 画廊卡片）。

## 这是什么

dsh 采用"无特权内核、万物皆插件"的设计：模型适配器、工具注册表、Agent 循环、网页界面都是插件。**给 dsh 增加新能力 = 写一个插件包挂到 Cordis 容器上，不需要 fork 源码。**

这个 Skill 把"写一个 dsh 插件"这件事做成一套可复用的工作流：

```
诊断需求/选型 → 环境准备(Node22) → 生成骨架 → 实现(工具/技能/系统提示/浏览器端)
→ 双端构建(junction+tsdown) → 安装进profile → 测试(headless/web界面验收) → 交付
```

## 目录结构

```
mydsh-plugin-developer/
├── SKILL.md                        # 主工作流（Agent 先读这个）
├── README.md                       # 本文件：人读的说明
├── scripts/
│   └── scaffold_plugin.py          # 一键生成插件项目骨架（自动替换包名等占位符）
├── assets/
│   ├── plugin-skeleton/            # 可复制的插件骨架模板（真实 API）
│   └── examples/
│       ├── weather-plugin/         # 案例①：查天气 + 动效卡片（已实测）
│       └── ecom-details-image-plugin/ # 案例②：Claude Skill→dsh 插件，代理异步出图 + 画廊卡片（已实测）
└── references/                     # 按需加载的深度文档（共 9 篇）
    ├── architecture.md             # dsh/Cordis 架构、生命周期、双端、meta、骨架清单
    ├── plugin-types.md             # 四种插件类型与选型（Provider/Interceptor/Tool/AgentLoop）
    ├── tool-plugin.md              # defineTool 完整指南 + presentationMeta
    ├── skill-plugin.md             # SkillProvider {list,get} 开发指南
    ├── system-prompt.md            # ctx.systemPrompt.section 注入
    ├── http-client.md              # 调外部 API：异步作业 + 轮询 + 可注入 fetch
    ├── browser-side.md             # 浏览器端 slots Toolview、沙箱与 CSP
    ├── build-test.md               # 双端打包、ModuleLoader、测试金字塔
    └── troubleshooting.md          # 常见坑与排错（真实踩坑记录）
```

## 快速上手（给 AI Agent 的调用指引）

1. **先读 `SKILL.md`**：它定义了完整工作流（第 0~6 步），Agent 按其执行。
2. **按需读 references**：写工具读 `tool-plugin.md`，写技能读 `skill-plugin.md`，写浏览器端读 `browser-side.md`……（渐进式加载，别一次全读）。
3. **生成骨架**：`python scripts/scaffold_plugin.py <目录> --name @scope/name`，然后填充逻辑。
4. **对照案例**：写任何能力前，先看 `assets/examples/` 对应文件怎么写。查天气类看 `weather-plugin/`；**把别的 AI 产品的 Skill/脚本改造成 dsh 插件、或调外部生成 API（图片/视频/长任务、要代理出网）** 看 `ecom-details-image-plugin/`。

## 给用户的快速说明

- **要"让模型多一个可执行动作"（90% 的需求）** → 写 Tool 插件：`defineTool` + `ctx.tools.register`，把结构化数据经 `presentationMeta` 投影给浏览器渲染。
- **要"教模型按规范产出"** → 写 Skill：`SkillProvider { name, list(), get() }`，正文按需加载。
- **要"引导模型何时用工具"** → `ctx.systemPrompt.section({ name, order, text })`。
- **要"把工具结果画成好看的界面"** → 浏览器端 `ctx.slots.inject('tool.call.toolview', ...)` + keyed React 组件。
- **要"动起来/有特效"** → 纯 CSS 动画（案例的 6 种天气动效零外部依赖，可作模板）。

## 硬约束速记（踩坑总结）

| 项 | 要求 |
| --- | --- |
| Node 版本 | **必须 22+**（dsh 0.1.x 与 tsdown 0.22 都依赖 `Promise.withResolvers` 等新 API） |
| 宿主依赖 | 用 junction 链 dsh 发布包里的 `@deepseek-ai/*`，**不要**手动 npm 装一份（版本会不一致） |
| npm install 顺序 | 会清掉 junction → `link_deps.py` 必须在 `npm install` **之后**跑 |
| 浏览器产物 | 单文件、无动态 import、无多 chunk；必须带 `__ModuleLoader__` banner/footer |
| 安装 | `dsh plugin --profile <名> add file:<绝对路径>`；file: 是复制，改代码后要 `sync_profile.py` |
| 验收 | 命令行跑通不算完，最终要在 **web 界面**（`http://127.0.0.1:3080`）看到工具调用 + 渲染效果 |

## License

MIT

特别致谢： https://linux.do 社区支持
