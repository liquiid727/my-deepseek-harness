# Med Research Workspace 能力矩阵基线

## 当前合同

仓库根目录的 [能力与功能矩阵](../../../../.todo/0909/med-research-workspace-capability-feature-matrix-v1.0.md) 由 [R001 2.0 PRD](../../../../.requirements/requirements/R001-med-research-v1-1/prd.md) 转换为当前 V1 产品合同。矩阵中全部 P0/P1 均属于最终 V1；P0 是阶段里程碑，P1 完成后 Requirement 才能 accepted。

旧 PRD/SPEC 和本目录的阶段决策记录提供当前代码的实现事实，不能缩小 R001。R002 保留永久 ID，但 [S07 Skills Center](../../../../.requirements/requirements/R001-med-research-v1-1/specs/S07-skills-center/spec.md) 是 V1 Skills 的唯一实现合同。

## 当前实现状态

| 能力域 | 实现状态 | R001 owner |
|---|---|---|
| Project / Workspace / Workbench Shell | partial | S01 |
| Research / PubMed / Advanced Discovery | partial | S02 |
| Paper Reader / AI Reading / Selection | partial | S03 |
| Evidence / Claim / Evidence Table | partial | S04 |
| Statistics Lab | partial | S05 |
| Knowledge / Library / Notes / Drafts | partial | S06 |
| Skills Center / Builder | not implemented | S07 |
| Writing / Citation Export | partial | S08 |

状态只描述代码事实，不改变 Spec 范围或验收要求。

## UI 素材映射

原型基线自 2026-09-17 起为 `asset/0917/` 四张图；`asset/首页.png` 与 `asset/搜索研究.png` 已被取代。区域级断言见 [`ui-parity-regions.mjs`](../../scripts/ui-parity-regions.mjs)，场景表见 [`ui-acceptance.md`](../../../../.requirements/requirements/R001-med-research-v1-1/ui-acceptance.md)。

| 素材 | Spec owner | 阻塞验收 | 状态 |
|---|---|---|---|
| `0917/1.png` 项目概览 | S01 | 页头三件套、页内页签、六项计数、继续上次工作、最近双列、当前任务、单项目紧凑左栏、右栏项目助手 | 基线 |
| `0917/2.png` 会话 | S01/S02/S04 | 消息流、助手清单与发现、附件 chip、中栏 composer、L2 工作区树、右栏结果与森林图 | 基线 |
| `0917/3.png` 论文阅读器 | S03 | 目录/正文/右栏三列、阅读模式、选区工具条、右栏摘要与选中文本解析 | 基线 |
| `0917/4.png` 证据与笔记 | S04/S08 | 页内页签、筛选行、按论题分组、证据卡、L2 工作区树、右栏详情与操作条 | 基线 |
| `统计lab.png` | S05 | Dataset、Plan、Approval、Code、Result、Charts 和 provenance | 沿用（0917 未覆盖） |
| `skill工作台.png` | S07 | Inventory、Builder、Preview、test 和生命周期操作 | 沿用（0917 未覆盖） |
| `首页.png` / `搜索研究.png` | S01 / S02+S04 | 已被 `0917/1.png`、`0917/2.png`、`0917/4.png` 取代 | 已退役 |

每张图在 1672×941 与真实 profile 并排评审，并补 1440×900 和 390×844。布局、间距、字体、颜色、图标、密度、滚动、主操作和遮挡均是阻塞项；实现不得用静态 mock 或仅组件存在断言替代。

## 执行规则

实现只接受 review 通过的子 Spec。每个矩阵功能行必须映射到 Requirement、Spec 行为和 AC；发现缺口先修订合同。旧 S01-S05 Test Designs 为 stale，必须在 2.0 Specs 获批后重新生成和绑定。
