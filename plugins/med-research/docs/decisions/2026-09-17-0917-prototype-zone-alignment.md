# 0917 原型三区解析与对齐方案

日期：2026-09-17 ｜ 范围：`plugin-medical-ui` + 宿主座位边界 ｜ 状态：**Q1–Q9 全部已定；阶段 1a（中栏页头骨架）已实施并验证**

原型来源：`asset/0917/{1,2,3,4}.png`，四张均为 **1672×941**（与 `ui-acceptance.md` 的锁定视口一致）。
既有约束：[`ui-acceptance.md`](../../../../.requirements/requirements/R001-med-research-v1-1/ui-acceptance.md)、
[`2026-09-17-shell-prototype-alignment.md`](2026-09-17-shell-prototype-alignment.md)、`AGENTS.md` §2.1（不改 DSH Core）。

## 已确认（2026-09-17 用户答复）

| 原问题 | 答复 |
|---|---|
| Q3 验收基线 | **0917 成为新的验收标准**。已落地：`ui-acceptance.md` 场景表改为六个场景（0917 四张 + 沿用的统计/技能）、`scripts/ui-parity-regions.mjs` 区域表重写、`ui-parity-record.md` 与 `capability-matrix-baseline.md` 同步。 |
| Q1 L1 两形态 | **图 1 与图 2/3/4 的差别是状态差，不是迭代残留**：图 1 处于"只有一个项目"的状态，因此左栏收成紧凑形态（只有「项目 / 文献」+ 底部「项目设置」）；多项目时才是五个入口。L1 必须按项目数量切换形态，两种形态都不得丢失当前项目标识与会话入口。 |
| 右栏语义 | 确认：**右栏按当前对象的类型给出不同页签与内容**（项目助手 / 结果 / 摘要 / 详情），是选中物的检视器，不是第二个聊天窗。 |

### 第二轮确认（承载路线）

| 原问题 | 答复 | 推论 |
|---|---|---|
| Q2 L2 多项目形态 | **暂用图 2 形态**（当前项目标签 + 项目选择器 + 会话搜索 + 会话列表 + 域分组计数 + 「项目信息」组 + 底部项目卡） | L2 数据模型 = 项目 → 域（会话/文献/文档/数据/任务）；图 3/4 的工作区集合树不在 V1 实现范围 |
| Q4 右栏承载 | **复用**宿主 rightbar（路线 R1） | ⇒ **Q6 被推论确定**：右栏是宿主的 docking 面板，composer outlet 只接受 scrollport 内的目标，所以图 1 的右栏输入框必须**降级**为「中栏底部 + 右栏一个"打开会话"入口」；⇒ **Q8 被推论确定**：宽度交给宿主的手柄与记忆，接受默认 45% 视口，登记为声明过的宿主差异 |
| Q5 L2 归属 | **可以替换** `sidebar.workspaces`（路线乙） | 插件接管左栏第二层；宿主的 Workspace 分组/搜索/新建对话框由插件自己实现，**不得丢失会话入口**（`ui-acceptance.md` 的硬约束） |

至此只剩 **Q7**（笔记/文档/任务三个域是否补服务）与 **Q9**（统计/技能是否重画）未定。Q7 的默认走法：**不补服务前不渲染该域**（不显示 0、不显示占位），并把这些区域登记为未覆盖。

### 第三轮确认（右栏细节与后续页面）

| 原问题 | 答复 | 核实结果 |
|---|---|---|
| Q6 右栏输入框 | **插件自建**，不降级 | ✅ **可行**。`ISession.prompt(content: PromptContentPart[], mode: 'queue' \| 'steer')` 是公开行为动词（`packages/client/runtime/lib/types/client/contract/session.d.ts`），路径为 `ctx.sessions.scope(sessionId)` → `ctx.sessions.sessionOf(ctx)` → `prompt(...)`。右栏 tab body 可以自建 textarea 并投递成队列消息。**代价**：附件/斜杠命令/审批流程仍归宿主，插件输入框只能发纯文本，必须显式区别于宿主 composer，且**与中栏 composer 不能同屏**。 |
| Q7 服务缺口 | **是的，需要弥补**（补笔记/文档/任务三个域） | 需在 `medical-contracts/src/services.ts` 扩域 + 各 provider 实现。范围待定：见下方"Q7 工作量分解"。 |
| Q8 右栏宽度 | **按比例**，且右侧**可以折叠** | ⚠️ **半可行**。「可以折叠」✅ 现成：宿主有 collapse 控件，插件侧还有 `ctx.sidebarRight.toggleExpanded()`。「按比例」❌ **在 Q4=复用 的前提下做不到**，见下方冲突说明。 |
| Q9 统计 / 技能 | **按照新图** | 0917 集里没有这两页的新图；按 0917 的壳体语言（三栏 + 页头三件套 + 页内页签）重画这两页，内部列宽继续沿用 `ui-acceptance.md` 的 30/70 与 23/45/32。新原型到达后 `carriedOver` 标记移除。 |

#### Q8 的冲突（必须选一个）

宿主右栏宽度存在 `ui-layout` 的 layout store 里：首次打开取 `RIGHTBAR_DEFAULT_RATIO = 0.45`（视口 45%，最小 300px，最大 70%），此后**只有拖拽手柄**经 `actions.setRightbar(px)` 能改写（`ui-layout/src/client/stores.ts:101-110`、`AppFrame.tsx:189`）。该写入口**不在**任何插件可见的服务面上：

- `ctx.layout`（`ILayout`）只有 `toggleSidebar` / `openRightbar(track, fullscreen)` / `closeRightbar()`；
- `ctx.sidebarRight`（`ISidebarRight`）有 `openResource` / `openTab` / `active` / `isExpanded` / `toggleExpanded` / `focusTab` 等，**没有宽度写入**；
- 占用者只收到只读的 `RightbarOwnerProps { width, viewportWidth, canShow }`。

原型实测右栏 = 449/1672 = **26.9%**，宿主默认 45%（1672 下约 752px，是原型的 1.7 倍）。三条出路：

| 路线 | 做法 | 代价 |
|---|---|---|
| **A（推荐，零宿主改动）** | 接受宿主默认宽度；用户可以拖手柄把列调窄，拖动结果在会话内保留；折叠用宿主控件 | 「按比例」在首次打开时不成立，需在 evidence 里登记为**声明过的宿主差异** |
| **B（需要授权动宿主）** | 在 `ILayout` 上加一个可选的宽度写入口（如 `resizeRightbar(px)`），或让占用者提供首开默认比例 | 违反 `AGENTS.md` §2.1（不改 DSH Core）；同日 F3 已因同一理由否决过给 `SidebarRoot` 传 `wide:true` |
| **C（放弃复用）** | 改走 R2：插件替换 `rightbar` 占用者，自建固定列，宽度完全自控 | 与 Q4 的答复冲突；丢掉 dockit（浮动/分屏/guide/记忆） |

#### Q7 工作量分解

