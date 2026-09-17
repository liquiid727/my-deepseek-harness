# R001 Spec 评审与订正记录

日期：2026-09-12。评审者：Fairy。范围为 R001 Requirement Workspace 文档；未实现代码、未提交、未推送。评审依据是当前工作区 PRD、S01–S08、[能力矩阵](../../../.todo/0909/med-research-workspace-capability-feature-matrix-v1.0.md)及五张原型，保留已有未提交内容。

## 设计结论

PRD 2.1.0、S01 2.1.3、S02–S05 2.1.1、S06–S08 1.1.1 已完成共享上下文修订。八个 Spec 与 [index](index.yaml) 均为 review；[规范文件清单](contract-manifest.yaml) 固定 PRD、索引、八个 Spec 与五份规范附件的 SHA-256。

[覆盖表](coverage.md)包含 193 条细化功能记录及 27 条矩阵原名对照；全部 18 个 REQ、16 个 AC 有主责与参与责任。13 个内置 Skill 均必交；P0 完成不能代替完整 P1 验收。五张原型已转为三个视口的场景、操作、布局密度与截图判据。

关键订正为：统计先生成代码再审批，审批绑定版本；Reader 通过单向动作贡献接入 Evidence；S03 唯一拥有 Note、S06 唯一拥有 Draft；个人库与当前 Project RAG 分域；证据资格、二手追踪与引用失效明确；Skill 定义/测试/发布/安装分离；用户编辑事实后必须重新验证。设计细节各有唯一规范附件，旧历史证据不被改写。

71 个计划 TEST 覆盖 31 个 Spec 行为，Test Designs 均为 review。spec-to-test 要求人工评审生成的测试设计，因此本轮未把它们设为 approved。[根验收](acceptance.md)与各子包继续 blocked，promotion denied。S01 的 REVIEW-R001-S01-002 实现视觉问题保持 open；其他尚未执行的交付评审也未被宣称通过。

## 本轮实际验证

| 检查 | 实际结果 | 范围与限制 |
|---|---|---|
| R001 专项只读 Node 检查 | PASS | 8 Spec、31 行为、71 TEST、220 覆盖/对照行；YAML/链接/唯一 ID、依赖无环、Spec/Test/Review/QA 版本及 hash、批准/QA 状态 |
| 矩阵 P0/P1 原名对照检查 | PASS | 扫描含 P0/P1/✅ 的 152 个源表行，coverage 未缺原名；只是追溯检查，业务完整性由逐项合同评审补充 |
| 规范附件清单 hash 检查 | PASS | 全部文件 hash 与 bundle hash 一致 |
| git diff --check -- .requirements/requirements/R001-med-research-v1-1 | PASS | 目标范围无空白错误；新增文件另查单一尾换行 |
| pnpm run test:docs | FAIL | 12 passed、3 failed：范围外 translation pairing、Agent Note format、documentation standard tests |
| pnpm run doc-sync | FAIL | 23 passed、10 failed：范围外 doc graphs、Cordis/client/tool/config catalogs、translation pairing、subsystem pages、tsconfig paths、Agent Note format、documentation standard tests |
| pnpm run lint | FAIL | host build 完成；范围外 skeleton.client.spec.tsx:188 unbound-method 错误，另有 views.tsx 未使用 disable 警告 |
| 范围外文件内容指纹 | PASS | git 跟踪及非忽略未跟踪文件（排除 R001）的排序内容 SHA-256 在本轮前后相同：fcd398b055b982f64c9683b424db81f3f49d605a1208f3b90e146946cb51c4e0 |

仓库级失败涉及现有 Workbench README/服务分类、生成目录与工具清单、Python 中文链接、医学首页 Agent Note、已有 UI 测试。未修改这些范围外文件，也未为通过门禁重新生成它们。仓库通用 Markdown gates 未覆盖 .requirements，因此不能用其通过代替本轮专项检查。

## 未执行与后续验收

本轮没有业务单测、真实 profile 操作、浏览器截图、Runner 业务执行或医学模型评估结果；文档门禁调用的基础构建不等于产品验收。实施者须依据 approved Spec 完成代码与记录；测试设计人工批准、医学 reviewer/Gold Set/检索阈值按[评估协议](evaluation.md)冻结后才能做正式质量判断。缺数据/阈值/结果时保持 blocked，不降低 V1 范围或以占位 UI 接受。
