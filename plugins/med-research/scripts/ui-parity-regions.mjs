/**
 * Region tables of the prototype scenes (R001 `ui-acceptance.md`).
 * One row per region the run must compare; the capture script turns these into
 * the per-run parity table so nothing is compared from memory.
 *
 * Baseline: the 0917 prototype set (`asset/0917/1..4.png`, all 1672×941) is the
 * acceptance baseline. It supersedes the earlier `asset/首页.png` (UI-HOME) and
 * `asset/搜索研究.png` scenes. The statistics and skills pages are not in the
 * 0917 set, so their earlier prototypes stay in force until a replacement lands.
 * @module med-research/scripts/ui-parity-regions
 */

/**
 * One comparable region of one scene.
 * @typedef {object} ParityRegion
 * @property {string} id - Stable region id used in the table.
 * @property {string} label - Localized region name.
 * @property {string} [assertion] - Blocking assertion from `ui-acceptance.md`.
 * @property {string} [share] - Declared column share of the business area.
 */

/**
 * The prototype scenes with their regions. `supersedes` names the earlier scene
 * id this one replaces, so archived evidence stays traceable across the
 * baseline change; `carriedOver` marks a scene the 0917 set does not cover.
 */
export const PARITY_SCENES = [
  {
    id: 'UI-PROJECT',
    owner: 'S01',
    asset: '../../../asset/0917/1.png',
    supersedes: 'UI-HOME',
    prerequisite: '单项目状态（左栏为紧凑形态）；该项目含通过服务写入的 Paper/Evidence/Dataset/Session；打开项目概览',
    regions: [
      { id: 'project.crumb', label: '顶栏面包屑「项目 › 项目名」', assertion: '面包屑与全局搜索、通知、账户同屏' },
      { id: 'project.header', label: '页头：H1 + 状态徽标 + 描述 + 元信息行 + 操作区', assertion: '负责人/创建时间/更新时间来自服务；右上 ⋯ / 分享 可达' },
      { id: 'project.tabs', label: '页内页签（概览/文献/笔记/文档/数据/会话）', assertion: '当前页签可辨识；页签是页内分段，不占用宿主 View tab' },
      { id: 'project.counters', label: '六张计数卡', assertion: '文献/证据/笔记/文档/数据集/会话；计数等于服务值，单域失败为未知而不是 0；服务无环比时不得编造' },
      { id: 'project.resume', label: '继续上次工作', assertion: '卡片指向真实的最近对象且可继续' },
      { id: 'project.recent', label: '最近添加的文献 ／ 最近的笔记·证据（双列）', assertion: '两列同屏，各自可滚动，条数与服务一致' },
      { id: 'project.tasks', label: '当前任务清单', assertion: '优先级与截止来自服务；无服务时不渲染该区' },
      { id: 'rail.compact', label: 'L1 单项目紧凑形态', assertion: '只有「项目 / 文献」+ 底部「项目设置」，不丢失当前项目标识与会话入口' },
      { id: 'rail.tree', label: 'L2 项目选择器 + 域列表', assertion: '项目可切换；域分组带计数；选定项有当前标识' },
      { id: 'inspector.frame', label: '右栏骨架（标题行 + 页签行 + 关闭）', assertion: '页签为 结果/上下文/笔记/证据；可关闭且关闭后正文不位移' },
      { id: 'inspector.project', label: '右栏「项目助手」内容', assertion: '背景与目标可编辑；研究问题/类型/人群/干预/对照/结局来自项目记录' },
      { id: 'inspector.actions', label: '快速操作 2×2 + 你可以这样问', assertion: '每个按钮连到公开服务或宿主动作；建议项只填入输入框不自动检索' },
    ],
  },
  {
    id: 'UI-SESSION',
    owner: 'S01+S02+S04',
    asset: '../../../asset/0917/2.png',
    supersedes: null,
    prerequisite: '多项目工作区；完成一次真实检索与证据整理，会话含附件产物',
    regions: [
      { id: 'session.header', label: '页头：会话标题 + 元信息行', assertion: '研究分析/时间/基于 N 篇文献/N 例患者均来自服务' },
      { id: 'session.transcript', label: '消息流', assertion: '用户与助手可区分；长回答不遮挡后续操作' },
      { id: 'session.plan', label: '助手的已完成清单', assertion: '步骤状态真实，不得静态假进度' },
      { id: 'session.findings', label: '主要发现', assertion: '要点与已存 Evidence 一致' },
      { id: 'session.artifacts', label: '附件 chip 行（表格/图/文档）', assertion: '指向真实 Artifact 且可打开' },
      { id: 'session.composer', label: '中栏底部 composer', assertion: '宿主唯一主输入；固定在底部且不覆盖最后一条消息' },
      { id: 'rail.workspace', label: 'L2 工作区树（多项目）', assertion: '会话分组与计数可见；当前会话有标识' },
      { id: 'inspector.result', label: '右栏「结果」指标块 + 核心结论', assertion: '指标来自服务计算结果；AI 生成内容有来源标识' },
      { id: 'inspector.chart', label: '右栏图表（森林图 + 子页签）', assertion: '只显示源 Artifact 已产出的图，不得现算' },
    ],
  },
  {
    id: 'UI-READER',
    owner: 'S03',
    asset: '../../../asset/0917/3.png',
    supersedes: null,
    prerequisite: '已完成一次检索并保存论文；打开真实正文，选区翻译，保存 Note',
    regions: [
      { id: 'reader.crumb', label: '三级面包屑（项目 › 页 › 论文）', assertion: '逐级可达' },
      { id: 'reader.header', label: '论文标题 + 元信息 + 操作行', assertion: 'metadata 来自已解析 Document；收藏/引用/下载按授权可用' },
      { id: 'reader.toolbar', label: '阅读模式页签 + zoom 控件', assertion: '原文/翻译/双语对照与缩放均可用；模式切换保留滚动位置' },
      { id: 'reader.toc', label: '目录列', share: '≈14%', assertion: '章节来自解析结果且可跳转' },
      { id: 'reader.body', label: '正文列', share: '≈48%', assertion: '英文正文 16–18px serif、行高 1.5–1.7；脚注上标可辨识' },
      { id: 'reader.selection', label: '选区工具条', assertion: '翻译/术语解释/问AI/记笔记/保存证据 均有键盘等价入口且不出界' },
      { id: 'rail.workspace', label: 'L2 工作区树（论文条目高亮）', assertion: '当前论文在树中有标识；展开项来自服务' },
      { id: 'inspector.reader', label: '右栏（摘要/翻译/笔记/证据/引用）', share: '≈38%', assertion: '正文与助手同屏；摘要需用户显式请求' },
    ],
  },
  {
    id: 'UI-EVIDENCE',
    owner: 'S04+S08',
    asset: '../../../asset/0917/4.png',
    supersedes: null,
    prerequisite: '项目中已有若干已核验 Evidence 与 Note，且存在至少两个研究论题分组',
    regions: [
      { id: 'evidence.header', label: '页头 + 页内页签（证据/笔记）+ 主操作「+ 添加证据」', assertion: '页签计数来自服务；主操作可达且不遮挡' },
      { id: 'evidence.toolbar', label: '搜索框 + 分组 + 总数 + 卡片/列表切换', assertion: '搜索连到服务查询；总数与筛选结果一致' },
      { id: 'evidence.filters', label: '筛选行（论题/标签/文献类型/年份/更多）+ 排序', assertion: '筛选可用且不裁掉主操作；清空筛选可达' },
      { id: 'evidence.groups', label: '按论题分组标题（含计数）', assertion: '分组计数等于组内卡片数' },
      { id: 'evidence.cards', label: '证据卡（支持/反对/不确定 + 文献类型 + 原文引用 + 来源 + 标签）', assertion: '至少两张完整卡；状态另有文本或图标，不只靠颜色' },
      { id: 'rail.workspace', label: 'L2 工作区树（证据高亮）', assertion: '当前域在树中有标识；域计数与页面一致' },
      { id: 'inspector.detail', label: '右栏「详情」：结论 / 原文片段 / 来源文献 / 位置 / 标签 / 元信息', assertion: '「在文献中定位」跳到同一 anchor；DOI/PMID 可打开' },
      { id: 'inspector.actions', label: '右栏底部操作条（编辑/复制引用/添加到笔记/删除）', assertion: '复制引用使用确定性 serializer；删除需确认' },
    ],
  },
  {
    id: 'UI-STATS',
    owner: 'S05',
    asset: '../../../asset/统计lab.png',
    supersedes: null,
    carriedOver: '0917 原型集未覆盖统计页，沿用既有原型直到有替代',
    prerequisite: '导入合成 CSV/XLSX，修正类型，生成 Logistic 计划和代码，审阅并批准真实 Runner 运行',
    regions: [
      { id: 'stats.dataset', label: 'Dataset 区', share: '≈30%', assertion: '前五行 preview 与 Variables 可见' },
      { id: 'stats.analysis', label: '分析区', share: '≈70%', assertion: '四块计划可见；代码与结果表/Forest Plot 同屏对照' },
      { id: 'stats.provenance', label: 'Execution & Provenance', assertion: '可见，且不能用互斥 tab 隐去对照' },
      { id: 'stats.approve', label: '确认并执行', assertion: '仅在当前代码可审阅且审批有效时启用' },
    ],
  },
  {
    id: 'UI-SKILLS',
    owner: 'S07',
    asset: '../../../asset/skill工作台.png',
    supersedes: null,
    carriedOver: '0917 原型集未覆盖技能页，沿用既有原型直到有替代',
    prerequisite: '本地目录装载 13 个定义；创建草稿并上传公开 sample PDF，启动受限测试',
    regions: [
      { id: 'skills.inventory', label: 'Inventory', share: '≈23%', assertion: '搜索、状态筛选、至少三张卡' },
      { id: 'skills.builder', label: 'Builder', share: '≈45%', assertion: '名称/版本/指令/工具/schema 与附件可见' },
      { id: 'skills.preview', label: 'Preview', share: '≈32%', assertion: '测试进度真实且可见' },
      { id: 'skills.actions', label: '保存/发布/安装', assertion: '不遮挡字段' },
    ],
  },
]

/** The three locked viewports plus the independent zoom pass. */
export const PARITY_VIEWPORTS = [
  { id: '1672x941', width: 1672, height: 941 },
  { id: '1440x900', width: 1440, height: 900 },
  { id: '390x844', width: 390, height: 844 },
]

/** Table columns: the dimensions `ui-acceptance.md` §45 requires per region. */
export const PARITY_COLUMNS = [
  '区域', '原型（位置/尺寸）', '实际（位置/尺寸）', '字体', '间距', '颜色', '密度', '滚动/焦点/遮挡', '判定', '备注',
]