| 域 | 现状 | 要补的东西 |
|---|---|---|
| 笔记 Notes | 无服务；`Annotation` 类型已在 `medical-contracts` 里但无 CRUD、无计数 | `MedNotesService`（create/list/update/delete/count）+ 存储域 + Remote 命名空间 + 项目概览计数域 |
| 文档 Documents | 有 `papers.document(paperId)`（单论文的解析产物），**没有**"项目文档集合" | 项目级文档域（列表/计数/归属），或明确"文档"就是已上传 PDF 的集合、复用 `papers` |
| 任务 Tasks | 完全没有 | `MedTasksService`（项目任务：标题/优先级/截止/状态/关联对象）+ 存储域 + Remote + 计数域 |
| 环比增量 | `ProjectOverviewCounter` 只有 `status` + `value` | 计数加时间窗 delta（近 7/30 天），或另开一个 `trend` 接口 |

三个域都会牵动：`medical-contracts` 契约 → `medical-storage` 存储域与 schema 版本 → `plugin-*` 服务实现 → `plugin-medical-ui` 的 Remote 客户端与视图。这是一个独立里程碑，不是改视图能带出来的。

---

## 0. 结论摘要

1. **0917 已确认为验收基线**：`ui-acceptance.md` 的场景表改成六场景（0917 四张 + 沿用的统计/技能），`scripts/ui-parity-regions.mjs` 区域表重写，`ui-parity-record.md` 与 `capability-matrix-baseline.md` 同步。旧的 `asset/首页.png`、`asset/搜索研究.png` 退役。
2. **新原型把产品骨架从"两栏（导航 + 内容）"改成"三栏（导航 + 工作区 + 检视/助手）"**，比 `ui-acceptance.md` 记录的多了一根常驻右栏。这是本轮最大的结构变化。
3. **左栏 L1 与当前 P0-1 已实现的形态一致**（图标在上、文字在下、5 个入口）——0917 正好印证了今天上午那次改动是对的，不需要回退。
4. **左栏 L2 是新的**：原型要的是"项目/工作区目录树（会话/文献/文档/数据/任务 + 项目信息）"，而当前 L2 是宿主的 Session 浏览器（`sidebar.workspaces`，被 ui-workspace 占用）。这是本轮**代价最高**的对齐点。
5. **右栏有一处技术上做不到**：图 1 把输入框放在右栏底部，但宿主 `mountComposer` 的目标元素**必须**在 Conversation scrollport 内（`composer-outlet.ts:13`），而 rightbar 是 AppFrame 的兄弟列（`AppFrame.tsx:199-244`）——**右栏永远拿不到宿主 composer**。这一条只能降级或登记为宿主差异。
6. **四个域的计数在服务上不存在**：图 1 要 6 个计数（文献/证据/笔记/文档/数据集/会话）+ 环比增量，而 `ProjectOverview` 只有 5 个域（papers/evidences/datasets/analyses/charts）且**无 delta 字段**。

---

## 1. 原型三区解析

### 1.1 实测列宽（图 1，1672×941）

| 列 | 像素区间 | 宽度 | 占视口 |
|---|---|---|---|
| L1 图标轨道 | 0–64 | 64px | 3.8% |
| L2 上下文面板 | 64–318 | 254px | 15.2% |
| 中栏工作区 | 318–1223 | 905px | 54.1% |
| 右栏检视/助手 | 1223–1672 | 449px | 26.9% |

对照宿主：`sidebar` 折叠 56px；`rightbar` 最小 300px、**默认 45% 视口**（`columns.ts:25-29`）——对 1672 是 752px，是原型 449px 的 1.7 倍。宽度若要对齐，需要一个当前 `ctx.layout` **没有暴露**的写入口（服务只有 `openRightbar(track, fullscreen)` / `closeRightbar()`，见 `ui-layout/src/client/service.ts:31-42`）。

### 1.2 左栏 = 两级目录

**L1（图标轨道，64px）**：堆叠单元 = 24–26px 图标 + 12px 文字；当前项 = 蓝字 + 浅蓝底 + **左侧 2px 竖条**。

| 图 | L1 入口 |
|---|---|
| 图 2、3、4 | 首页 / 研究 / 文献库 / 统计 / 技能 ＋ 底部 设置 |
| 图 1 | **项目 / 文献** ＋ 底部 **项目设置** |

> 图 1 的 L1 只有 2 项、底部叫「项目设置」，是**单项目状态的紧凑形态**（已确认）：项目唯一时不需要五个域的切换入口，只留「项目 / 文献」+「项目设置」。多项目时恢复为五个入口 +「设置」。实现上这是一个按项目数量切换的 L1 形态，不是两套导航。

**L2（上下文面板，254px）**有**三种不同结构**散在四张图里：

| 形态 | 出处 | 结构 |
|---|---|---|
| ① 项目域列表 | 图 1 | 品牌标题「医学科研工作台」+ 折叠钮 → `新建会话` → 标签「项目」+ 项目选择器 → **会话 (5)**（展开：默认会话/文献分析讨论/Meta 分析方案/纳入排除标准/统计分析讨论 + 查看全部会话）→ 文献 36 / 文档 12 / 数据 2 / 任务 6 |
| ② 当前项目 | 图 2 | 品牌标题 + 折叠钮 → `新建会话` → 标签「当前项目」+ 项目选择器 → `搜索会话…` → **会话 (5)** + 「+ 新建会话」→ 会话列表（带时间戳，当前项蓝字+左竖条）→ 文献/文档/数据/任务 → 分隔线 → **项目信息**（项目概览/成员与权限/项目设置/回收站）→ 底部项目卡 |
| ③ 工作区树 | 图 3、4 | 品牌标题 + 折叠钮 → `新建会话` → 标签「工作区」+ 行内工具（🔍 / ⚙筛选 / ＋新建）→ **可折叠项目节点** → 会话 (5)[+新建会话] / 项目概览 / 文献 (28→可展开到论文条目) / 证据 (36) / 笔记 (12) / 数据 (2) / 任务 (6) → 其他集合（胸外科队列/麻醉药物比较/临床指南精读/Meta 分析/机器学习预测/我的文献库）→ 回收站 |

三者共享的骨架：**品牌标题行 → 主操作（新建会话）→ 作用域选择（项目/工作区）→ 可折叠域分组（带计数）→ 底部固定区（项目信息 / 回收站）**。

形态 ③ 表达力最强（一个树同时覆盖集合、项目、域、条目），图 3/4 两张一致，**建议以 ③ 为准**，把 ①② 视为迭代草稿。**待决问题 Q2。**

### 1.3 中间 = 固定骨架 + 按场景填充

四个场景共享的**页头三件套**（这是当前实现完全没有的）：

```
面包屑（PONV 研究 › 文献 › 论文标题 / 项目 / PONV 研究）
H1 标题（+ 状态徽标「进行中」）+ 右侧操作区（⋯ 分享 / 导出 保存到文档）
描述行 / 元信息行（张医生（负责人）· 创建时间 · 更新时间 ｜ 研究分析 · 2024-08-24 09:12 · 基于 12 篇文献 · 4,326 例患者）
```

然后是**工具行**：页面内页签（概览/文献/笔记/文档/数据/会话；证据(36)/笔记(12)；原文/翻译/双语对照）＋ 右侧控件（100% − + 适配/全屏；卡片/列表切换；相关度排序）。

各场景内容区：

