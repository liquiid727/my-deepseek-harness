# Med Research Workspace — 本地 PRD → Spec 执行入口

## 目标

把能力矩阵转成可追踪的产品需求、技术规格和阶段验收，不把矩阵表格直接当成实现任务清单。

## 执行顺序

1. 以 [范围基线](med-research-workspace-scope-baseline-v1.0.md) 判断矩阵条目属于当前契约、路线图、冲突或阻塞。
2. 当前契约从 [R001 GoalSpec Workspace](../../.requirements/requirements/R001-med-research-v1-1/prd.md) 进入；原 V1.1 PRD/SPEC 是其来源。
3. Skills 路线图由 [R002 草案](../../.requirements/requirements/R002-med-research-skills/prd.md) 持有，其他路线图能力建立独立 PRD。
4. R001 按 Project、Literature、Paper、Evidence/Claim、Statistics 五个业务结果建立 Spec；每个包独立持有 Test Design、Evidence、Review 和 Acceptance。
5. 只有存在批准的 Spec，才进入对应阶段的实现；测试和 Evidence 不替代 Spec。
6. 每个阶段完成后停下，按 `.todo/med-research-AGENTS.md` 的格式汇报真实命令、输出、约束检查和下一阶段入口。

## 当前阶段映射

| 阶段 | 产品结果 | 当前状态 |
|---|---|---|
| 0 | 基础恢复、DSH 边界、兼容性基线 | Bridge 聚焦测试通过；根 lockfile 问题独立跟踪 |
| 1 | Project 与医学领域基础 | 已实现；当前复验 15 files / 96 tests + typecheck 通过 |
| 2 | Research / PubMed vertical slice | 已实现并有 fixture、组合和真实运行记录 |
| 3 | Paper Reader 与全文归一化 | 核心实现完成；右栏 Reader 阻塞 |
| 4 | Evidence Engine 与 Claim Gate | Evidence 核心完成；Claim Gate 模型入口待定 |
| 5 | Statistics Lab 与隔离 Runner | 核心实现完成；P0 图表结果接线待定 |
| 6 | Medical UI | 四视图和 ToolView 已实现；列表/右栏部分完成 |
| 7 | Skills | Skill Center / Builder 属于后续 PRD |
| 8 | Bundle、Profile、Compatibility、E2E | 部分完成，整体 DoD 尚未接受 |

## 追踪入口

| 矩阵区域 | V1.1 需求入口 | Spec / 阶段入口 |
|---|---|---|
| Project / Workspace | US-001、FR-23 | SPEC §7、§32；阶段 1 |
| Research / PubMed | US-002、US-003、FR-1–4 | SPEC §17–20；阶段 2 |
| Paper Reader / Full-text | US-004、US-008、FR-5–6、FR-15 | SPEC §8–10、§21–22；阶段 3 |
| Evidence / Claim | US-005–007、FR-7–15 | SPEC §11–12、§24–29；阶段 4 |
| Statistics Lab | US-009–013、FR-16–20、FR-26 | SPEC §13–14、§33–38；阶段 5–6 |
| DSH UI | US-014、FR-24–25 | SPEC §42–45；阶段 6 |
| Settings / Runner | US-015、FR-19、FR-21 | SPEC §40、§46–51；阶段 5、8 |

矩阵中的 Evidence Table、Skill Center、Draft、扩展数据源和高级统计能力没有当前 V1.1 需求入口，状态保持为 `roadmap` 或 `conflict`，必须先建立后续 PRD。

## UI 验收分解

效果图对应以下可观察状态，而不是静态布局任务：

| 素材 | 验收状态 |
|---|---|
| `asset/首页.png` | 无项目、有项目、项目切换、概览计数和入口 |
| `asset/搜索研究.png` | 查询待确认、检索结果、证据支持/反对/不确定、部分失败 |
| `asset/论文阅读器.png` | 原文/翻译/双语、选区工具条、笔记和 Evidence 保存 |
| `asset/统计lab.png` | Dataset、Plan 待审批、执行成功/失败、结果和 provenance |
| `asset/skill工作台.png` | 后续 Skill PRD 的 Builder 参考；当前不承诺完整 Marketplace |

## 交付边界

当前执行授权 R001 的五个已批准子 Spec。不得因为效果图存在就新增独立前端、URL 路由、静态 mock 业务状态或 R002 及其他未经批准的路线图能力。
