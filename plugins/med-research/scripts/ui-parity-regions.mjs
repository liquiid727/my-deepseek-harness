/**
 * Region tables of the five prototype scenes (R001 `ui-acceptance.md`).
 * One row per region the run must compare; the capture script turns these into
 * the per-run parity table so nothing is compared from memory.
 * @module med-research/scripts/ui-parity-regions
 */

/**
 * One comparable region of one scene.
 * @typedef {object} ParityRegion
 * @property {string} id - Stable region id used in the table.
 * @property {string} label - Localized region name.
 * @property {string} assertion - Blocking assertion from `ui-acceptance.md`.
 * @property {string} [share] - Declared column share of the business area.
 */

/** The five prototype scenes with their regions. */
export const PARITY_SCENES = [
  {
    id: 'UI-HOME',
    owner: 'S01',
    asset: '../../../asset/首页.png',
    prerequisite: '两个 Project，其中一个含服务写入的 Paper/Evidence/Dataset/Run/Chart；切换至该项目并填写研究问题',
    regions: [
      { id: 'home.project', label: '当前 Project 条', assertion: '显示当前项目与状态，选中卡片有当前项目标识' },
      { id: 'home.hero', label: 'Hero', assertion: '标题与副标题同屏，Hero 是页面主视觉' },
      { id: 'home.input', label: '问题框与发送', assertion: '输入是主要操作，只有一个主输入' },
      { id: 'home.quick', label: '五个快捷入口', assertion: 'PubMed/Reader/Evidence/Statistics/Skills 五个，一行' },
      { id: 'home.counts', label: '五项计数', assertion: '计数等于服务值；单域失败为未知' },
      { id: 'home.cards', label: '三列能力卡', assertion: 'Research/Reader/Statistics 三列同屏' },
      { id: 'home.inspire', label: '灵感栏', assertion: '点击只填入输入框，不自动检索' },
      { id: 'home.projects', label: '项目区', assertion: '新建/列表/归档回收站可达' },
    ],
  },
  {
    id: 'UI-RESEARCH',
    owner: 'S02+S04+S03',
    asset: '../../../asset/搜索研究.png',
    prerequisite: '用获批公开论文案例完成查询确认、检索和验证；选择一个 Evidence',
    regions: [
      { id: 'research.conclusion', label: '研究结论', assertion: '结论与总体关系同屏' },
      { id: 'research.counts', label: '三类计数', assertion: '支持/反对/相关计数可见' },
      { id: 'research.filters', label: '筛选', assertion: '筛选可用且不裁掉结果' },
      { id: 'research.evidence', label: 'Evidence 卡（至少两张）', assertion: '至少两张完整 Evidence 卡' },
      { id: 'research.results', label: '结果主列', share: '≈52%' },
      { id: 'research.reader', label: '紧凑 Reader 列', share: '≈48%' },
      { id: 'research.composer', label: '结果列底部输入', assertion: '固定在结果列底部，不覆盖 Reader' },
    ],
  },
  {
    id: 'UI-READER',
    owner: 'S03',
    asset: '../../../asset/论文阅读器.png',
    prerequisite: '上传可合法使用的 PDF，打开真实正文，选区翻译，保存 Note，再打开助手',
    regions: [
      { id: 'reader.toc', label: '目录', share: '≈14%' },
      { id: 'reader.body', label: '正文', share: '≈48%', assertion: '至少两段、选区工具条同屏' },
      { id: 'reader.assistant', label: '助手', share: '≈38%' },
      { id: 'reader.meta', label: 'metadata 与结构摘要', assertion: 'metadata 与结构摘要同屏' },
      { id: 'reader.modes', label: '阅读模式与 zoom', assertion: '三种阅读模式与 zoom 控件可见' },
    ],
  },
  {
    id: 'UI-STATS',
    owner: 'S05',
    asset: '../../../asset/统计lab.png',
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