- **图 1 项目概览**：6 张计数卡（值 + 环比 ↑12/+5/+3/+4/—/+2 + 一句说明）→ 「继续上次工作」宽卡（论文标题 + 进行中徽标 + `继续阅读 ⌄`）→ 双列「最近添加的文献」/「最近的笔记/证据」→ 「当前任务」清单（复选框 + 优先级徽标 高/中/低 + 截止日期）
- **图 2 会话**：消息流（用户右侧气泡、助手左侧带头像、hover 复制键）→ 助手回答 = 折叠清单「已完成证据检索与分析」+「主要发现」要点 → 附件 chip 行（表格·12 篇 / 图 1 / 文档·结构化描述）→ 底部 composer（`+` / `文献` / `证据` / `文档` / `联网检索` / `统计分析` + 模型选择 + 发送）
- **图 3 阅读器**：三列 **目录(≈14%) | 正文(≈48%) |（右栏≈38%）**；正文章节锚 + 脚注上标 + 选区工具条（翻译/术语解释/问AI/记笔记/保存证据）；正文 serif 16–18px
- **图 4 证据与笔记**：页签 + 主操作 `+ 添加证据` → 搜索框 + 「分组：按研究论题」+ 计数「48 条」+ 卡片/列表切换 → 筛选行（所有论题/所有标签/所有文献类型/所有年份/更多筛选）+ 排序 → 按论题分组标题（含计数）→ 证据卡（`支持`/`反对`/`不确定` 徽标 + 文献类型徽标 + 标题 + 原文引用 + 来源 + 标签行）

### 1.4 右侧 = 路由感知的检视/助手栏

统一骨架：**标题行**（图标 + 标题 + 停靠图标 + `×`）→ **页签行**（带计数徽标 + `⋯`）→ 内容 →（可选）底部操作条或输入。

| 图 | 标题 | 页签 | 内容形态 |
|---|---|---|---|
| 1 | 项目助手 | 结果 / 上下文 / 笔记 / 证据 | 项目背景与目标（`✎ 编辑`）→ 定义列表（研究问题/研究类型/研究人群/干预措施/对照措施/主要结局/次要结局）→ 「快速操作」2×2 → 「你可以这样问」建议卡 → **底部输入框** |
| 2 | 地塞米松预防 PONV 的证据总结 | 结果 / 上下文 / 笔记 / 证据 (12) / 引用 (28) / 任务 (3) | `导出` + `保存到文档` → `AI 生成结果` 徽标 + 时间 → 4 指标块（12 纳入研究 / 4,326 患者总数 / 0.62 合并 RR / 24% 异质性 I²）→ 核心结论 1-4 → Meta 分析森林图（子页签 总体效果·剂量比较 / 手术类型亚组·敏感性分析）→ 相关文献 (12) |
| 3 | （论文摘要） | 摘要 / 翻译 / 笔记 (3) / 证据 (2) / 引用 (12) | `AI 生成 · 论文摘要`：研究问题 / 研究设计 / 样本量 / 关键结果 / 结论（各带彩色图标）→ 选中文本解析（原文 / 中文翻译）→ 相关证据 (2) |
| 4 | （证据详情） | 详情 / 关联文献 (1) / 关联任务 (2) / 引用 (5) | 徽标行（`支持` `RCT`）→ 结论标题 → 「结论 / Claim」→ 「原文片段 / Original Text」+ `在文献中定位` → 「来源文献 / Source Paper」（缩略图 + DOI + PMID + 外链）→ 「位置 / Section」（Results – Meta-analysis / Page 5）→ 「相关标签」→ 创建/创建人/更新 → **底部固定操作条**（编辑 / 复制引用 / 添加到笔记 / 删除） |

**核心规律：页签集合由中栏"当前选中对象"决定**，右栏是**选中物的检视器**（图 3/4）或**当前会话/项目的结果面板**（图 1/2），不是独立聊天窗。

### 1.5 三区耦合规则（对齐时必须同时满足）

1. **选中物联动**：中栏选中证据 → 右栏切到「详情」；选中论文 → 右栏切到「摘要/翻译」。当前实现的跨页寻址靠 opaque focus（`focus.ts`），这条链路已经存在，可以复用。
2. **输入框唯一且位置随路由**：图 1 在右栏底部、图 2 在中栏底部、图 3/4 完全没有。**任何时刻只有一个主输入**。
3. **可折叠**：右栏有 `×`，左栏 L2 有折叠钮，两栏都收掉后中栏应独占。

---

## 2. 与当前实现（HEAD `f3b7701e35`）的差距

| 区域 | 当前 | 原型 | 差距性质 |
|---|---|---|---|
| L1 | `MED_NAV_ENTRIES` 5 项，堆叠图标+文字（`nav.tsx:102-107`、`nav.css:8-13`） | 同 | ✅ 已对齐（差 active 左竖条） |
| L2 | 宿主 `sidebar.workspaces`（ui-workspace 的 Workspace/Session 浏览器） | 项目/工作区目录树 + 域计数 + 项目信息组 | ❌ **结构性缺失** |
| 页头 | `MedPanel` 只渲染 标题 + 状态标签（`components.tsx`）+ 面包屑 | H1 + 徽标 + 描述 + 元信息行 + 操作区 | ❌ 缺失 |
| 页内页签 | 无 | 概览/文献/笔记/文档/数据/会话 等 | ❌ 缺失 |
| 分栏 | 仅 文献库 list\|detail、研究页证据区段 | 52/48、14/48/38、30/70、23/45/32 | ⚠️ 部分（比例未参数化） |
| 计数卡 | 首页 `medTileRow` 5 列（`home.tsx:293-334`） | 6 张带环比 + 说明 | ⚠️ 需扩域 |
| 右栏 | **插件零贡献** | 4 种检视形态 | ❌ 全新 |
| 输入框 | 首页 Hero + 研究结果列底部（P0-2） | 项目页在右栏、会话页在中栏 | ⚠️ 需修订归属表 |

---

## 3. 对齐方案

### 3.1 三个必须拍板的架构决策

#### D1 —— 右栏怎么承载？

| 路线 | 做法 | 代价 |
|---|---|---|
| **R1（建议）** | 注册 medical tab type：`ctx.sidebarRightTabs.register(...)` + `sidebar.right.pane.tab` 座位 | 复用 dockkit（浮动/分屏/宽度手柄/每会话记忆）；但 tab 是"胶囊+关闭+加号"的形态，与原型"固定页签行"视觉不完全一致；默认折叠需主动 `openRightbar`；宽度默认 45% |
| R2 | 整体替换 `rightbar` occupant，自建固定检视栏 | 与原型 1:1，但丢掉 dockkit 的全部能力，且要自己实现展开按钮、宽度手柄、窄屏 drawer |
| R3 | 做成 View 内部的第三列 | 最省事、视觉全可控；但**不是全局常驻**（跨页切换重建），窄屏不能独立成 drawer |

**建议 R1**，并把"页签行样式"作为声明过的宿主差异记入 evidence；R3 用于图 3/4 的紧凑检视（阅读器右栏本来就属于该页面）。

#### D2 —— 图 1 右栏底部的输入框怎么办？

