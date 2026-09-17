# 决策记录：工作台外壳与原型对齐（UI-HOME + 共用 shell）

日期：2026-09-17 ｜ 范围：plugin-medical-ui ｜ 状态：**P0、P1 已实施**（P2 仍为提案）

约束来源：`AGENTS.md` §2；`.requirements/requirements/R001-med-research-v1-1/ui-acceptance.md`；
`docs/decisions/2026-09-13-design-system-adoption.md`、`2026-09-13-single-home-composer.md`、`2026-09-13-s01-workbench-home.md`。

---

## 问题

`asset/首页.png` 与当前构建（`~/.dsh/profiles/med-research`，1672×941 截图）并排比对后，用户反馈的四处差异全部可复现，且都指向**交互结构**而不是配色：

1. **左栏五个入口只有图标、没有文字**（也不是宿主折叠态：宿主展开时同样只有图标）。
2. **composer 出现在内容区顶部**，每个页面都如此，与页面正文脱节。
3. **「打开研究工作区」按钮**以无样式裸按钮出现在宿主 Hero，原型首页没有这个控件。
4. **顶部 10 个 tab**（对话/轨迹/首页/研究/论文/证据/统计/知识库/写作…），而原型只有 5 个导航入口 + 每个页面内部的多列结构。

## 已核实的事实

| # | 事实 | 证据 |
|---|---|---|
| F1 | 宿主对 `sidebar.primary.action` **恒传 `wide:false`**（展开与折叠两处都是），插件拿到 `wide=true` 的路径不存在 | `packages/client/ui-sidebar/src/client/SidebarRoot.tsx:218`、`:229` |
| F2 | 入口组件在 `wide=false` 时不渲染 label，CSS 进一步把 `[data-wide="false"]` 收敛为"仅居中图标" → 五个入口永远无文字。这正是用户看到的现象 | `src/client/nav.tsx:100-105`、`src/client/nav.css:22` |
| F3 | `AGENTS.md` §2.1.1 禁止改 DSH Core，因此**不能**通过给宿主传 `wide:true` 解决，只能在插件侧换渲染形式 | `AGENTS.md` §2.1 |
| F4 | `mountComposer` 由**当前激活 View** 绑定；没有 View 声明 inline outlet 时走宿主 docked 放置（`data-placement="docked"`），composer 以 portal 挂到 scrollport 或 View 指定的 `targetId` | `ConversationSession.tsx:181-185`、`ConversationRoot.tsx:384-398`、`ResidentComposer.tsx:47-58` |
| F5 | 当前只有 `med-home` 声明了 composer 出口，其余 7 个 View 没有任何 composer 归属 → 它们都落到宿主 docked 位置（截图观感：输入框悬在页面上半部、压在正文之上） | `src/client/home.tsx:85-88`；`src/client/index.tsx:50-59` 的 8 个 View |
| F6 | 「打开研究工作区」是注册进宿主 Hero 的裸 `<button>`：`conversation.hero.actions`（空白会话且 active 为 chat/undefined 时显示）与 `conversation.hero.launch`（根 Hero）。它既没用 primitives，也不承载原型里的任何角色 | `src/client/hero-action.tsx`、`ConversationSession.tsx:197-201` |
| F7 | 宿主 `startSession(view?)` 支持带 View 启动会话，因此"新会话直接落在首页"在接口上是可行的 | `ConversationRoot.tsx:332`、`ConversationInjected.startSession` |
| F8 | 原型每个页面是**页面内多列**（Research 结果≈52%/Reader≈48%；Reader 14/48/38；Stats 30/70；Skills 23/45/32），且明确"不能只用互斥 tab 隐去对照" | `ui-acceptance.md:22-25` |
| F9 | 允许宿主把"原型独立图标轨道 + Project 列表"合并为 sidebar 内两个分组，但**五个入口、当前 Project 标识、会话入口、正文空间不得丢失** | `ui-acceptance.md:7` |
| F10 | 首页 composer 规则：Hero 复用宿主输入或可收起；不允许两个无区分的主输入；Research composer 固定在结果列底部 | `ui-acceptance.md:27` |

