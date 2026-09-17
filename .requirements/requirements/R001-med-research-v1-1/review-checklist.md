# R001 — 逐 Spec 交付评审 Checklist（Reviewer Working Doc）

生成日期：2026-09-17。配套 [human-gates.md](human-gates.md)，把 8 个 `review.md` 的待处置项
拆成评审人可逐条勾选的工作清单。本文件**不做任何评审/验收判定**：`review.md` `status`、
gate 勾选框、`acceptance.md` `decision` 一律由具名评审人/QA 自行填写；本文只登记现状与入口。

统计口径（本轮 `grep` 核对）：finding 级**仅 2 条 open**（`REVIEW-R001-S01-002`、
`REVIEW-R001-S02-003`）；其余各 Spec 均记「No delivery review has been performed / 尚未进行
实现交付评审」，即**交付评审本身未开展**，不等于无问题。

## A. 每包公共预检（评审人对每个 Spec 各做一次）

- [ ] **绑定自洽**：`review.md` frontmatter `source_spec_hash` == 现 `spec.md` 的 `shasum -a 256`。
      （本轮 8/8 已核：S01 `d345…acfc53b9…`、S02 `5f7b5e23…`、S03 `b05a847c…`、S04 `6ac9a90c…`、
      S05 `47120ab6…`、S06 `f5319040…`、S07 `fe49186e…`、S08 `8bde3b93…`；评审人复核即可。）
      注：`review.md` **正文**各「Spec Design Review — x.y.z」小节内联的「当前 Spec SHA-256」是
      该轮复核时的**历史快照**（如 S01 2.1.3 轮记 `e70176f4`，早于现值 `d345`），属冻结记录，
      **不改写**；只有 frontmatter 绑定当前版本。
- [ ] **contract bundle**：该 Spec `test.md` 声明的 `contract_bundle_hash` == 全局
      `24c463db…f9a8`（见 `contract-manifest.yaml`）。
- [ ] **evidence→requirement 覆盖**：逐 `TEST-R001-Sxx-NNN` 确认 `evidence/index.yaml` 有对应 run，
      且每条 run 的 `revision` 是**可 checkout 的提交**（非 `pending` / `worktree-*` / `document-*` 占位）。
- [ ] **完整性提醒**：S01 evidence 层的当前绑定 hash 本轮已从手写损坏值纠正；历史 `S01-home-composer-20260913`
      的 2.1.1 `spec_hash` 不可复现、已加说明并保留原值。评审人抽查其余各包历史 run 有无同类问题。

## B. 逐 Spec 卡片

### S01 — Project Workspace（review owner: med-research；`status: open`）
- [ ] **`REVIEW-R001-S01-002`（P1, open）— 唯一开放 finding。** 判据：真实 profile 截图证明 host
      composer **不再遮挡** S01 内容。Spec 明确「不能由合同订正关闭，须当前真实 profile 证据」。
      现有证据：`evidence/index.yaml` run `S01-ui-home-browser-matrix-20260917`（revision `62ca9fac79`，
      三视口 + 项目计数截图，见 `ui-home-20260917.md`）。**待评审人判定**：该组截图是否满足「composer
      clearance at scroll-end」子断言——本轮截图为 landing/empty 态，滚动末端的遮挡判定与
      同次原型并排对照未做，需评审人补判或要求补采。
- [ ] **设计重新批准**：`REVIEW-R001-S01-004` 2.1.3 轮 verdict 仍为 `review`（「尚需重新批准」），
      评审人须对当前 `spec.md`(`d345`) 重确认设计完整性并把设计态推进到 `approved`。
- [ ] Review Gate：`No blocking finding remains open` 目前**未勾**（因 002 open）；处置 002 后勾选。
- [ ] acceptance：填 `qa_owner`，复核覆盖后给 `decision`。

### S02 — Literature Discovery（review owner: **unassigned**；`status: open`）
- [ ] **指派 review owner**（现未指派）。
- [ ] **`REVIEW-R001-S02-003`（P1, open）**：五个设计界面 + 右侧 Reader parity 未完成；缺浏览器
      截图证据（Covers REQ-R001-009 / UI Presentation Contract）。现有证据：
      `evidence/browser-matrix-20260917.md`（**PARTIAL**：检索管线 live，但被 PubMed 公网 egress
      阻塞，见 C）。评审人须：(a) 明确「五个设计界面 + Reader parity」当前各自状态；(b) 在 egress
      打通后采 UI-RESEARCH 成功态截图再判 003；未满足前 003 保持 open。