**技术上不可行**：`ComposerOutlet.targetId` 必须是"D O M id of an empty destination **inside the current Conversation scrollport**"（`composer-outlet.ts:13`），而 `rightbar` 是 AppFrame 里 `conversation` 的兄弟列（`AppFrame.tsx:199-244`）。三条出路：

- **(a) 降级（建议）**：项目概览页的输入留在中栏底部，复用宿主 composer（现状），右栏不放输入 —— 登记为声明差异；
- (b) 插件自建右栏输入：与 `2026-09-13-single-home-composer.md`「唯一输入框、附件/命令/审批由宿主拥有」冲突，且目前**没有**向宿主 Session 投递消息的公开 API；
- (c) 让"项目概览"不再是 View，改成会话内的一段内容 —— 结构上行不通（它会失去页头与独立路由）。

#### D3 —— 左栏 L2 要不要替换宿主的 `sidebar.workspaces`？

`sidebar.workspaces` 是 `kind: 'single'`、当前被 ui-workspace 占用。注册进去 = **替换**，宿主的 Workspace 分组/搜索/新建对话框全部消失。

- **路线甲（保守，建议 V1）**：不动 L2，把原型的"域计数 + 项目信息"降级为中栏首页里的区块（现状即此），差异登记；
- **路线乙（对齐）**：替换 L2，实现形态③的完整目录树 —— 需要插件自己实现：新建会话 / 项目切换器 / 工作区搜索 / 新建集合 / 回收站 / 成员与权限入口。这是一个独立里程碑，不是一次样式改动。

> 若选乙，`ui-acceptance.md:7`「允许将原型独立图标轨道与 Project 列表合并为宿主 sidebar 内两个清晰分组，**不得丢失会话入口**」仍然成立（形态③ 本身含会话入口），但需要重新做一次无障碍与键盘验收。

### 3.2 分阶段落地

**阶段 1 —— 中栏骨架（收益最大、风险最低）**
把页头三件套、页内页签行、比例化分栏、计数卡四件事组件化，5 个页面全部套上：

| 组件 | 作用 | 落点 |
|---|---|---|
| `MedPageHeader` | 面包屑 + H1 + 状态徽标 + 描述 + 元信息行 + 操作区 | `components.tsx`，替换各 View 的 `MedPanel` 头部 |
| `MedPageTabs` | 页内互斥分段（**不是**宿主 View tab——宿主 tab 不可隐藏/自定义，见 `apply.ts:156-167`） | 新组件 |
| `MedSplit` | 比例参数化的分栏网格 + 断点塌缩 | `views.css` 已有 `medLibraryColumns` 可参数化推广 |
| `MedStatCard` | 值 + 说明 + 环比（无数据时显示"未知"而非 0） | 从 `home.tsx` 的 `medTile` 抽出 |

**阶段 2 —— 右栏（R1）**
`ctx.sidebarRightTabs.register({ id: '@medresearch/.../inspector', kind: 'med-inspector', ... })` + `sidebar.right.pane.tab` body；页签集合由"当前页 + 选中 ID"计算（沿用 `focus.ts` 的 opaque focus 作为唯一真相）；默认 `ctx.layout.openRightbar(true, false)`。

**阶段 3 —— 左栏 L2（D3 选乙才做）**
注册 `sidebar.workspaces`，实现形态③目录树；配套补"新建项目/新建会话/回收站"的插件侧实现。

**阶段 4 —— 服务缺口补齐 + 视觉核对**
按下面第 4 节的清单扩契约；然后跑 `pnpm run ui:parity` 出区域对比表。

---

## 4. 服务能力缺口（必须先补，否则只能显示"未知"）

| 原型要求 | 现有能力 | 缺口 |
|---|---|---|
| 图 1：6 个计数（文献/证据/笔记/文档/数据集/会话） | `projects.overview()` 只有 `papers/evidences/datasets/analyses/charts`（`medical-contracts/src/services.ts:109-118`） | 缺 notes / documents / sessions 三个域；analyses/charts 原型不再显示 |
| 图 1：环比增量（↑12 / ↑5 / ↑3 / ↑4 / +2） | `ProjectOverviewCounter` 只有 `status` + `value` | 缺 delta / 时间窗 |
| 图 2、4：「笔记 (12)」 | Remote 9 个命名空间（`remote.ts:126-234`）里**没有 notes** | 缺 Note 域 CRUD + 计数 |
| 图 2、3、4：「引用 (28)/(12)/(5)」 | 只有 `evidence.serializeCitations(claimId)` | 缺"按对象聚合的引用计数" |
| 图 2、4：「任务 (3)/(6)」「关联任务」 | **没有 tasks 域** | 缺任务域（宿主侧有 todo_write tool，但那是 agent 工具不是项目数据） |
| 图 1：「文档数量 12」「项目文档」 | 有 `papers.document()`，无"项目文档"集合 | 缺 documents 域 |

`ui-acceptance.md:15` 明确"禁止静态卡、假进度、占位列表"——所以**这些域在没有服务之前只能不渲染该项，不能填假数**。

---

## 5. 待确认清单

九条全部有答复，逐条的答复与推论记在文首三张表（已确认 / 第二轮 / 第三轮），此处只留索引，避免两处真相：

| # | 问题 | 答复 |
|---|---|---|
| Q1 | 图 1 的 L1 只有「项目/文献」+「项目设置」 | 单项目紧凑形态，L1 按项目数量切换 |
| Q2 | L2 多项目形态取图 2 还是图 3/4 | 暂用图 2 |
| Q3 | 0917 是否成为验收基线 | 是（已落地到验收文件与 parity 工具） |
| Q4 | 右栏复用宿主还是自建 | 复用（R1） |
| Q5 | 是否替换 `sidebar.workspaces` | 可以替换 |
| Q6 | 图 1 的右栏输入框 | 插件自建（`ISession.prompt` 路径已核实可行） |
| Q7 | 笔记/文档/任务三个域是否补服务 | 需要补 |
| Q8 | 右栏宽度按比例、右侧可折叠 | 折叠现成；**按比例在 Q4=复用 下做不到**，需在 A/B/C 三选一（见第三轮表的冲突说明） |
| Q9 | 统计页与技能页 | 按新图重画（0917 集暂未覆盖，先按壳体语言改） |

唯一仍悬空的是 **Q8 的 A/B/C 选择**——它不阻塞阶段 1b/2 的组件与结构，但决定右栏第一次打开时的列宽。

---

## 6. 已核实的技术事实（用于后续实现，避免重查）

