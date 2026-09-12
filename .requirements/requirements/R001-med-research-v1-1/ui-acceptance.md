# R001 原型与 UI 验收约束

本文件随 [PRD](prd.md) 2.1.0 批准；业务输入和状态由各 Spec 拥有。原型为仓库 [asset](../../../asset/) 的五张图片，示例身份、数字、论文、时间与模型名称不是真实数据要求。

## 共用视觉与宿主映射

DSH 拥有 sidebar、Project/Session browser、顶部宿主控件和 composer；医学插件通过 additive slots 提供品牌与五项主导航。允许将原型独立图标轨道与 Project 列表合并为宿主 sidebar 内两个清晰分组，允许宿主字体与账户/连接控件布局；不得丢失五个入口、当前 Project 标识、会话入口或正文空间。原型通知铃铛只映射宿主已有通知能力，不新增通知产品；全局搜索映射宿主搜索，文献搜索由文献库入口提供。模型选择显示真实可用模型，不能硬编码原型名称。原型全网检索在 V1 显示为已声明 PubMed 检索范围，不暗示未实现的数据源。

业务区使用统一 4/8/12/16/24/32px 间距阶梯，主要面板间距 12–24px，正文 14–16px、辅助文字不低于 12px，页面标题 24–32px、首页 Hero 36–48px。Reader 英文正文 16–18px serif、行高 1.5–1.7、每行约 55–85 字符；UI 使用宿主字体。圆角 8–16px，细边框、至多两级阴影，医学蓝主操作，支持绿/反对红/不确定灰/冲突橙，所有状态另有文本或图标。使用 SVG/icon system，不使用 emoji 最终图标。

所有页面固定三个视口 1672×941、1440×900、390×844，浏览器 100% zoom、DPR 1；另独立验证 200% zoom。1672 首屏必须符合下表密度；1440 可缩间距或滚动但不改变信息顺序；390 仅数据表/代码/快捷栏允许局部水平滚动，页面不横溢。断点：业务可用宽度 ≥1000px 展示多列，700–999px 次要右栏改 drawer，<700px 单列/tab。宿主 sidebar 宽度由宿主管理，以剩余业务宽度应用断点。

多列各自可滚动，sticky 标题/操作/composer 必须预留实际高度，最后一项可完整滚入且不被覆盖。主操作触控目标至少 44×44px；键盘 Tab/Enter/Space 可完成流程，Esc 关闭 drawer/popover 并恢复触发焦点；选区操作有键盘等价入口。正文对比度 ≥4.5:1、非文本控件 ≥3:1；reduced motion 禁用非必要运动；所有文案与无障碍名称使用 zh/en 字典。

每个可见按钮必须连到公开服务、宿主动作或有确定原因的禁用状态。Loading 保留区域和阶段；empty 有可完成的下一步；partial 保留成功记录；failure 保留输入并可重试。禁止静态卡、假进度、占位列表或“后续完善”代替 V1 能力。

## 五个截图场景

| 场景 / 原型 / Owner | 前置数据与操作 | 1672×941 的阻塞断言 | 状态与窄屏 |
|---|---|---|---|
| UI-HOME / [首页](../../../asset/首页.png) / S01 | 创建两个 Project，其中一个含通过服务写入的 Paper/Evidence/Dataset/Run/Chart，切换至该 Project；填写研究问题 | 当前 Project、Hero、问题框与发送、五个快捷入口、五项计数、三列 Research/Reader/Statistics 卡和灵感栏同屏；计数等于服务；输入是主要操作 | 空项目计数为 0；单域失败为未知；390 卡单列、计数两列，顶部输入和创建项目可达 |
| UI-RESEARCH / [搜索研究](../../../asset/搜索研究.png) / S02+S04+S03 | 用获批公开论文案例完成查询确认、检索和验证；选择一个 Evidence | 结论、总体关系与三类计数、筛选和至少两张完整 Evidence 卡可见；结果主列约 52%、紧凑 Reader 约 48%；右栏同时显示 Paper metadata、章节与高亮文本 | 另截 plan edit、searching、empty、partial、失败；390 Results/Evidence/Source 切换保留选中 ID；引文与卡片打开同一 anchor |
| UI-READER / [论文阅读器](../../../asset/论文阅读器.png) / S03 | 上传可合法使用的 PDF，打开真实正文，选区翻译，保存 Note，再打开助手 | metadata、目录、正文、助手同时可见；业务列宽约 14%/48%/38%；正文至少两段、选区工具条、结构摘要和一条 Note 同屏；三种阅读模式和 zoom 控件可见 | 另截 abstract-only、parse failure、translation failure、stale anchor；390 为 Content/Assistant/Notes tabs 和目录 drawer，选区浮层不出界 |
| UI-STATS / [统计lab](../../../asset/统计lab.png) / S05 | 导入合成 CSV/XLSX，修正类型，生成 Logistic 计划和代码，审阅并批准真实 Runner 运行 | Dataset 约 30%、分析约 70%；前五行 preview、Variables、四块计划可见；成功态代码与结果表/Forest Plot 同屏对照，Execution & Provenance 可见；不能只用互斥 tab 隐去对照 | 另截 waiting/executing/failed/cancelled；390 顺序 Dataset→Plan→Approval→Code/Results/Charts→Provenance；结果禁用时说明原因 |
| UI-SKILLS / [skill工作台](../../../asset/skill工作台.png) / S07 | 本地目录装载 13 个定义；创建草稿并上传公开 sample PDF，启动受限测试 | Inventory/Builder/Preview 三列约 23%/45%/32%；搜索、状态筛选、至少三张卡、名称版本指令工具/schema、附件与真实测试进度可见；保存/发布/安装不遮挡字段 | 另截字段错误、测试失败/取消、扩权确认、升级失败；390 Inventory/Builder/Preview tabs 保留未保存内容和附件 |