- [ ] 交付评审：`REVIEW-R001-S02-002` impl checkpoint 已 resolved，但整体交付评审仍 `status: open`；
      评审人走查 evidence 后填 Review Gate 三个未勾框。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

### S03 — Paper Reading（review owner: **unassigned**；`status: open`）
- [ ] **指派 review owner**。
- [ ] **交付评审未进行**（正文：No delivery review has been performed）。评审人对当前实现 +
      `evidence/` 逐 TEST 走查，产出 `REVIEW-R001-S03-NNN`（若发现问题），填 Review Gate。
- [ ] UI-READER 矩阵格：`ui-acceptance.md` 场景 UI-READER/论文阅读器.png **未采**（成功态现实上依赖
      检索/导入路径，与 egress 相关）。评审人决定是否要求补采。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

### S04 — Evidence and Claims（review owner: **unassigned**；`status: open`）
- [ ] **指派 review owner**。
- [ ] **交付评审未进行**。评审人走查 evidence + 医学协议相关行为（PARTIAL/UNCERTAIN/二手引用/
      追踪失败状态），产出 findings，填 Review Gate。
- [ ] 医学评审依赖：Evidence/Claim 正确性属 Gold Set + Medical Reviewer 门禁（见 C 与 evaluation.md）。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

### S05 — Reproducible Statistics（review owner: **unassigned**；`status: open`）
- [ ] **指派 review owner**。
- [ ] **交付评审未进行**。评审人走查 evidence（七图正例、失败无产出、代码/图表同屏），填 Review Gate。
- [ ] UI-STATS 矩阵格 **未采**；且 S05 Runner 真写一次 Run+Chart 是 **UI-HOME 填充态前置**（见
      `ui-home-20260917.md` limitations）——评审人确认是否需要该种子数据。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

### S06 — Knowledge Library（review owner: Fairy；`status: open`）
- [ ] **交付评审未进行**（Delivery Review Gate 两项均未勾：当前实现与运行证据已独立评审 / 产品验收阻塞已关闭）。
- [ ] `reviewed_revision` 为 `document-dffb985a…`（文档 hash，非提交）；评审人补一个可 checkout 的实现 revision。
- [ ] 走查 evidence（Note/Draft 所有权、My Library 范围、FTS/RAG 失效规则），填 gate。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

### S07 — Skills Center（review owner: Fairy；`status: open`）
- [ ] **交付评审未进行**（同 S06 gate 未勾）。
- [ ] `reviewed_revision` 为 `document-6dc4afdc…`；评审人补可 checkout 的实现 revision。
- [ ] 走查 evidence（13 个内置 Skill 定义/测试/发布/安装四态、扩权与撤销、SKILLS 真测试）；UI-SKILLS
      矩阵格 **未采**。填 gate。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

### S08 — Evidence Writing（review owner: Fairy；`status: open`）
- [ ] **交付评审未进行**（同 S06 gate 未勾）。
- [ ] `reviewed_revision` 为 `document-796abbe…`；评审人补可 checkout 的实现 revision。
- [ ] 走查 evidence（编辑事实重验证、解除引用降级、翻译对齐、三格式导出字段/错误/并发失效），填 gate。
- [ ] acceptance：填 `qa_owner`，给 `decision`。

## C. 跨 Spec 外部阻塞（评审前先解除，否则成功链证据采不出）

- [ ] **PubMed 公网 egress**（owner：用户侧环境）：沙箱 DNS 把 `eutils.ncbi.nlm.nih.gov` 解析到
      `198.18.0.23`（`198.18.0.0/15` 代理段），被产品 SSRF guard 正确拒绝。真实公网 DNS 下才能采
      UI-RESEARCH 成功链（S02-003）与检索类指标。详见 S02 `browser-matrix-20260917.md`。
- [ ] **Medical Reviewer + 冻结 Gold Set + 三项阈值**（owner：产品负责人 / Reviewer）：AC-R001-016
      与 S04/S05/S07 医学链评估的硬前置。见 [human-gates.md](human-gates.md) 与 `evaluation.md`。

## D. 建议签核顺序（每包）

1. 指派 review owner（S02/S03/S04/S05 现为 unassigned）。
2. 公共预检 A（绑定/覆盖/revision 占位复核）。
3. 处置 open finding（S01-002、S02-003）或明确其外部前置（egress / Gold Set）。
4. 补齐该包 UI 矩阵格（READER/STATS/SKILLS，及 HOME 填充态）。
5. 勾选 Review Gate → `review.md status` open→通过（或记录带审批人/理由/期限的 waive）。
6. 指派 `qa_owner` → 复核 evidence→requirement → 签署 `acceptance.md decision`。