| # | 事实 | 证据 |
|---|---|---|
| T1 | 宿主右栏默认宽度 = 45% 视口，最小 300px，最大 70% | `ui-layout/src/client/columns.ts:25-29`、`AppFrame.tsx:164` |
| T2 | `ctx.layout` 只暴露 `toggleSidebar` / `openRightbar(track, fullscreen)` / `closeRightbar()`，**无宽度写入** | `ui-layout/src/client/service.ts:24-43` |
| T3 | `rightbar` 是 `conversation` 的兄弟网格列，不在其 scrollport 内 | `ui-layout/src/client/AppFrame.tsx:199-244` |
| T4 | composer outlet 目标必须在 Conversation scrollport 内 | `ui-conversation/src/client/contract/composer-outlet.ts:13,21` |
| T5 | 宿主把每个 `conversation.view` 条目投影成 ViewTab，插件**无法隐藏或自定义** tab | `ui-conversation/src/client/apply.ts:156-167`；`2026-09-17-shell-prototype-alignment.md` P1 |
| T6 | `sidebar.primary.action` 是 list，宿主恒传 `wide:false`（56px rail） | `ui-sidebar/src/client/contract/slots.ts:32-36`；`SidebarRoot.tsx:218,229` |
| T7 | `sidebar.workspaces` 是 single，被 ui-workspace 占用（注册即替换） | `ui-sidebar/src/client/contract/slots.ts:37-41` |
| T8 | 右栏扩展座位：`sidebar.right.pane.tab`（keyed）/ `.title` / `sidebar.right.tab.guide`（chain）/ `.menu.item`（list），tab type 走 `ctx.sidebarRightTabs.register` | `ui-sidebar-right/src/client/contract/slots.ts:39-88`；`README.md` §Extension seats |
| T9 | `ui-sidebar-right` 已在 `dsh-web-app` bundle 中，med profile 可用 | `packages/bundle/web-app/cordis.patch.yml` |

---

## 7. 剩余施工顺序

Q1–Q9 全部有答复，承载路线不再有未知。剩下的是施工顺序：

1. **阶段 1b —— 页内结构**：把 `MedPageTabs` / `MedSplit` 接到实际页面上——证据与笔记页（图 4：页内页签 + 筛选行 + 按论题分组卡）、阅读器页（图 3：目录/正文/右栏三列）。这两页的服务已经齐备（`evidence.*` / `papers.*` / `knowledge.*`），**不依赖 Q7**。
2. **阶段 2 —— 右栏检视栏**：注册 medical tab type + `sidebar.right.pane.tab` body；页签集合由"当前页 + 选中对象"计算（复用 `focus.ts` 的 opaque focus）；底部输入框走 `ISession.prompt`，与中栏 composer 互斥。宽度按 Q8 的路线 A 落地并登记差异。
3. **阶段 3 —— 左栏 L2 替换**：注册 `sidebar.workspaces`，实现图 2 形态（当前项目 + 项目选择器 + 会话搜索 + 会话列表 + 域分组计数 + 项目信息组 + 底部项目卡）。宿主会话数据走 `ctx.sessions.list`。
4. **阶段 4 —— Q7 服务补齐**：笔记 / 文档 / 任务三个域 + `ProjectOverview` 的 delta。契约 → 存储域与 schema 版本 → 服务实现 → Remote 客户端 → 视图，是一条完整链路。
5. **阶段 5 —— 项目概览页重写**：等阶段 3 的 L2 与阶段 4 的计数域就位后做图 1 的六张卡、继续上次工作、最近双列、当前任务。
6. **阶段 6 —— 统计与技能按 0917 壳体重画**（Q9），并把 `carriedOver` 标记摘掉。
7. **最后**：跑 `pnpm run ui:parity` 出三视口 + 200% zoom 的区域对比表，逐条填 blocking 判定。

阶段 1b 与阶段 2 之间没有依赖，可以并行；阶段 5 依赖 3 和 4。

---

## 8. 基线切换后仍指向退役原型的引用（未改，需授权）

以下位置仍以 `asset/首页.png` / `asset/搜索研究.png` 为参照。它们属于**已批准的 PRD 与子 Spec 合同**，改动要走各自的修订流程，本次未动：

| 文件 | 位置 | 现状 | 建议 |
|---|---|---|---|
| `prd.md` | L26 | "`asset/` 提供五个核心工作面的视觉原型" | 改为六个场景（0917 四张 + 沿用的统计/技能） |
| `prd.md` | L371 | "五张 `asset/*.png` 是设计输入" | 同上，并补"0917 起基线"的说明 |
| `specs/S01-project-workspace/spec.md` | L84 | 描述 `asset/首页.png` 的 DSH 映射（Hero、快捷能力、三张能力卡、灵感条） | 重写为 0917/1 与 0917/2 的三栏壳体映射 |
| `specs/S04-evidence-claims/spec.md` | L62 | 描述 `asset/搜索研究.png` 的首屏结论卡与右栏 Reader | 重写为 0917/4 的页内页签 + 筛选行 + 右栏详情的映射 |
| `specs/S01-project-workspace/review.md` | L33 | "visual review against `asset/首页.png`" | 证据记录，**不改**（历史 run 的事实） |
| `specs/S04-.../evidence/implementation.md` | L69 | "has not been re-checked against `asset/搜索研究.png`" | 证据记录，**不改** |

已同步（不需授权，属于验收基础设施）：`ui-acceptance.md`、`scripts/ui-parity-regions.mjs`、`scripts/capture-ui-parity.mjs`、`docs/checklists/ui-parity-record.md`、`docs/roadmap/capability-matrix-baseline.md`、`docs/decisions/2026-09-17-shell-prototype-alignment.md`（文首修订批注）。

---

## 9. 实施记录

### 阶段 1a —— 中栏页头骨架（本轮已实施）

四个场景共用的页头层先落地，五个视图一次性接入。**不依赖 Q7 的服务缺口**，因为它只补结构不含新数据。

| 文件 | 改动 |
|---|---|
| `src/client/components.tsx` | 新增 `MedPageHeader`（面包屑 › H1 + 生命周期徽标 + 操作区 › 描述 › 元信息行，`display` 控制展示级 H1）、`MedPageTabs`（页内互斥分段，带计数徽标，**不是**宿主 View tab）、`MedSplit`（比例 token：`even`/`even-3`/`52-48`/`14-48-38`/`30-70`/`23-45-32`）；`MedMetricTile` 增加 `note` 与 `delta`（delta 缺失即不渲染，不编造环比）；`MedViewFrame` 改渲染 `MedPageHeader`，新增 `crumb`/`description`/`meta`/`actions` 四个可选入口 |
| `src/client/views.css` | 新增 `.medPageHeader` 一族（标题 26px，展示级 `clamp(30px,3vw,36px)`）、`.medPageTabs` 一族（下边框 + 2px 蓝色当前项 + 计数胶囊）、`.medSplit` 一族（用 `--med-split-cols` 变量承载比例，≤999px 全部塌成单列）；`.medTile` 改为 图标 + 内容体 两栏，计数行支持 delta 与说明；`.medTileRow` 从固定 5 列改为 `auto-fit minmax(140px,1fr)` 以容纳 6 张卡 |
| `src/client/{views,knowledge-view,skills-view}.tsx` | 四个视图把 `MedBreadcrumb` 从正文挪进 `MedPageHeader` 的 `crumb` 入口（研究与统计两个视图 + 文献库 + 技能） |
| `tests/components.client.spec.tsx` | 新增 9 个用例：页头六区域齐全/按需省略/展示级标记、页签选中与回调与计数省略、分栏比例 token 与子列数、计数卡的 delta/note/未知/重试、`MedViewFrame` 把面包屑放进页头而不是正文 |

配色取自原型像素而非猜测：图 1 的环比胶囊是绿色系（实测 `rgb(21,193,141)` 一族），映射到 `--med-green` / `--med-green-soft`；扁平态（`—`）用 muted。

**验证输出**