## 决定

### P0 — 结构对齐（本轮做）

**P0-1 导航入口改为"图标在上、文字在下"的 rail 单元。**
`MedPrimaryNavEntry` 不再以 `wide` 是否渲染文字：始终渲染 `medNavLabel`，布局从 `flex-row` 改为纵向堆叠（图标 20–24px、文字 12px、宽度撑满 rail），`nav.css` 的 `[data-wide="false"]` 分支从"仅图标"改为"堆叠居中"。补齐 rail 分组的无障碍名（`aria-label` 用已有 `nav.*` 字典键）。这样在不改 DSH Core（F3）的前提下满足 F9 的"五个入口 + 文字"。

**P0-2 建立 composer 归属表，每个 View 明确"谁拥有输入框"。**

| View | composer 归属 | 依据 |
|---|---|---|
| `med-home` | Hero 主输入（`mountComposer`，现状保留） | 原型首页 + F10 |
| `med-research` | 结果列底部（新增加 outlet，不覆盖 Reader） | F10 + `ui-acceptance.md:22` |
| `med-papers` / `med-evidence` / `med-statistics` / `med-knowledge` / `med-writing` / `med-skills` | V1 不承载主输入：不声明 outlet；若宿主 docked 位置与原型不符，按 F9 记为**声明过的宿主差异**并写入 evidence，不改 Core | F3 + F4 |

实施前先在真实 profile 上确认宿主的 docked 落点（固定底部 / 顶部 / 跟随滚动）是预期行为还是需要在 evidence 中声明的差异——这条决定依赖实测，不在代码里猜。

**P0-3 删除 Hero 上的「打开研究工作区」裸按钮，改为"新会话直接落在首页"。**
移除 `conversation.hero.actions` 注册；如需保留冷启动入口（根 Hero），只保留 `conversation.hero.launch` 一个，并改用 `Button` primitive（满足 design-system-adoption 的 primitives 要求）与字典文案。会话创建路径统一走 `startSession('med-home')`（F7）。

### P1 — 视图收敛（已实施）

**宿主没有"隐藏 tab"开关**：`apply.ts:156-167` 把每一个 `conversation.view` 条目都投影成 `ViewTab`，`ViewTab` 只有 `{id,label}`。所以"降级为页内区段"只能是**不再注册为视图**，由所属页面自己渲染。据此收敛为：

| 原型页面 | 注册视图 | 页内区段（不再是视图） |
|---|---|---|
| 首页 | `med-home` | 概览计数、能力卡、灵感、项目区 |
| 研究 | `med-research` | 证据列表（`MedEvidenceList`，`claim:<id>` focus 寻址） |
| 文献库 | `med-knowledge` | 论文阅读器（`MedPaperReader`）、草稿编辑器（`MedDraftEditor`） |
| 统计 | `med-statistics` | — |
| 技能 | `med-skills` | — |

跨页面的引用跳转沿用 opaque focus：`打开原文` 从 `openView('med-papers', …)` 改为 `openView('med-knowledge', encodePaperFocus(…))`；首页「证据」快捷入口与证据计数改为 `openView('med-research', encodeClaimFocus())`。四个主页面顶部新增面包屑「项目 › 页面」（`MedBreadcrumb`），项目名走 `remote.projects.get`。

### P2 — 密度与视觉核对（工具已备，执行待真实 profile）

**P1-1 主导航保持 5 个入口**（首页/研究/文献库/统计/技能，与 `MED_NAV_ENTRIES` 一致），把 `med-papers`、`med-evidence`、`med-writing`、`med-knowledge` 从顶级 View tab 降为所属主页面内部的区段或 drawer：论文+阅读器→文献库，写作→文献库/证据工作流内，知识库→首页项目区或文献库。目标：顶部 tab 不再承担"页面切换"，页面内多列回到 View 内部（F8）。

**P1-2 每个主页面加面包屑「项目 › 页面」**（原型 `PONV 研究 > Research + Evidence`），并在 View 内部按 F8 的比例实现分列。

