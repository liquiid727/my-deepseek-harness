# Agent Note: 医学研究的项目本地 GoalSpec 工作区

Status: implemented

[English](2026-09-10-med-research-goalspec-workspaces.md) | 中文

## 问题

Med Research 插件已有一份整体式 V1.1 PRD 和 Spec、一份范围更广的能力矩阵，以及五张 UI 原型。如果没有稳定的需求工作区，维护者可能混淆已批准的 V1.1 行为与路线图提案，把原型当作实现约定，或在缺少当前验证证据和 QA 验收时宣称已经交付。

## 决策

仓库在 `.requirements/requirements` 中保存 Med Research 产品交付记录，并由 `.specos/manifest.yaml` 解析。R001 将已批准的 V1.1 范围规范化为五个按结果归属的子 Spec Package。R002 单独负责 Skills 探索，因为 Skill 编写、发布、安装、权限、版本、沙箱和评测需要 V1.1 范围之外的产品与安全决策。

原始 `.todo` PRD 和 Spec、能力矩阵及 `asset/` 中的文件继续作为输入。根 PRD 负责产品意图和验收标准；子 Spec 负责可交付行为；Test Design 规划独立验证；证据索引记录执行；review 文件记录问题；只有 acceptance 文件能够声明 QA 决策。UI 原型约束信息层级和视觉意图，但不能覆盖行为、可访问性、失败处理、安全或证据要求。

工作区使用 SpecOS `spec-only` 项目类型，因为现有 DeepSeek Harness 仓库继续负责构建、运行时组合、应用启动、测试和文档门禁。AI 编写的 Test Design 在人工批准前保持 draft。空证据索引、open review 和 blocked acceptance 防止把规划转换误报为已交付功能。

## 曾考虑的替代方案

**继续只用整体式 PRD 和 Spec 作为交付记录。** 这种方式文件更少，但无法让可独立交付的结果分别拥有生命周期、验证、评审和验收记录。

**把能力矩阵行或截图直接转换为实现任务。** 不采用，因为这些输入没有定义公共接口、错误行为、信任决策、兼容性或验收证据。

**把 Skills 工作区并入 R001。** 不采用，因为 Skills 需要单独批准安全、生命周期、兼容性和评测方案。

**初始化第二套全栈应用工作流。** 不采用，因为 DeepSeek Harness 已经负责应用与包架构。第二套运行时工作流会产生相互竞争的启动和验证规则。

## 后果

维护者通过 R001 或 R002 定位实现工作，并保留稳定的 Requirement、Spec、Test、Review 和 Acceptance ID。只有把当前执行结果按所属 Test ID 和精确 Spec 修订版规范化后，既有代码和测试才能作为验收证据复用。新增记录带来维护成本，但能明确范围变更、阻塞决策、剩余风险和交付声明。

已批准的 Spec Package 不会仅因为拆分而强制创建实现 Issue。精确 bug、回归或局部改动可以创建 Issue，但必须标明主要 Spec 和当前 Test 绑定。

## 验证

SpecOS manifest 检查和五个 R001 子包选择器均通过。YAML 解析、Spec 哈希绑定、Requirement 到 Spec 再到 Test 的可追踪性、占位符扫描和空白检查覆盖生成的工作区。仓库文档检查仍分别负责 Markdown、链接、双语配对和 Agent Note 规则。
