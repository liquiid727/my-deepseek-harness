# Med Research Workspace 能力矩阵基线

## 定位

仓库根目录的 [能力与功能矩阵](../../../../.todo/0909/med-research-workspace-capability-feature-matrix-v1.0.md) 是产品长期路线图。[R001 GoalSpec Workspace](../../../../.requirements/requirements/R001-med-research-v1-1/prd.md) 把 V1.1 [PRD](../prd/med-research-workspace-ultimate-prd-v1.1.md) 与 [SPEC](../spec/med-research-workspace-ultimate-spec-v1.1.md) 规范化为当前实现与验收入口。矩阵条目不会仅因标记为 P0 而自动进入 V1.1。

## 状态定义

| 状态 | 含义 | 后续动作 |
|---|---|---|
| `implemented` | 当前代码已提供，且有对应测试或运行证据 | 保持与 V1.1 契约一致 |
| `partial` | 已有部分实现，但尚未满足完整用户结果或验收标准 | 进入 V1.1 收尾 Spec |
| `roadmap` | 矩阵提出，但当前 PRD/SPEC 未批准 | 先建立或修订 PRD，再生成 Spec |
| `blocked` | 已有契约，但缺少上游能力或待决公共接口 | 记录恢复条件，不建立替代实现 |

## 当前能力状态

| 能力域 | 状态 | 当前证据或缺口 |
|---|---|---|
| Project / Workspace | `implemented` | Project 创建、持久化、Workspace 注册、Session 绑定与上下文读取已有集成测试 |
| Research / PubMed | `implemented` | QueryPlan、PubMed fixture、去重、论文保存和真实 Research 链已有测试与运行记录 |
| Paper Reader | `partial` | 解析、归一化、定位和 Papers focus 已实现；右栏 Reader 受未发布 DSH 客户端包阻塞 |
| Evidence / Claim | `partial` | Evidence 状态、定位、验证和 citation serializer 已实现；Claim Gate 尚无模型入口 |
| Statistics Lab | `partial` | Dataset、审批、隔离执行、结果与 provenance 已实现；P0 图表结果契约和结果视图未接通 |
| Medical UI | `partial` | 四视图、工具卡片、设置和类型化 zh/en 文案已实现；列表读取与右栏席位未完成 |
| Skills | `roadmap` | Skill Center、Marketplace 与 Builder 不属于当前 V1.1 实现契约 |
| Writing / Collaboration / Advanced Sources | `roadmap` | Draft、团队协作、扩展数据源和高级统计按后续 PRD 管理 |

## PRD → Spec 规则

矩阵中的新能力按一个独立用户结果建立 PRD，PRD 必须定义范围、非目标、业务流程、可观察验收和优先级。PRD 批准后，Spec 定义服务接口、工具输入输出、持久化、错误、UI 状态与测试映射。实现只接受批准的 Spec，不从矩阵表格直接拆技术任务。

V1.1 收尾按 R001 的五个子 Spec 执行；原 PRD/SPEC 保留为来源文档。长期能力按以下业务结果分别进入后续 PRD：

- 完整 Paper Reader 与 Knowledge 浏览。
- [R002 Skill Center、Marketplace 与 Skill Builder](../../../../.requirements/requirements/R002-med-research-skills/prd.md)。
- Project RAG、扩展文献来源与 Reference Chasing。
- Draft / Writing、系统综述、Meta-analysis 与协作。

## UI 素材映射

根目录 `asset/` 中的效果图是视觉和交互参考，不是独立前端授权：

| 素材 | 当前工作面 | 验收重点 |
|---|---|---|
| `首页.png` | Project / Overview | 项目切换、真实计数、空状态 |
| `搜索研究.png` | Research / Evidence | 查询确认、部分失败、证据关系和原文定位 |
| `论文阅读器.png` | Paper Reader | 原文真源、翻译/双语、选区、笔记和 Evidence |
| `统计lab.png` | Statistics | 审批、代码执行、结果、图表和 provenance |
| `skill工作台.png` | Skills roadmap | 后续 PRD 的 Builder 与安装体验参考 |

所有 UI 继续使用 DSH 客户端插件扩展点，不增加 URL 路由、独立 Web 应用或替代 Shell。