### P2 — 密度与视觉核对

按 `ui-acceptance.md:45` 做同 run 的原型/实际逐区域对比表（区域边界、字体、间距、颜色、密度、滚动、焦点、遮挡）。
注：`views.css` 的字号/间距/圆角经抽查已基本落在规定阶梯内（Hero `clamp(36px,3.2vw,44px)`、页面标题 22px、正文 14px、圆角 8–16px、主操作 44px），P2 主要补的是**同 run 截图证据**，不是重写样式。

已交付两件东西，执行只差能起 profile 的环境：

- `scripts/capture-ui-parity.mjs`（`pnpm run ui:parity`）：走 CDP 在三个锁定视口 + 独立 200% zoom 轮采集截图，记录 revision / dirty / profile config hash / 服务数据 / console 到 `run.json`，并按 `scripts/ui-parity-regions.mjs` 里五张场景的区域表生成 `parity.md` 骨架。`--dry-run` 只出骨架不打截图（已在本机验证：表格与参数解析正常）。
- `docs/checklists/ui-parity-record.md`：采集前置、命令、八个维度怎么记、以及 blocking 判定清单（含"未声明的宿主差异"必须写进备注）。

## 放弃的方案

- **改宿主 `SidebarRoot` 让 `wide` 传 true。** 直接违反 `AGENTS.md` §2.1.1（不改 DSH Core），且会让插件依赖未发布的宿主改动。
- **在首页自建第二个 textarea。** 与 `2026-09-13-single-home-composer.md` 冲突（唯一输入框、附件/命令/审批由宿主拥有）。
- **保留 8 个 View tab，仅靠样式修。** 与 F8 冲突：原型的多列是页面内结构，tab 化会把"同屏对照"变成"互斥切换"，正是"交互很乱"的根因。
- **把原型的示例数字/身份写进界面。** `ui-acceptance.md:43` 明确禁止；计数必须来自服务，未知为"未知"。

## 需要的验证

- 组件测试：rail 单元在 `wide=false` 下仍渲染文字与 aria 名；每个 View 的 composer 归属（挂载/释放/跨 View 切换）行为。
- bundle 校验：样式仍走单一 `client.js`，所有权标签存在，只依赖允许的 primitives。
- 真实 profile 浏览器验证：1672×941 / 1440×900 / 390×844 三视口 + 200% zoom，zh/en，键盘 Tab/Enter，composer 不遮挡正文与最后一项。
- evidence：更新 `specs/S01-project-workspace/evidence/`，补齐"原型 vs 实际逐区域"表，并把 P0-2 中确认到的宿主 docked 差异显式登记。

## P0 实施记录

### 改动清单

| 文件 | 改动 |
|---|---|
| `src/client/nav.tsx` | 入口始终渲染 `medNavLabel`；注释记录宿主恒传 `wide:false` 这一事实 |
| `src/client/nav.css` | `.medNavEntry` 改为纵向堆叠（图标 26px + 12px 文字，`min-height:52px`，≥44px 触控目标）；删除"仅图标"的 `[data-wide="false"]` 规则；active 态由左侧竖条改为软底 + 蓝字 |
| `src/client/hero-action.tsx` | 删除 `MedResearchLaunch`（空白会话 Hero 的裸按钮）；`MedResearchRootLaunch` 改用 `Button` primitive，`startSession('med-home')` |
| `src/client/index.tsx` | 移除 `conversation.hero.actions` 注册，只保留 `conversation.hero.launch` |
| `src/client/views.tsx` | `ResearchView` 声明 composer 出口：结果列底部 `.researchComposer`，仅在渲染该出口的分支挂载（无绑定/加载失败时不认领），离开视图释放 |
| `src/client/views.css` | 新增 `.researchComposer` 出口样式 |
| `src/i18n/{en,zh}.ts` | 新增 `research.composerPlaceholder` |
| `tests/views.client.spec.tsx` | rail 在两种列状态下都渲染文字；研究视图认领/释放 composer、无绑定时不认领 |
| `tests/hero-action.client.spec.tsx` | 只保留根 Hero 启动用例 |
| `tests/client-plugin.client.spec.tsx` | 断言 `conversation.hero.actions` 为空、`conversation.hero.launch` 注册一条 |

