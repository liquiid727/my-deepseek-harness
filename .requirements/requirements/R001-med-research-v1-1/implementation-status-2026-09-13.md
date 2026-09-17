# R001 实现情况核对 — 2026-09-13

PRD 2.1.0 的八个 required Spec 均已批准设计，但八份 `acceptance.md` 的 decision 均为 blocked：当前为 **0/8 accepted**。设计批准、局部代码存在和整包验收通过是不同状态；不能据现有测试总数估算完成百分比。

| Spec | 代码中已有的主要能力 | 仍缺少的完整交付证据或行为 |
|---|---|---|
| [S01 项目工作台](specs/S01-project-workspace/spec.md) | Project/Session 绑定、项目管理、持久化概览、医学导航与首页；本次合并为 Hero 内唯一宿主 composer | Project/Mode/备份完整合同、独立 QA 与跨八包集成验收尚未完成；首页专项见[证据](specs/S01-project-workspace/evidence/home-composer.md) |
| [S02 文献发现](specs/S02-literature-discovery/spec.md) | 检索计划、确认、PubMed 查询、排序与保存链路 | 查询修改后旧批准状态失效、所有检索路径受批准约束等需补齐；完整筛选、重排、来源与失败流程待验收 |
| [S03 论文阅读](specs/S03-paper-reading/spec.md) | 文档解析、摘要与引用 focus 定位 | 完整 Reader、全文上下文、翻译、摘要、批注与笔记流程尚未完整落地 |
| [S04 证据与主张](specs/S04-evidence-claims/spec.md) | Evidence 保存、定位、校验与部分状态管理 | Claim 门控与真实模型输出、证据比较及端到端引用约束待完整实现和验证 |
| [S05 可复现统计](specs/S05-reproducible-statistics/spec.md) | 隔离 Runner、批准与分析产物后端；Dataset profile 界面 | 完整分析结果、图表、运行历史与复现导出界面尚不完整 |
| [S06 知识库](specs/S06-knowledge-library/spec.md) | 依赖已有 Paper/Evidence 基础能力 | 跨实体知识管理与检索/RAG 的完整用户流程未交付 |
| [S07 技能中心](specs/S07-skills-center/spec.md) | 首页保留带原因的禁用入口 | 技能发现、创建、测试、安装和权限生命周期未完整交付 |
| [S08 证据写作](specs/S08-evidence-writing/spec.md) | 依赖已有 Evidence/引用基础能力 | 基于 Verified Evidence 的写作、翻译、引用与导出流程未完整交付 |

核对依据是各 Spec、Test Design、acceptance、历史 implementation evidence，以及医学客户端的首页、Research、Papers、Evidence、Statistics 实现。该表是工程盘点，不是独立 QA；S02–S08 没有在本轮修改或重新验收。它们保留历史规范 bundle 绑定；S01 2.1.1 的首页修订不会自动批准其他包的证据。