- `npx tsc -p tsconfig.client.json --noEmit` → 通过；`npx tsc -p tsconfig.json --noEmit` → 通过。
- `npx vitest run packages/plugin-medical-ui` → 11 文件 / **66 用例全通过**（原 57 + 新 9）。
- `npx vitest run`（整仓插件套件）→ 59 文件通过、**435 通过 / 1 skipped**；唯一失败仍是 `packages/medical-e2e/tests/composition.spec.ts` 的 `fs-ext` 原生模块 ABI 不匹配（NODE_MODULE_VERSION 141 vs 127），**改动前即存在**。
- `npx tsdown` 重建 → `lib/client.js` 145.69 kB；`node scripts/verify-client-bundle.mjs` → `client bundle ok … (143284 bytes, externals: react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis, @deepseek-ai/dsh-client-ui-primitives)`。

**本轮未做（诚实登记）**

- 700–999px 的"次要右栏改 drawer"没实现，`MedSplit` 在该区间只是塌成单列；
- 项目概览页（`MedHomeView`）还没接入新页头，也没有六张计数卡（等 Q7 的域与 delta）；
- 左右两栏（L2 替换、右侧检视栏）与页内页签的实际使用都还没开始；
- `MedPageTabs` / `MedSplit` 目前只有组件与测试，还没有调用方——它们的第一个调用方是下一批的页面内容改造。

### 阶段 2a —— 右栏「项目助手」（本轮已实施）

右栏按 Q4=复用 落到宿主的 right Sidebar 上：插件只贡献一个 tab type 和它的 body，列宽、折叠、停靠、分屏仍归宿主。

| 文件 | 改动 |
|---|---|
| `src/client/inspector.tsx`（新） | `MedInspectorBody`：标题行 + 页内页签（结果/上下文/笔记/证据）+ 四段内容。结果段＝项目背景与目标（`projects.update` 真写入，带 `updatedAt` 版本令牌，冲突时保留编辑器并报错）、研究问题/人群/干预/对照/结局定义列表（未填字段显示"尚未填写"而不是空行）、快速操作 2×2、你可以这样问（只填入输入框不发送）、底部**插件自建消息框**。上下文段＝项目名/状态/关键词/创建/更新。笔记与证据两段渲染为**有原因禁用**（`inspector.pendingService`，等 Q7）。导出 `MED_INSPECTOR_ID` / `MED_INSPECTOR_KIND` |
| `src/client/components.tsx` | `MedPageTab` 增加 `reason`：有原因的区段渲染为 `aria-disabled` + `title`，可聚焦但不可选中——隐藏起来会掩盖"这页本该有它" |
| `src/client/index.tsx` | 注册 tab type（stage one）+ body（stage two，`key: MED_INSPECTOR_ID`）；新增 `promptSession`（`ctx.get('sessions')` → `scope(id)` → `sessionOf(ctx)` → `prompt([{type:'text',text}], 'queue')`）；`navigate` 增加 `focus` 参数供右栏快捷操作使用。整段用 `if (sidebarRightTabs !== undefined)` 包住：不发行右栏的 profile 照常加载，只是没有这个面板 |
| `src/client/views.css` | token 块的选择器加上 `.medInspect`（右栏不在 `.researchPanel` 内，否则取不到 `--med-*`）；新增 `.medInspect*` 一族 |
| `src/i18n/{en,zh}.ts` | 新增 41 个 `inspector.*` 键与 `action.save` / `action.cancel` |
| `package.json` | 新增 `@deepseek-ai/dsh-client-ui-sidebar-right` 的 dev link 与 peer，并加入 `dsh.client.inject` |
| `tests/inspector.client.spec.tsx`（新） | 11 个用例：无绑定项目、四段与禁用原因、背景与五个字段、未填字段、编辑写回的版本令牌、写失败保留编辑器、快捷操作的可点与禁用、建议只填不发、发送成功清空、发送被拒保留草稿、上下文段 |
| `tests/client-plugin.client.spec.tsx` | 断言 tab type 与 body 各注册一条（含 title 走字典）；新增"没有右栏时不注册也不报错"用例；teardown 断言清空 |

**关于 Q8（右栏宽度）**：本轮按路线 **A** 落地——不设列宽，用宿主的手柄与记忆，折叠用宿主控件。原型的 26.9% 与宿主默认 45% 之间的差**登记为声明过的宿主差异**，写进 `ui-acceptance.md` 的宿主差异条款。若你要改成 B（改宿主加宽度写入口）或 C（改回自建列），右栏 body 不用重写，只换承载方式。

**验证输出**

- `npx tsc -p tsconfig.client.json --noEmit` → 通过；`npx tsc -p tsconfig.json --noEmit` → 通过。
- `npx vitest run packages/plugin-medical-ui` → 12 文件 / **78 用例全通过**（阶段 1a 后为 66，本轮 +12）。
- `npx vitest run`（整仓插件套件）→ 60 文件通过、**447 通过 / 1 skipped**；唯一失败仍是既存的 `fs-ext` ABI 不匹配。
- `npx tsdown` → `lib/client.js` 171.86 kB；`node scripts/verify-client-bundle.mjs` → `client bundle ok … (168904 bytes, externals 未变)`。

**阶段 2a 还没做的**：右栏的打开入口（谁在什么时候 `openTab('med-inspector')`）——它挂在项目概览页上，而那一页属于阶段 5；证据/论文两种实体的页签集合属于阶段 1b + 2b。

### 阶段 3 —— 左栏 L2 替换（本轮已实施）

`sidebar.workspaces` 是 `single` 且被 ui-workspace 的 Workspace 浏览器占着，注册进去就是**替换**。0917 的 L2 是项目树（当前项目 / 会话 / 域计数 / 项目信息），不是 Workspace 列表，所以 Q5 的"可以替换"落到这里。

| 文件 | 改动 |
|---|---|
| `src/client/project-nav.tsx`（新） | `MedProjectNav`：当前项目标签 + 项目选择器（`projects.selectProject`）、会话搜索、`会话 (N)` 组头 + 新建会话 + 会话列表（`openSession` 走 `ctx.sessions.open`，当前项高亮，`MM-DD HH:mm` 时间戳，按 `updatedAt` 倒序）、`项目` 组（项目概览 + 文献/证据/笔记/文档/数据/任务 六个域行与计数）、`项目信息` 组（回收站可展开并 `projects.restore`，成员与权限 / 项目设置**有原因禁用**）。窄列（`wide=false`）塌成一个展开按钮 |
| `src/client/locales.ts` | 结构重申 `sidebar.workspaces` 座位（single / root / owner + inject），与宿主声明保持一致 |
| `src/client/index.tsx` | 注册该座位；`SessionsNavigation` 补 `open(id)`；`openSession` 在服务缺失时**抛错**而不是静默吞掉 |
| `src/client/nav.css` | 新增 `.medNav*` 一族（**注意**：`nav.css` 里已有一个 `.medNavLabel` 用于 L1 入口，新面板的标签改用 `.medNavScopeLabel` 以免撞名） |
| `src/i18n/{en,zh}.ts` | 新增 17 个 `nav.*` 键 |
| `tests/project-nav.client.spec.tsx`（新） | 13 个用例：窄列塌缩、无项目、读取失败与重载、会话按 cwd 归属与倒序与空会话排除、搜索过滤、打开会话、新建会话、已服务域计数、单域失败显示未知、导航目标、切换项目、回收站展开与恢复、无目标项禁用及原因 |
| `tests/client-plugin.client.spec.tsx` | 声明并断言 `sidebar.workspaces` 占位一条，teardown 清空 |

