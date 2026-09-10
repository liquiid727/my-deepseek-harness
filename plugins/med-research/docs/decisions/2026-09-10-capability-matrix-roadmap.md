# 决策：能力矩阵作为长期路线图

- 状态：已实施
- 日期：2026-09-10
- 依据：V1.1 PRD §34、V1.1 SPEC §61/§64、`AGENTS.md` §1/§6

## 问题

能力矩阵扩大了 Paper Reader、Knowledge、Statistics、Skills 和 Writing 的产品范围，其中部分 P0 标记与 V1.1 PRD 的收敛范围及 SPEC 的 Slice 顺序冲突。直接按矩阵实现会形成第二套需求权威，并把缺少验收契约的长期能力混入 V1.1。

## 决定

R001 GoalSpec Workspace 将 V1.1 PRD/SPEC 规范化为五个按业务结果划分的执行与验收包；原文档保留为来源。能力矩阵作为长期路线图，使用 `implemented`、`partial`、`roadmap`、`blocked` 四种状态描述当前关系。新的矩阵能力必须先进入独立 PRD 或经批准的 PRD 修订，再由 Spec 获得实现授权。

R001 的 S01-S05 保留已经完成的 Research、Project、Evidence 和 Statistics 行为，并要求现有证据按子包 Test Design 规范化。UI 效果图用于验证真实服务状态和交互，不授权静态页面或独立前端。Skills 由 R002 草案持有，在安全、生命周期、兼容和评估问题解决前不授权实现。

## 放弃的方案

**用矩阵覆盖 V1.1。** 矩阵没有定义公共接口、持久化、错误、隐私、审批和测试契约，无法直接替代 PRD/SPEC。

**把矩阵逐行转换成开发任务。** 矩阵混合用户能力、页面动作和实现形态，逐行拆分会按技术层制造重复工作。

**先复刻五张效果图。** 静态页面不能验证 Project Context、Evidence Integrity、Runner 隔离和失败状态。

## 验证

- 阶段 1 聚焦测试覆盖 contracts、domain、storage 和 Project，共 15 个测试文件、96 个测试。
- 插件 Host 与 Client TypeScript 检查通过。
- 后续阶段继续按 `docs/checklists/stage-acceptance.md` 逐阶段验证。
- 本地 SpecOS CLI 的 `check` 解析 R001 与 R002；R001 的五个子包均有绑定 Spec 哈希的 draft Test Design、Acceptance、Review 和 Evidence 索引。
