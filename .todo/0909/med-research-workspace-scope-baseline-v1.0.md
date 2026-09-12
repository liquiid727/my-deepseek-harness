# Med Research Workspace — 范围基线 V1

## 当前产品合同

[R001 2.0 PRD](../../.requirements/requirements/R001-med-research-v1-1/prd.md) 是当前实现范围和验收标准的唯一产品合同。[能力与功能矩阵](med-research-workspace-capability-feature-matrix-v1.0.md) 中所有 P0/P1 已进入 R001；`asset/` 的五张原型是阻塞设计输入。

旧 V1.1 PRD/SPEC、历史阶段记录和现有实现只提供事实与证据，不能缩小 R001 2.0。实现状态也不能把未完成能力改写为 roadmap 或 conflict。

## V1 范围

V1 包含 Project、Research、Paper Reader、Evidence、Knowledge、Statistics、Skills、Writing 和必要的 DSH 平台扩展。P0 是首个可用里程碑；P1 完成后 R001 才能 accepted。Team Collaboration、Marketplace 商业交易、多租户细粒度权限和不受审查的远程 Skill 包不在 V1。

## UI 范围

医学业务继续由 out-of-tree 插件实现。DSH 可增加可复用的最小客户端扩展点，包括 additive 主导航和公开的右栏 client face；实现不得替换 `root`、整个 sidebar 或 shell，不得建立独立医学 Web 应用或 URL 路由。

原型验收覆盖页面区域、信息顺序、主次操作、卡片密度、间距、字体、颜色、图标、滚动、固定区和响应式行为。未在子 Spec 的 prototype-to-DSH 映射中预先列出的宿主差异不能在验收时作为豁免。

## 追踪规则

每个矩阵 P0/P1 条目必须映射到 R001 Requirement、子 Spec 行为和 AC。旧 S01-S05 Test Designs 已标记 stale；旧 Evidence 不绑定 2.0 Spec hash。R002 保留永久 ID，但不再提供 Skills 实现授权。