**会话如何归属项目**：宿主 `SessionSummary` 没有 `workspaceId`，但有 `cwd`；med 项目有 `workspacePath`，且"一个项目绑定恰好一个 DSH workspace"。两者按 `cwd === workspacePath` 关联，绑定记录（`projects/sessionProject`）优先，未解析时回退到当前会话的 `cwd`。

#### ⚠️ 这次替换**丢掉**的宿主能力（必须显式登记）

宿主的会话浏览器是 `WorkspaceBrowser.tsx`(1413) + `Rows.tsx`(513) + `tree.ts`(440) + `navigation.ts`(235)，约 2700 行，没有对外导出的复用座位。替换后**下列能力当前没有承接**：

| 丢掉的能力 | 来源 | 现状 | 处理建议 |
|---|---|---|---|
| Workspace 的创建/重命名/删除/选目录对话框 | `ui-workspace` | 无入口 | 若需要，插件侧补一个「项目设置」里的 workspace 动作 |
| 会话重命名 / 删除 / 批量操作 | `Rows.tsx` | 无入口 | 可用 `ISession.rename(title)` 补重命名；删除需要会话服务 |
| 会话 fork | `ISessions.fork` | 无入口 | 可补，服务于"从某轮分叉"的研究工作流 |
| 子代理目录（parent → child） | `subagentsByParent` | 未渲染 | 研究场景价值低，建议登记为放弃 |
| 每会话的后台任务徽标 | `jobsBySession` | 未渲染 | 建议补（研究会跑长任务） |
| running / completed 状态点 | `SessionSummary.running/completed` | 未渲染 | 建议补，成本很低 |
| 空会话复用语义 | 宿主 `startSession` | **保留**（走宿主流程） | — |
| 会话列表 / 打开 / 新建 / 搜索 | — | **保留** | — |

上面七项里，"保留"的三项满足 `ui-acceptance.md` 的硬约束（不得丢失五个入口、当前项目标识、会话入口、正文空间）。其余是**已知的、尚未承接的功能**，不是遗漏；需要哪几项请点名，我按上表补。

**验证输出**

- `npx tsc -p tsconfig.client.json --noEmit` 与 `-p tsconfig.json --noEmit` → 均通过。
- `npx vitest run packages/plugin-medical-ui` → 13 文件 / **91 用例全通过**（阶段 2a 后为 78，本轮 +13）。
- `npx vitest run`（整仓插件套件）→ 61 文件通过、**460 通过 / 1 skipped**；唯一失败仍是既存的 `fs-ext` ABI 不匹配。
- `npx tsdown` → `lib/client.js`；`node scripts/verify-client-bundle.mjs` → `client bundle ok … (188691 bytes, externals 未变)`。

### 阶段 4a —— 服务扩域（本轮已实施）

开工前先核对了服务层，结论比预估乐观：**笔记与论题的实体和表都已经存在**（`knowledgeDomain` 里有 `med_notes`＋`noteSchema`，`evidenceDomain` 里有 `med_claims`＋`claimSchema`），缺的只是**暴露**和**计数**。所以本轮不是新建域，而是接线。

| 文件 | 改动 |
|---|---|
| `medical-contracts/src/services.ts` | `ProjectOverview` 从 5 个计数扩到 **8 个**：新增 `notes` / `documents` / `sessions`（原 `papers`/`evidences`/`datasets`/`analyses`/`charts` 保留）；`ProjectOverviewCounter` 新增可选 `delta`；新增 `PROJECT_OVERVIEW_DELTA_WINDOW_DAYS = 30` 与 `ProjectOverviewDelta`；`MedEvidenceService` 新增 `listClaims(projectId)` |
| `plugin-project/src/service.ts` | `overview` 重写：一个 `tally` 同时算总数与窗口内增量；`documents` 按"论文属于本项目"归属（文档自身没有 projectId）；`notes` 排除软删（`deletedAt`）；`sessions` 走 `sessionProjects`；`analyses`/`charts` 没有可用时间戳，因此**只报总数、不报环比** |
| `plugin-evidence/src/service.ts` | 实现 `listClaims`：按 `projectId` 过滤，`createdAt` 倒序，id 作同毫秒的稳定次序；带 `@Remote` |
| `plugin-medical-ui/src/client/remote.ts` | `evidence.listClaims` 接上 `medEvidence/listClaims` |
| `plugin-medical-ui/src/client/project-nav.tsx` | 域行改用真实计数：文献/证据/**笔记**/**文档**/数据 五行走 overview，**任务**仍是有原因禁用（该域尚无实体）；`会话` 组头改用 overview 的 `sessions` 计数，与项目概览卡同源，服务未知时回退到可见列表长度 |

**两条刻意的语义决定**，都写进了注释：

- **空域不报环比**：总数为 0 时省略 `delta`。否则"总数 0 + 环比 0"会被读成"最近没有新增"，而事实是"从来没有"。
- **没有时间戳的域永不报环比**：`analyses`/`charts` 的实体不带可用时间，宁可省略也不编一个 0。

**验证输出**

- `npx tsc -p tsconfig.json --noEmit` 与 `-p tsconfig.client.json --noEmit` → 均通过。
- `npx vitest run`（整仓插件套件）→ 61 文件通过、**463 通过 / 1 skipped**；唯一失败仍是既存的 `fs-ext` ABI 不匹配。
- 新增/更新的服务层用例：项目概览的空项目八域全 0、窗口内增量（含软删笔记不计、窗口外不计）、空域无 delta、无时间戳域无 delta；证据 `listClaims` 的倒序与跨项目隔离；`medEvidence/listClaims` 的线协议；L2 面板的五域计数与 `会话` 组头同源。

**阶段 4 还没做的**：**任务（Tasks）域**仍是从零开始 —— 需要 `TaskId`、`taskSchema`、`med_tasks` 表与 `SCHEMA_VERSION` 提升、`MedTasksService`、一个实现它的插件、`@Remote` 与客户端命名空间。图 2 的「任务 (3)」页签、图 4 的「任务」行都等它。按 Q7 的答复这属于要做的事，只是它是唯一需要新增存储域的项，所以单列一轮。

### 阶段 5 —— 项目概览页重写（本轮已实施，UI-PROJECT）

`home.tsx` 按 0917 图 1 重写。旧页面的 Hero、灵感栏、项目区、能力卡全部撤下 —— 那些是旧原型的形态，且项目区与新建入口已在阶段 3 交给左栏。页头三件套、页内页签、六张计数卡第一次真正被用上。

