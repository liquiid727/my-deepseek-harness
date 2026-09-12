# Agent Note: Med Research 完整 V1 的 GoalSpec 归属

Status: implemented

[English](2026-09-12-med-research-complete-v1-goalspec.md) | 中文

## Problem

Med Research 能力矩阵、五张产品原型、R001 Requirement Workspace 和实现入口对同一 V1 规定了不同范围和验收含义。原五包 Workspace 把多项 P0/P1 能力作为路线图，并用未展开的“原型层级”充当 UI 合同。因此，实现可以满足已写 Spec，同时缺失 Knowledge、Skills、Writing、Evidence Table、高级 Reader 行为和可见工作台结构。

## Decision

R001 2.0 拥有能力矩阵中的全部 P0/P1。P0 是中间可用里程碑；只有 P1 与八个 required Spec Package 全部接受后，R001 才能接受。S01 至 S05 保留永久身份和业务区域，S06 拥有 Knowledge，S07 拥有 Skills，S08 拥有基于证据的 Writing。现有 Test Design 和 Evidence 继续保留，但只有重新绑定 2.0 Spec 后才能使用。

每个矩阵条目映射到一个 Requirement、一个子 Spec 行为和一个验收标准。五张产品原型是阻塞设计输入。各自 Spec 定义 DSH 映射、区域、信息顺序、主要操作、密度、字体、语义颜色、图标、滚动、固定元素、状态变体和响应式行为。验收把同一次真实 profile 运行的截图与原型源视口并排比较，并验证桌面和窄屏适配；仅断言组件存在或使用静态业务 mock 不足以通过。

R002 保留永久 Requirement ID，但不提供 V1 Skills 实现授权。R001 S07 拥有已批准的 Skills 产品结果。Workspace 继续使用 spec-only GoalSpec：DSH 仍拥有构建、运行时组合、应用启动、测试和文档检查；子包 acceptance 与根 acceptance 仍是唯一 QA 决定。

## Alternatives considered

**保留五包 V1.1 范围，只改进 S01 CSS。** 这会继续让产品矩阵缺少实现授权，并在其余四张原型上重复合同与产品不一致的问题。

**为完整产品建立新的 Requirement。** 这会保留狭窄 R001，但会为同一 Med Research V1 建立两个相互竞争的定义。保留永久 R001 并提升版本，可以维持追踪且不产生并行产品真相。

**把 P1 当作不阻塞的路线图。** 这与已批准的完整 V1 范围冲突，并允许在 Skills、Knowledge、Writing 和高级研究能力缺失时完成最终验收。

**对原型验收使用像素差阈值。** 宿主字体和浏览器渲染会让阈值脆弱。按规定视觉属性记录并排评审，可以阻塞设计偏差，同时不把平台抗锯齿差异当作产品失败。

## Consequences

Requirement Workspace 规模扩大，交付按依赖排序，但每项要求的能力都有一个当前 owner。现有实现证据可以支持规划，却不能接受变化后的合同。维护者必须在 Spec 批准后重新生成 Test Design，并为每个用户可见包记录真实 profile 视觉证据。团队协作、Marketplace 商业交易、多租户授权和未评审远程 Skill 包仍不在 V1。