上述比例针对业务区，允许 ±5 个百分点；不能以达到比例而截断主操作。首页宿主 composer 可收起或让 Hero 复用同一输入能力，不允许两个无区分的主输入。Research composer 固定在结果列底部，不覆盖 Reader。

## 控件动作与持久状态

首页快捷入口：PubMed 打开 S02 QueryPlan；Reader 打开文件选择/已保存 Paper；Evidence 打开 S04 表；Statistics 打开 Dataset/Run；Skills 打开 S07。核心卡使用相同目标。概览各计数打开对应项目列表，Analyses/Charts 打开 S05 历史与图表；灵感条使用本地研究问题目录，换一批轮换目录、点击只填入输入框不自动检索。项目回收站显示归档项并可恢复；顶部搜索/筛选/新增映射宿主列表动作，不显示空按钮。

Research 卡的保存写 membership，来源按钮打开 Connector 保存的 URL，选区保存调用 S04；二手引用与三种 relation 是独立徽标。Reader 收藏使用 S02 membership，引用复制使用确定性 Paper serializer，下载只下载用户获授权且已保存的文件，否则禁用说明；图表 tab 只显示源 Document 已解析的 figure，不能生成论文图表。Related 与 References 有查询来源和逐项不可解析状态。

Reader 全文/章节摘要需要用户显式请求；翻译模式对用户明确选择的文档/章节提交段落，保存输入版本。普通选区动作只发送选区，整篇问答只在用户选择整篇作用域后检索该文档。AI 摘要、翻译、Note 与 Evidence 不能混成一份原文。完整 Reader 与紧凑 Reader 共享 selection/focus，切换保留来源版本及滚动位置。

Statistics 顶部“确认并执行”仅在当前代码可审阅且审批有效流程下启用；成功后再次点击表示新运行并重新确认。导出 PNG/SVG 必须指向当前选中 run 的真实 Artifact。Skills 编辑/配置预览为同一 draft revision，测试附带 revision；发布后未安装不显示 active。市场指向受信本地目录；权限被 Mode 收紧时显示声明权限与有效权限差异。

Knowledge（S06）桌面 filter/list/detail，Writing（S08）outline/editor/citation inspector；复用以上 tokens。分别验证 empty、populated、search、partial、引用失效、窄屏和键盘，不因没有独立原型豁免业务 UI。

## 证据与判定

每个截图 run 记录当前源代码/worktree hash、profile 与配置 hash、服务数据 ID/version、模型/Connector/Runner 版本、浏览器/viewport/DPR/locale、操作 trace、console 和时间。使用真实 profile、Service/Remote/存储；组件 mock 仅补充局部验证。统计截图只用合成行，公开论文需记录来源。原型中的示例值不得被复制进服务结果。

同一 run 产出原型与实际截图并排比较，以及区域边界、字体、间距、颜色、密度、滚动、焦点和遮挡逐项记录。任一必需区域/操作缺失、假状态、跨 Project 数据、未声明宿主差异或遮挡主操作均为阻塞；纯抗锯齿差异不阻塞。五个场景可以在一个集成 run 内完成；失败状态可由可控 Provider 故障注入产生，但成功业务链不能以静态 mock 代替。