| 文件 | 改动 |
|---|---|
| `src/client/home.tsx`（重写） | `MedPageHeader`（展示级 H1＝项目名、生命周期徽标、描述＝研究问题、元信息行＝创建/更新时间、操作＝重新加载）；六个页内页签（概览/文献/笔记/文档/数据/会话），其中**笔记与文档两段有原因禁用**（对应页面尚未注册为视图）；**六张计数卡**用真实计数 + 环比胶囊（`↑N`，`title` 说明窗口天数），单域失败显示"未知 + 重试"，无页面的域渲染为不可点的卡并写明原因；「继续上次工作」取最近添加的论文并可跳转；`MedSplit` 双列「最近添加的文献 ／ 最近的笔记」；「当前任务」写明该域尚无服务（不伪装成空列表） |
| `src/client/components.tsx` | `MedMetricTile` 的 `delta` 增加可选 `title`（承载"近 N 天"的说明）；可选 prop 补 `| undefined` 以适配 `exactOptionalPropertyTypes` |
| `src/client/locales.ts` | `MedViewInjected` 增加可选 `openInspector` |
| `src/client/index.tsx` | 解析 `sidebarRight` 并把它作为 `openInspector` 注入每个 View；`sidebarRightTabs` 提前解析供两处复用 |
| `src/client/views.css` | 新增 `.medResume*` / `.medRecent*` / `.medCounters` / `.medComposerHandoff` |
| `src/i18n/{en,zh}.ts` | 新增 25 个 `home.*` 键（页签、卡说明、继续上次工作、最近、任务、环比窗口） |
| `tests/views.client.spec.tsx` | `MedHomeView` 的 11 个旧用例整体换成 15 个新用例：无会话、未绑定项目时不认领 composer、页头与徽标、六张卡、环比胶囊与"无环比则无胶囊"、单域失败与重试、六段页签与禁用原因、页签与卡片的导航目标、无页面域的卡、继续上次工作、最近双列排序、任务域说明、composer 交接、检视栏拉起、释放 |

#### 关于中栏 composer 的取舍（必须知道）

图 1 的中栏没有输入框，输入在右栏；而宿主对"未认领出口"的 View 一律把 composer **停靠在内容列底部**，插件没有办法让它不渲染。所以本页**认领**该出口、把目标节点设为不绘制（`.medComposerHandoff`），并在挂载时打开右栏检视栏 —— 这页的输入就是检视栏里那个。

**代价**：右栏被关闭时，本页在重新打开前没有输入框。这是 Q4=复用 + Q6=自建 两条答复叠加后的必然结果，已登记为声明过的宿主差异。若改成"中栏保留输入、右栏不放"，只需把该节点改为绘制并去掉 `openInspector` 调用（两行）。

另外两处如实说明：**页签里的「笔记」「文档」不可点**，因为对应页面还不在已注册视图里（笔记数据已在服务层可用，只是没有承载页）；**「当前任务」只有一句原因**，任务域尚未存在。

**验证输出**

- `npx tsc -p tsconfig.client.json --noEmit` 与 `-p tsconfig.json --noEmit` → 均通过。
- `npx vitest run packages/plugin-medical-ui` → 13 文件 / **97 用例全通过**（阶段 4a 后为 91）。
- `npx vitest run`（整仓插件套件）→ 61 文件通过、**468 通过 / 1 skipped**；唯一失败仍是既存的 `fs-ext` ABI 不匹配。
- `npx tsdown` → `lib/client.js`；`node scripts/verify-client-bundle.mjs` → `client bundle ok … (186149 bytes, externals 未变)`。

### 阶段 3 补丁 —— 左栏空态

阶段 3 的替换漏了一步：项目数为 0 时左栏只显示"尚无项目"，没有可完成的下一步，违反 `ui-acceptance.md` 的"empty 有可完成的下一步"。本轮补上：空态渲染**名称 + 研究问题的创建表单**，提交走 `projects.create` 并 `selectProject` 绑定到当前会话；创建失败时两个字段都保留（不吞掉用户输入）。

### 阶段 5 补丁 —— 真实 profile 的三栏装配

浏览器实测发现两个不在组件单测覆盖内的装配问题：本地 profile 在 tarball 内容更新但版本不变时会复用旧 `node_modules`，导致旧 `ProjectOverview` 缺少 `sessions` 字段，二级项目栏渲染崩溃并回退到宿主工作区；医疗 UI 又没有把 `sidebarRightTabs` 和 `sidebarRight` 声明为硬依赖，首次加载可能错过右侧“项目助手”。

`install-local-profile.mjs --force` 现在只删除该 profile 可再生的 `node_modules` 后重新安装，确保新打包 tarball 真正进入本地运行环境。医疗 UI 将右侧栏服务加入 `inject`，缺失时在加载期报错；项目概览、L2 项目树与 L3 项目助手因此作为同一个三栏工作台装配，而不是可静默退化为两栏。对应浏览器验证在 3104 profile 中确认 L2 `.medNav` 渲染、无 `sidebar.workspaces` 插槽错误；右栏装配改动另由客户端单测与重新打包验证。

### 阶段 5b —— 会话行操作

会话列表的每一行现在提供可聚焦的操作菜单：重命名、分叉会话、归档。重命名调用宿主 `ISession.rename`，分叉调用 `ISessions.fork` 后打开新会话，归档调用 `UiWorkspace.archiveSession`；操作期间锁定当前行，避免重复提交。当前公开接口没有删除会话的方法，因此没有添加会误导用户的“删除”按钮；如果需要彻底删除，需先由宿主会话服务定义删除语义、权限和恢复策略。

对应验证：`project-nav.client.spec.tsx` 覆盖三项菜单操作和重命名输入，医疗 UI 客户端类型检查通过。

### 阶段 5c —— 隐藏重复的宿主 View tab 条

真实 profile 的中栏页头会投影宿主 `ConversationSessionHeader` 的 tab 条，同时列出 Chat、Trajectory 和医疗 View。这与 0917 的左侧 L1 主导航重复；0917 只在左侧提供五个工作台入口。医疗插件现在在加载期间设置可回收的 `medResearchWorkbench` body 标记，并仅隐藏带 `data-conversation-header-corner` 的宿主会话页头 tab 条；项目页、阅读器和检视栏自己的业务 tab 不受影响。

验证：浏览器 profile 3108 中宿主会话 tab 条可见数为 0，左侧医疗导航和中栏内容仍可用；插件卸载时 body 标记被移除。

### 阶段 5d —— 首页工作区回退与 L1 轨道几何

截图中的“尚未选择项目”来自已存在会话缺少 `sessionProject` 绑定，而 L2 已按会话 `cwd` 显示匹配项目。首页和右侧检视栏现在采用同一回退：先读持久绑定，缺失时仅在会话 `cwd` 等于活动项目 `workspacePath` 时认领该项目。这样不会把无关项目当作当前项目，同时旧会话也能进入项目概览并把 composer 交接给右栏。

医疗 profile 同时把 L1 固定为包含 gutter 的 64px 轨道，入口保留 44px 内容框；L2 从明确的竖向分界开始，图标与文字不再被宿主列内边距挤压。

### 阶段 5e —— 会话菜单可达性与右栏初始页

会话行的标题按钮不再占满整个 flex 行；它会为固定宽度的操作按钮留出空间，`⋯` 默认可见，以便鼠标、触摸和键盘用户都能打开重命名、分叉和归档菜单。项目首页打开右栏时以项目助手替换宿主默认的“开始”引导 tab，避免右栏显示与项目无关的内容；宿主 chrome 右上角的关闭按钮仍可折叠整个右栏。
