# R001 — 人工验收门禁清单（Human Gate Tracker）

生成日期：2026-09-17。范围：R001 S01–S08 从「实现 + 自测」推进到「验收」所需的全部
**人工**决定与仍缺的真实证据。本文件只登记待办与现状，**不做任何批准/验收判定**；
`decision` 仍为 `blocked`，`promotion` 仍 `denied`，只有对应 `acceptance.md` 由 QA owner 签署后才变更。

## 当前门禁状态（逐层）

| 层 | 现状 | 依据 |
|---|---|---|
| PRD / Spec | 8/8 `approved`（2.1.0 / S01 2.1.3 …） | `index.yaml`、各 `spec.md` |
| Test Design | 8/8 `approved` | 各 `test.md` frontmatter `status: approved` |
| 交付评审 review.md | 8/8 `status: open` | 各 `review.md` |
| QA 验收 acceptance.md | 8/8 `decision: blocked`，`qa_owner: unassigned` | 各 `acceptance.md` |
| R001 根 | `decision: blocked` | 顶层 `acceptance.md` |
| 医学评估（AC-R001-016） | `blocked` | `evaluation.md` |

设计文档层已一致：每个 `spec.md` 的真实 SHA-256 == 其 `test.md`/`review.md` 声明的
`source_spec_hash`（本轮 8/8 校验通过）。全局 `contract_bundle_hash` = `24c463db…f9a8`。

## 阻塞验收的人工项（无法自动化，需具名人员/决定）

1. **指派并登记 Medical Reviewer。** 须具医学背景、独立于实现与生成模型；正式评估前在
   拥有该 Spec 的 `evidence/` 登记姓名、角色、审批日期、数据版本 + hash（`evaluation.md`）。
   Owner：产品负责人。
2. **产品负责人批准 Gold Set 覆盖与用途。** 模型自评分不可替代。Owner：产品负责人。
3. **冻结分层 Gold Set**（冻结后改样本规模/内容 → 版本化 + 受影响结果 stale）。冻结清单必须含：
   研究问题；可接受 query / 相关 Paper 标注；真实来源快照 + 许可；原文 anchors；目标 Claim；
   SUPPORT/AGAINST/UNCERTAIN 标签；二手引用标签；预期不足场景；13 个 Skill 的输入/输出评分规则。
   分层覆盖：PONV、队列/RCT/综述、Abstract/PDF/PMC、中英、冲突与无证据。样本规模由 reviewer 运行前
   按分层与置信度书面说明；不得看结果后删失败样本；训练/调试集与最终留出集不得混用。Owner：Medical Reviewer。
4. **冻结三项未定阈值**（`evaluation.md` 明确留待 reviewer 正式运行前定）：Recall@20 下限、
   Precision@20 下限、Counter Evidence Miss Rate 上限。其余阈值已在本协议内固定
   （Source Integrity=0、relocatability≥98% 且误接受=0、Relation≥0.85、Claim Support Precision≥0.85、
   Unsupported=0、Provenance=100%、P50≤90s/P95≤240s）。Owner：Medical Reviewer。
5. **逐 Spec 交付评审放行**：把 8 个 `review.md` 从 `open` 推进到通过（或记录 waive），含处置
   两条 open finding `REVIEW-R001-S01-002`（首页 composer 遮挡，须真实 profile 证据）与
   `REVIEW-R001-S02-003`（五界面 + Reader parity，缺浏览器截图）。逐包工作项见
   [review-checklist.md](review-checklist.md)。Owner：评审人（非实现者）。
6. **指派 QA owner 并签署 acceptance**：每个 `acceptance.md` 填 `qa_owner`、复核 evidence→
   requirement 覆盖后给出 `decision`。Owner：各包 QA。

## 仍需的真实证据（自动化 / 环境项，非纯人工判断）

- **PubMed 公网 egress（阻塞 research→reader→evidence 成功链）。** 当前沙箱 DNS 把
  `eutils.ncbi.nlm.nih.gov` 解析到 `198.18.0.23`（`198.18.0.0/15` 代理段），被产品 SSRF guard
  判非公网而拒绝；产品代码正确。需在真实公网 DNS 环境重跑，采集 UI-RESEARCH 成功态
  （结果卡、三类计数、Evidence 选择、ANSWER_READY）及检索类指标（Recall/Precision/Counter）。见
  [S02 browser-matrix](specs/S02-literature-discovery/evidence/browser-matrix-20260917.md)。
- **浏览器矩阵剩余格**（1672×941 主，另验 1440×900 / 390×844，独立 200% zoom + 同次原型并排对照）：
  UI-HOME ✅（空项目态，见 S01）；UI-RESEARCH ⛔ egress；UI-READER / UI-STATS / UI-SKILLS 未采
  （READER 成功态现实上也依赖检索/导入路径；STATS 真 Runner、SKILLS 真测试各自可能触边界）。
- **UI-HOME 填充态**：需 S05 Runner 真实写入一次 Run + Chart，使某 Project 呈现非零五项计数与
  单域失败为未知态。Owner：实现 + 环境。
- **医学链模型评估运行**：PR smoke 用冻结集每类的正/负/权限拒绝/不足例，完整验收跑全冻结集；
  逐指标报数并记失败/未运行项（依赖 egress + 冻结集）。

## 本轮已修正的证据完整性问题（供复核）

- S01 evidence 层的**当前绑定 hash 曾被手写损坏**，两处已按权威值纠正（共 17 + 16 处）：
  - `spec_hash` 尾部 `…cd56fb9ad2f764a92a4f7107a6` → 真实 `…acfc53b913055c90ab81ae68e8`（= `shasum` spec.md 2.1.3，且与 `test.md` 声明一致）。
  - `contract_bundle_hash` `6703ad87…`（无任何权威来源）→ 全局真实 `24c463db…f9a8`（见 `contract-manifest.yaml` 与全部 `test.md`）。
- 历史 `S01-home-composer-20260913`（2.1.1，`result: BLOCKED`）的 `spec_hash` 仍带同类可疑后缀
  `…56fb9ad2f764a92a4f7107a6`，但对应 2.1.1 spec.md 已被 2.1.3 覆盖、真实值不可复现；按「不改写已提交/历史证据」
  保留原值，仅加哈希核验说明。**建议评审人**：对其余 7 包历史 run 与 `review.md` 里的
  `reviewed_revision: worktree-*` 占位符一并复核/替换为可 checkout 的提交。
- S01 的 12 个 `worktree-20260917` 占位 revision 已统一到提交 `62ca9fac79`（该提交即其运行的工作树内容）。

## 建议的人工启动顺序

1. 产品负责人：定 Medical Reviewer + QA owner（解除 1/6 的角色空缺）。
2. 打通 egress 后我方可续采 research→reader→evidence 成功链与矩阵剩余格（解除证据类阻塞）。
3. Reviewer：冻结 Gold Set + 三项阈值（2/3/4）→ 运行医学评估。
4. 评审人：处置 review.md 各项（含 S01 视觉 finding）→ QA 签署 acceptance。