### 验证输出

- `npx tsc -p tsconfig.client.json --noEmit` → 无输出（通过）。
- `npx vitest run packages/plugin-medical-ui` → Test Files 10 passed / Tests 52 passed。
- `npx vitest run`（整仓插件套件）→ 421 passed、1 skipped；1 个测试文件因 `fs-ext` 原生模块与当前 Node ABI 不匹配而失败，**与本次改动无关**（本机环境问题）。
- `node scripts/verify-client-bundle.mjs` → `client bundle ok … (132136 bytes, externals: react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis, @deepseek-ai/dsh-client-ui-primitives)`。

### P1 改动清单

| 文件 | 改动 |
|---|---|
| `src/client/index.tsx` | `VIEWS` 从 8 条收敛为 5 条（首页/研究/文献库/统计/技能） |
| `src/client/views.tsx` | `PapersView` → `MedPaperReader`（props 化，页面传 focus）；`EvidenceView` → `MedEvidenceList`（props 化，`onOpenSource` 交给页面）；新增 `useMedSessionProject` / `useMedProjectName`；`ResearchView` 承载证据区段 + 面包屑；`StatisticsView` 加面包屑 |
| `src/client/knowledge-view.tsx` | 文献库改为列表列 + 详情列，页内渲染阅读器与草稿编辑器；外部 paper/draft focus 仍可寻址 |
| `src/client/writing-view.tsx` | `WritingView` → `MedDraftEditor`（props 化） |
| `src/client/skills-view.tsx` | 加面包屑 |
| `src/client/components.tsx` | 新增 `MedBreadcrumb` |
| `src/client/focus.ts` | 新增 `encodeClaimFocus` / `decodeClaimFocus`（证据区段寻址） |
| `src/client/home.tsx` | 快捷入口与计数指向 5 个页面：阅读器→文献库，证据→研究（`claim:` focus） |
| `src/client/views.css` | `.medCrumb`、`.medLibraryColumns/.medLibraryDetail`、`.medEvidenceSection`，窄屏单列 |
| `src/i18n/{en,zh}.ts` | 新增 `nav.breadcrumb` |
| `tests/*` | 视图注册断言改为 5 条；阅读器/证据测区段组件；新增文献库页内打开阅读器、面包屑、研究页承载证据并跳转文献库、claim focus 编解码用例 |
| `packages/plugin-medical-ui/README{,.zh}.md` | 已知限制补记"只注册五个视图"与引用跳转走 `med-knowledge` |

### P1 验证输出

- `npx tsc -p tsconfig.client.json --noEmit` → 通过。
- `npx vitest run packages/plugin-medical-ui` → Test Files 10 passed / Tests 57 passed。
- `npx vitest run`（整仓插件套件）→ 426 passed、1 skipped；仍是同一个 `fs-ext` ABI 文件失败，与改动无关。
- `node scripts/verify-client-bundle.mjs` → `client bundle ok … (138309 bytes)`。

### 宿主 docked 落点：静态核实，未做真实截图复验

`ConversationRoot.module.css:369` — `.root[data-phase='active'] .composerSeat{position:sticky;bottom:0}`：没有 View 认领 inline 出口时，宿主把 composer 吸在内容列底部。截图里它显得"悬在上半屏"，是内容短于视口时 sticky-bottom 的正常结果，不是插件放错了位置。

因此 P0-2 的落法是**让需要输入的页面自己认领出口**（首页 Hero、研究结果列底部），其余页面沿用宿主 docked——按 `ui-acceptance.md:7` 属于允许的宿主差异，登记在此，不改 Core。

未复验项：本机没有 `dsh` 运行时（`~/.dsh/profiles/med-research` 存在但无可执行文件），三视口 + 200% zoom 的真实 profile 截图、以及"原型 vs 实际逐区域"对比表仍未跑，需在能启动 profile 的环境补做。
