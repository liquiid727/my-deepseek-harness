# Med Research Workspace — PRD → Spec 执行入口

## 权威入口

从 [R001 2.0 PRD](../../.requirements/requirements/R001-med-research-v1-1/prd.md) 进入实现。能力矩阵用于逐行追踪，五张原型用于阻塞视觉验收；旧 PRD/SPEC 和阶段记录只作为实现事实来源。

## 子包顺序

1. S01 Project Workspace & Workbench Shell：Project、Session Context、首页、主导航、Mode 和恢复。
2. S02 Research Discovery：Query Planning、PubMed、筛选、Rerank、Counter Search 和 Related Papers。
3. S03 Paper Reader：真实全文、翻译、AI 阅读、选区工具、Note 和 Citation focus。
4. S04 Evidence & Claims：Evidence verify、Claim Gate、Evidence Table、冲突比较和 Reference Chasing。
5. S05 Statistics Lab：Dataset、Plan、Approval、Runner、结果、完整图表和 provenance。
6. S06 Knowledge & Library：Papers、Evidence、Notes、Tags、Search、Project RAG 和 Draft inventory。
7. S07 Skills Center & Builder：内置/自建 Skill、测试、本地发布、Workspace 安装和权限生命周期。
8. S08 Evidence-based Writing & Export：综述、学术翻译与 RIS/BibTeX/Markdown。

S02/S05/S07 可在 S01 后并行；S03 依赖 S02；S04 依赖 S02/S03；S06 依赖 S03/S04；S08 依赖 S04/S06。

## 执行门禁

每个 Spec 在 review 通过后才进入实现。实现必须更新 README/JSDoc、单元/契约/集成测试、模型可见 snapshot、真实 profile 浏览器证据和同次原型对照。五张原型的 1672×941 场景另验证 1440×900 和 390×844；静态 mock 和仅组件存在断言不能通过 UI 验收。

P0 完成只形成阶段里程碑；八个 required Spec 和全部 P1 接受后，R001 才能 accepted。
