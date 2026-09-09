# Med Research Workspace — 终极版 PRD V1.1

**版本**：V1.1（V1.0 评审修订版）
**状态**：Implementation Ready
**底座**：DeepSeek Harness（DSH）
**定位**：医学科研 Evidence-First AI Workspace
**核心原则**：准确性第一、证据优先、所有重要结论可追溯到原文、统计结果必须来自真实代码执行。
**上游评审**：V1.0 见 [med-research-workspace-ultimate-prd-v1.0.md](med-research-workspace-ultimate-prd-v1.0.md)，修订依据见 [§0](#0-v11-变更摘要)。

---

## 0. V1.1 变更摘要

| # | 改动 | 原因 | 影响章节 |
|---|---|---|---|
| 1 | UI 承载方式统一为 **DSH 客户端插件**（`conversation.view` 视图 + 右栏 dock 页 + 工具卡片），删除 URL 路由假设 | DSH Web 无 router/page 扩展点，`root` 与顶栏为 single 席位 | §7、§29、§33；SPEC §42 |
| 2 | P0 收敛为「研究链 + 最小统计链」；Project 管理、Evidence Table、参考追踪、R、Draft 移入 P1；图表 P0 只留 4 种 | 原 P0 26 项且与 SPEC §61 的 Slice 排序自相矛盾 | PRD §34；SPEC §60–61 |
| 3 | 补 Evidence **归一化与对齐容差**规则；`verification_status` 拆为 `locator_status` + `support_status`；补抽取 provenance；定义 offset 基准 | 原规格会让「Verified Evidence Locator Integrity = 100%」无法验收 | §13；SPEC §22、§25 |
| 4 | 存储改为 `storage-domain`（SQLite backend）+ 项目目录文件；Postgres/pgvector/Redis 延后并明确由插件自管 | DSH 无关系/向量/Redis 能力，且无迁移框架 | §27；SPEC §15–16 |
| 5 | 统计 Runner 明确为**自建隔离执行器**；禁止把 DSH 实验 Python runtime 当数据集执行器 | 该 runtime 明确「不是安全边界」，无网络隔离与数据集挂载 | §24；SPEC §35–36 |
| 6 | 工具命名统一为扁平 snake_case | 点号名破坏 PTC 的 `tools.<name>(args)` | §30、§31；SPEC §6 |
| 7 | 新增「模型可见 ⟺ 已记录」约束与 project 上下文事件 | DSH 运行时 invariant 会拒绝未记录注入 | §32；SPEC §41 |
| 8 | Agent Mode 切换改用 `ctx.tools.restrict()` 动态允许列表 | preset 只能在会话未产出前切换 | §31；SPEC §39 |
| 9 | Citation Coverage 改为**结构门槛 + Gold Set 准确率**双轨 | 覆盖率不等于准确率，可被少写 claim 规避 | §16、§35 |
| 10 | 新增成本/时延预算、行级数据不进模型的隐私硬约束 | 原文档缺失 | §24、§32 |
| 11 | 新增用户故事 US-xxx 与功能需求 FR-N（可验证验收标准） | 便于 `/to-issues` 拆解为可实施 Issue | §37、§38 |

---

## 1. 产品一句话定义

> 面向医学科研人员的 AI Research Workspace：基于 PubMed / PMC / Europe PMC 等真实来源完成文献检索、论文阅读、证据抽取与结论验证，并基于用户真实科研数据完成统计分析、代码执行、表格和统计图输出。

本产品不是「医学版 ChatGPT」，也不是「医学版秘塔」的全量复刻。

产品真正解决的是两条可信链：

```text
科研问题 → 真实论文 → 原文证据 → 可验证结论
```

```text
真实数据 → 统计方案 → 真实代码 → 沙箱执行 → 统计结果 / 图表
```

---

## 2. 产品核心价值

### 2.1 文献研究价值

普通 AI：

```text
问题 → LLM 回答 → [1][2][3]
```

本产品：

```text
问题
→ Query Planning
→ PubMed Search
→ Candidate Papers
→ Abstract / Full Text
→ Evidence Retrieval
→ Support / Against / Uncertain
→ Claim Generation
→ Citation Verification
→ Final Answer
```

最终不只告诉用户「结论」，而是提供：

```text
Claim
├── Evidence #1
│   ├── Paper
│   ├── PMID / DOI
│   ├── Section / Paragraph / Offsets
│   ├── 原文
│   └── 原文定位
├── Evidence #2
└── Counter Evidence #1
```

### 2.2 统计分析价值

```text
CSV / XLSX
→ 数据概览
→ AI Analysis Plan
→ 用户确认
→ Python Code
→ 隔离环境真实执行
→ Table / Figure
→ AI Interpretation
→ 完整 Provenance
```

---

## 3. 产品原则

### P01 — Accuracy First

准确性和可核验性高于响应速度、回答长度和模型「看起来聪明」。

### P02 — Evidence First

任何重要医学科研结论必须先取得证据，再生成 Claim。

### P03 — Tool Grounding

论文事实只能来自：

- PubMed / PMC / Europe PMC 等已接入数据源
- 用户上传并成功解析的论文
- 明确接入的可信学术数据源

模型参数知识不能直接成为论文引用来源，也不能成为研究结论的依据；它只能用于生成检索线索（同义词、MeSH 候选），且必须标注为待检索验证。

### P04 — Claim → Evidence

重要 Claim 必须绑定一个或多个 `evidence_id`。

### P05 — No Evidence, No Claim

无可靠 Evidence 时，只允许输出：

> 当前检索结果不足以支持该结论。

### P06 — Evidence Transparency

必须明确区分：

- Full-text Direct Evidence
- Abstract Direct Evidence
- Secondary Citation
- Unverified Evidence

### P07 — Contradiction Matters

必须展示 SUPPORT / AGAINST / UNCERTAIN，不能只寻找支持用户预设观点的论文。

### P08 — Reproducible Statistics

任何统计结果必须可追溯到：

```text
dataset_hash
analysis_plan
generated_code
code_hash
runtime
package_versions
execution_result
```

---

## 4. V1 明确不做

- 医疗诊断
- 临床治疗建议
- 替代医生最终判断
- PubMed 全库 embedding
- 自建全球医学搜索引擎
- 全量复刻 Web of Science / Embase / JCR / SCIE / EI
- Sci-Hub 作为正式产品 Connector
- 绕过出版社授权抓取全文
- 自动代写整篇 SCI 并直接投稿
- 用模型常识填充不存在的研究结果
- 多 Agent 为了形式而互相对话
- **URL 路由 / 深链与独立前端应用**（V1 的 UI 承载方式见 §7、§33）
- **多租户团队协作与细粒度权限**（P2）
- **Postgres / pgvector / Redis 基础设施**（P2；P1 的向量检索用本地索引，见 §21、§27）

---

## 5. 目标用户

### Persona A：临床科研医生

任务：查 PubMed、找近 5 年研究、比较不同论文结论、找 Discussion 证据、对自己数据做 Logistic Regression、输出统计图。

### Persona B：医学研究生

任务：开题、文献综述、PICO / PECO、MeSH / Keyword、论文阅读、数据统计、论文图表。

V1 优先服务个人科研场景。

---

## 6. 核心 Jobs To Be Done

1. 我用中文描述研究问题，系统帮我生成透明、可编辑的 PubMed 检索式。
2. AI 给出结论时，我能直接看到原文证据，并跳转到对应论文位置。
3. 不同研究存在冲突时，系统同时展示支持、反对、不确定证据。
4. 我上传数据后，AI 先告诉我分析计划，再真实执行代码。
5. 任意统计表和图，都可以找到它对应的数据、代码和执行环境。

---

## 7. 信息架构与 DSH 身份映射

### 7.1 产品概念 IA

```text
Med Research
│
├── Projects
│   └── Project
│       ├── Research
│       ├── Papers
│       ├── Evidence
│       ├── Files
│       └── Statistics
│
└── Settings
```

### 7.2 DSH 身份映射（V1.1 新增）

产品概念不另造一套壳，而是映射到 DSH 已有实体，复用其工作区与会话导航：

| 产品概念 | DSH 对应物 | 说明 |
|---|---|---|
| Project | **Workspace** | 一个项目 = 一个项目目录；PDF / CSV / 产物落盘其中，复用 DSH 工作区列表与文件树 |
| Research Run / Statistics Run | **Session** | 一次研究或统计运行 = 一个会话，复用会话历史、流式与审批 UI |
| Paper / Evidence / Dataset / AnalysisRun / Artifact | **storage-domain 记录** + 文件 | 持久化在项目域，不依赖会话存活 |
| Agent Mode | 会话内工具允许列表 | 用 `ctx.tools.restrict()` 动态切换，不靠换 preset |
| Project 概览 / 论文列表 / 证据表 / 统计面板 | `conversation.view` 视图 | 见 §33 |

**约束**：DSH `SessionHeader` 没有自定义元数据字段。`projectId ↔ sessionId` 的绑定由插件自己的存储域维护；V1 直接以项目目录（Workspace 路径）作为项目键，避免额外的映射表。

---

## 8. Project

### 8.1 创建字段

- 项目名称
- Research Question
- Background
- Population
- Intervention / Exposure
- Comparison
- Outcome
- Keywords
- Notes

系统可以将自然语言问题辅助转换为 PICO / PECO / Core Concepts / MeSH Candidates。

### 8.2 项目目录约定

```text
<workspace>/
├── .medresearch/
│   ├── project.json          # 项目元数据
│   ├── papers/               # 上传或抓取的 PDF
│   ├── datasets/             # CSV / XLSX
│   ├── artifacts/            # 图表 / 表格导出
│   └── runs/                 # 每次 AnalysisRun 的代码与结果快照
└── ...
```

### 8.3 Overview

```text
PONV 与术后疼痛相关性研究

Questions      4
Papers        37
Evidence      18
Datasets       2
Analyses       6
Charts         8
```

---

## 9. Research Workspace

### 9.1 输入

用户：> PONV 与术后疼痛是否存在相关关系？

### 9.2 Query Planning

系统先生成：标准化研究问题、PICO / PECO、核心概念、同义词、MeSH Candidates、时间范围、Publication Type、PubMed Query。

```text
Concept A
"postoperative nausea and vomiting"
PONV

Concept B
"postoperative pain"
"pain severity"
```

```text
(
  "postoperative nausea and vomiting"[Title/Abstract]
  OR "PONV"[Title/Abstract]
)
AND
(
  "postoperative pain"[Title/Abstract]
  OR "pain severity"[Title/Abstract]
)
```

必须允许用户编辑 Query 后再执行。

---

## 10. 文献数据源

| 阶段 | 数据源 |
|---|---|
| V1 Discovery | PubMed |
| V1 / P1 Full-text Resolver | PMC、Europe PMC、Unpaywall、OpenAlex |
| 用户资料 | PDF 上传 |
| 不接入 | Sci-Hub、非授权全文爬虫 |

**实现约束**：PubMed 走 NCBI E-utilities GET（`ctx.web.fetch` 只支持 GET、有字符上限，需分页）；OA PDF 为二进制，`ctx.web.fetch` 会拒绝，需插件自带 HTTP 客户端。

---

## 11. 两级检索体系

本产品不将所有检索都叫 RAG。

### Level 1 — Literature Retrieval：哪些论文相关？

```text
Research Question
→ Query Planner
→ PubMed
→ Metadata Filter
→ Deduplicate
→ Rerank
→ Candidate Papers
```

主要能力：Boolean Search、MeSH、Date、Publication Type、Metadata、PubMed Rank、Rerank。

### Level 2 — Evidence Retrieval：哪一段原文真正支持这个结论？

```text
Paper
→ Abstract / Full Text
→ Section-Aware Parse
→ Section-Aware Chunk
→ Hybrid Retrieval
→ Rerank
→ Evidence Span
→ Locate & Verify
```

这里才使用 BM25 / Embedding / Hybrid Search / Reranker。向量索引仅针对当前论文、当前 Project、用户已保存论文，不对整个 PubMed 全库向量化。V1 向量检索可延后（见 §21）。

---

## 12. Search Result

每篇论文展示：Title、Authors、Journal、Year、PMID、DOI、Publication Type、MeSH、Abstract 状态、Full-text 状态、AI Relevance、Saved / Excluded。

操作：查看摘要、打开原文、保存到 Project、找证据、对比、添加 Note。

---

## 13. Evidence Engine

Evidence Engine 是产品最重要的能力。

### 13.1 Evidence 数据

```text
evidence_id
project_id
paper_id
document_id

source_type
fulltext | abstract | secondary_citation

section
paragraph_id
page

original_text
normalized_text

offset_base
start_offset
end_offset

relation
SUPPORT | AGAINST | UNCERTAIN

retrieval_score
rerank_score

locator_status
FOUND | PARTIAL | NOT_FOUND

support_status
PENDING | VERIFIED | REJECTED

extractor_version
extractor_model
prompt_version
created_at
```

**状态拆分理由**（V1.1）：能否重新定位原文是**确定性**事实，与语义是否支持 Claim 是两件事。原 `verification_status` 把二者混为一谈，导致「定位成功但语义存疑」无法表达。

- `locator_status`：`original_text` 能否在当前文档中重新对齐定位。
- `support_status`：该证据在语义上是否支持/反驳对应 Claim。

### 13.2 Evidence 不等于 Chunk

```text
Chunk → Candidate Evidence → Locate → Semantic Verify → Evidence
```

Chunk 只是检索单位；Evidence 是已经可定位、可验证的原始证据。

### 13.3 原文归一化与定位规则（V1.1 新增）

定位必须按固定规则执行，否则「Locator Integrity = 100%」无法验收：

1. **归一化**：Unicode NFKC；统一引号/破折号；连续空白折叠为单空格；软连字符与行末连字符还原；常见连字（ﬁ ﬂ 等）展开；大小写不敏感匹配。
2. **offset 基准**：`offset_base = 'normalized_paragraph'`，即 `start_offset` / `end_offset` 相对该段落 `normalized_text` 的字符偏移。文档级偏移不入库，避免重解析后失效。
3. **对齐**：先做精确匹配；失败后允许窗口对齐（滑动窗口 + 编辑距离阈值），阈值与窗口大小必须写进配置。
4. **结果**：完全匹配 → `FOUND`；窗口对齐成功但非精确 → `PARTIAL`；均失败 → `NOT_FOUND`。
5. **入库约束**：`support_status = VERIFIED` 只允许出现在 `locator_status ∈ {FOUND, PARTIAL}` 的 Evidence 上；`NOT_FOUND` 一律 `REJECTED`。
6. **UI 必须公开**：`PARTIAL` 证据必须显示「已定位但非精确匹配」。

### 13.4 抽取 provenance（V1.1 新增）

每条 Evidence 必须记录 `extractor_version / extractor_model / prompt_version`。理由：统计链要求代码可复现，证据链同理；否则「证据是怎么抽出来的」无法审计，Gold Set 复核也无法归因。

---

## 14. Evidence Levels

### A — Full-text Direct Evidence

来自全文，且能定位到 Results / Methods / Conclusion 等具体位置。

### B — Abstract Direct Evidence

当前只有 Abstract，但 Abstract 直接包含相关研究结果。UI 必须标识：

> Abstract Evidence — 当前未获取全文

### C — Secondary Citation

当前论文只是引用了另一个研究的观点。UI 必须标识：

> Secondary Citation — 尚未核验原始研究

系统后续可以追 Reference → DOI / PMID → 原始论文。

---

## 15. Claim Engine

```text
claim_id
project_id
research_query_id
claim_text

evidence_ids[]
counter_evidence_ids[]

evidence_status
SUFFICIENT | INSUFFICIENT | CONFLICTING

support_status
PENDING | VERIFIED | REJECTED
```

### Claim Gate

```text
Claim
↓ 有 Evidence ID？
↓ Evidence 存在？
↓ Evidence 的 support_status = VERIFIED？
↓ locator_status ∈ {FOUND, PARTIAL}？
↓ Paper 存在且 PMID / DOI / Uploaded Source 可追溯？
↓ original_text 存在且可重新定位？
↓ 语义方向与 Claim 一致？
↓ PASS / REJECT
```

失败 Claim 禁止进入最终科研结论。

---

## 16. Citation Verifier

必须检查：

1. Paper 标识真实存在于系统。
2. Evidence 属于该 Paper。
3. Evidence 原文可以按 §13.3 规则重新定位。
4. Claim 与 Evidence 语义方向一致。
5. SUPPORT / AGAINST 没有标反。
6. 没有把二手引用伪装成直接证据。
7. 最终重要 Claim 全部有 Citation。

**发布门槛（V1.1 改写）**：

```text
结构门槛：任何进入最终答案的 Claim，必须绑定 ≥1 条
          support_status = VERIFIED 且 locator_status ∈ {FOUND, PARTIAL} 的 Evidence。
准确率门槛：Claim Support Precision / Relation Accuracy 由人工 Gold Set 评估（§35、SPEC §53）。
```

不再使用「Citation Coverage = 100%」作为唯一门槛：覆盖率不等于准确率，且可以通过少写 Claim 人为满足。

---

## 17. Evidence Adequacy

不能简单用论文数量判断证据强弱。至少展示：Supporting / Against / Uncertain Studies、Full-text Direct Evidence Count、Abstract Evidence Count、Study Types、Sample Size（能提取时）、Publication Years、是否存在 Meta-analysis / Systematic Review、是否存在明显冲突。

内部摘要状态：`STRONG_SUPPORT / MODERATE_SUPPORT / WEAK_SUPPORT / INSUFFICIENT / CONFLICTING`。

> 这是产品内部 Evidence Summary，不等同正式 GRADE 证据评级。

---

## 18. Final Research Answer UI

```text
研究结论
────────────────────────────
目前证据不足以证明术后疼痛是 PONV 的独立危险因素。[1][2][3]

证据状态
CONFLICTING

支持证据       2
反对证据       3
不确定证据     1

证据来源
Full-text      2
Abstract       3
Secondary      1
```

点击 `[1]` 展示 Evidence #1：Paper、PMID、DOI、Source（section）、Original Text、Location（Results → Paragraph 4）、Relation、定位状态，以及 `[定位原文] [打开 PubMed] [打开全文]`。

---

## 19. Paper Reader

采用 Split View（DSH 中由右栏 dock 页承载，见 §33）：

```text
┌────────────────────────┬─────────────────────────┐
│ Research / Evidence    │ Paper Reader            │
│ Claim [1][2]           │ PDF / HTML              │
│ Support Evidence       │ ← 自动定位原文          │
│ Counter Evidence       │                         │
└────────────────────────┴─────────────────────────┘
```

支持：PDF、Structured HTML / XML、Abstract、Section Navigation、Search in Paper、Ask This Paper、Highlight Evidence、Save Evidence、Note。

---

## 20. Full-text Resolver

```text
PMCID
→ PMC
→ Europe PMC
→ Unpaywall
→ OpenAlex Best OA Location
→ Publisher URL
→ Abstract Only + Upload PDF
```

如果拿不到全文，必须清楚显示：

> 当前仅获得 Abstract。

---

## 21. Project RAG（P1）

```text
Saved Papers / Uploaded PDFs
→ Parse
→ Section
→ Chunk
→ BM25
→ （P1）Embedding
→ Hybrid Search
→ Rerank
→ Evidence
```

任何 Chunk 必须保留 locator：`paper_id / section / paragraph / page / offsets`。

**V1.1 说明**：V1 先做词法检索（BM25 / SQLite FTS），向量检索与 pgvector 延后到 P1，并作为插件自有能力实现（DSH 存储 seam 不含向量类型）。

---

## 22. Statistics Lab

### 22.1 上传

支持 CSV、XLSX。上传后生成 Dataset Profile：

```text
Rows / Columns / Missing / Variable Types / Unique / Range / Potential Anomalies
```

变量类型：Continuous、Ordinal、Binary、Categorical、Date、ID、Unknown。用户可以修正。

### 22.2 用户问题

> 术后疼痛是否与 PONV 有关联，并控制年龄、性别和阿片剂量。

系统先生成 Analysis Plan：

```text
Outcome:    PONV
Exposure:   Pain Score
Covariates: Age, Gender, Opioid Dose

Plan:
1. Descriptive Statistics
2. Missingness Check
3. Group Comparison
4. Logistic Regression
5. Adjusted Logistic Regression
6. OR + 95% CI
```

用户确认之后才执行。

---

## 23. Statistical Code

V1 语言：Python。允许：pandas、numpy、scipy、statsmodels、matplotlib、openpyxl。P1：R。

**禁止模型直接填写统计数值。**

---

## 24. Statistical Execution

```text
Analysis Plan
→ Generate Code
→ Static Policy Check
→ User Approval
→ Isolated Runner
→ stdout / stderr
→ Tables / Figures
→ Provenance
```

### Runner 硬约束（V1.1）

- No Network
- CPU / Memory / Timeout 限额
- 临时 FS
- 只读数据集挂载
- 受控输出目录
- 包白名单
- 无宿主密钥

### 执行器选型（V1.1）

**V1 使用自建隔离执行器**（容器或 bwrap/landlock 子进程），业务代码只依赖 `StatisticsRunner` 接口。

明确排除：

- DSH 实验包 `code-runtime-python` **不得**作为统计数据集执行器——其 README 明确「Containment — not a security boundary, model code has bash-equivalent trust」，只提供临时目录，无网络隔离、无只读数据集挂载、无包白名单。
- DSH `sandbox` 能力只管文件效果，不负责网络隔离。
- E2B 默认不用于患者数据（第三方云 + 现成配置无网络开关/白名单/只读挂载）；若使用，必须先完成隐私合规评估。

### 成本与失败

执行失败：`AnalysisRun.status = FAILED`。AI 只允许解释错误，不能编造统计结果。

每次研究查询与统计执行都必须有**成本/时延预算**（模型调用次数、token 上限、超时）；超预算时按部分成功降级，并显示真实失败原因。

---

## 25. Statistical Result

### Raw Result

真实执行输出：coefficient、OR、95% CI、p-value、diagnostics、table。

### AI Interpretation

只能基于真实 Raw Result 做解释。必须避免「统计关联 = 因果关系」的表述。

---

## 26. Charts

**P0**：Histogram、Box Plot、Bar Chart、Scatter。

**P1**：Forest Plot、ROC、Kaplan-Meier、Correlation Heatmap。

每张图保存 `artifact_id / analysis_run_id / dataset_hash / code_hash / runtime / created_at`，导出 PNG / SVG。

---

## 27. 可复现研究与存储

每次分析保存：

```text
analysis_run_id / project_id / dataset_id / dataset_hash
question / analysis_plan
language / generated_code / code_hash
runtime / python_version / package_versions
stdout / stderr / result_json
table_artifacts / figure_artifacts
status / created_at / finished_at
```

### 存储选型（V1.1）

| 层 | V1 方案 | 说明 |
|---|---|---|
| 结构化业务数据 | DSH `storage-domain`（SQLite backend） | 每个实体一个域表，schema 校验，写入即持久 |
| 大文件 | 项目目录 + 附件存储 | PDF / CSV / PNG / SVG |
| 全文检索 | SQLite FTS / 内存索引 | 仅项目范围 |
| 向量 | P1（本地索引） | DSH 无向量类型，由插件自管；Postgres/pgvector 基础设施延后到 P2 |
| 缓存 / 队列 | 进程内 + 文件 | Redis 延后到 P2 |

**版本与迁移**：DSH 存储没有迁移框架，版本不匹配是 fail-loud 拒绝。因此每个域必须自带 `version`，并提供导出/导入（备份）路径；升级前先导出。

---

## 28. Draft / Writing（P1）

允许：根据当前 Project 中 `support_status = VERIFIED` 的 Evidence 写一段 Literature Review。

规则：Draft 只能引用 VERIFIED Evidence；引用仍可点击回到原文。导出 Markdown / DOCX / BibTeX / RIS。

---

## 29. 基于 DSH 的产品架构

原则：不把业务逻辑硬改进 DSH Core，优先通过 Profile / Bundle / Plugin / Service / Tool 扩展。

```text
dsh-base
  ↓
dsh-web-app
  ↓
@medresearch/dsh-bundle-medical        # 纯数据：insert 插件行
  ↓
profile: med-research
```

业务插件：

```text
plugin-project        plugin-literature     plugin-paper
plugin-fulltext       plugin-evidence       plugin-dataset
plugin-statistics     plugin-artifact
plugin-medical-ui     （客户端插件，见 §33）
```

安装方式：

```sh
dsh plugin --profile med-research add @medresearch/dsh-bundle-medical
```

声明 `dsh.bundle` 的包会被自动加入 profile 的 layer 栈。

**架构边界（V1.1 明确）**：

- 不做独立前端应用；UI 是 `dsh-web-app` 之上的客户端插件。
- 不改 DSH Core；如未来确需 URL 路由，另立上游提案（见 §40）。
- patch 按 row id 整体替换 config，不做 deep merge。

---

## 30. Research Agent

V1 只做一个主 Research Agent：

```text
Research Agent
├── project_*
├── literature_*
├── paper_*
├── evidence_*
├── dataset_*
├── statistics_*
└── artifact_*
```

原则：Agent 负责决策与流程编排；Tool 负责确定性动作；Service 负责稳定业务能力。

不要一开始拆 PubMed Agent / PDF Agent / Citation Agent / Statistics Agent / Chart Agent 并让多个 Agent 互聊。

**命名约束（V1.1）**：工具名使用扁平 snake_case（如 `literature_search_pubmed`）。DSH 的 PTC 模式以 `tools.<name>(args)` 调用工具，点号命名会破坏该调用形式。

---

## 31. Agent Modes

| Mode | 允许的工具（前缀） |
|---|---|
| Research | `literature_*`、`paper_get`、`paper_resolve_fulltext`、`evidence_retrieve`、`evidence_verify`、`project_save_paper` |
| Paper | `paper_get_content`、`paper_search_content`、`evidence_retrieve`、`evidence_save` |
| Statistics | `dataset_profile`、`statistics_plan`、`statistics_generate_code`、`statistics_execute`、`artifact_export` |

**实现方式（V1.1）**：使用 `ctx.tools.restrict()` 注册会话内动态允许列表。不要用「切换 preset」实现模式切换——DSH 的 preset 只能在会话尚未产出内容前更换。

---

## 32. Agent Hard Rules

1. 不允许生成不存在的论文。
2. 文献必须来自 Tool Result。
3. PMID / DOI 不允许由模型自行拼写。
4. 重要 Claim 必须绑定 Evidence ID。
5. Evidence 必须保存 Original Text。
6. Full Text 与 Abstract 必须明确区分。
7. Secondary Citation 不能伪装 Direct Evidence。
8. 必须保留 Counter Evidence。
9. Evidence 不足时必须明确说不足。
10. 不允许仅凭模型参数知识填充研究结果。
11. 统计分析必须基于真实 Dataset。
12. 统计数值必须来自真实执行结果。
13. Runner 失败时不允许输出统计结论。
14. 不隐藏统计错误。
15. 不把相关性描述为因果关系，除非证据明确支持。
16. **模型可见 ⟺ 已记录**：任何进入模型请求的项目上下文 / 证据事实，必须能从会话日志重建（走工具结果或会话事件），不得只存在于数据库。
17. **行级数据不进模型**：数据集的行级内容只允许进入隔离 Runner；模型只能看到 schema、profile 与聚合结果。

---

## 33. UI 承载方案与席位映射

### 33.1 选定方案

**方案 A：DSH 客户端插件。** 产品 UI 作为 out-of-tree 客户端插件包，插入 `dsh-web-app` 之上的 bundle 行，不修改 DSH Core。

### 33.2 席位映射

| 产品界面 | DSH 扩展点 | 说明 |
|---|---|---|
| Research / Papers / Evidence / Statistics 视图 | `conversation.view`（list, session） | 与 Chat / Trajectory 并列，会话头部出现视图切换 |
| Paper Reader / Evidence 详情 | `ctx.sidebarRightTabs.register()` + `sidebar.right.pane.tab` | 右栏 dock 页，可 split / float |
| Files | 复用 DSH 右栏文件树 | 项目目录即工作区目录，无需新增视图 |
| PubMed 检索、Dataset Profile、Analysis Run、Chart | `tool.call.toolview`（keyed by 工具名） | 每个工具的结果卡片 |
| 模式切换 / 项目切换 / 打开统计面板 | `conversation.session.header.actions` | 会话头部动作 |
| PubMed Key、Runner、限额 | `settings.section` | 设置页 |
| 长任务进度 / 部分失败提示 | `shell.overlay`（list, root） | 帧级浮层 |

### 33.3 明确的限制（必须接受）

1. **没有 URL 路由 / 深链**：刷新回到同一 shell，视图选择不进入浏览器历史。
2. **视图是会话作用域**：没有活跃会话时不显示业务视图；Project 概览需要一个「项目会话」承载。
3. **右栏状态 memory-only**：刷新后打开的标签重置。
4. **不能新增左侧导航段**：`sidebar.workspaces` 被会话导航占用，只有 `sidebar.footer.action` 是追加式。
5. **客户端打包**：DSH 没有对外发布的 client bundle preset，插件需自带打包配置；必须提供 zh / en 双语字典。

---

## 34. P0 / P1 / P2

### P0（V1.1 收敛）

**研究链**：Project 创建、Query Planner、PubMed Search、PMID / DOI Metadata、Search Result、Save Paper、Abstract Reader、PDF Upload、Basic PDF Parse、Evidence Retrieval、Evidence Original Text、Evidence Locator（FOUND/PARTIAL/NOT_FOUND）、SUPPORT / AGAINST / UNCERTAIN、Claim → Evidence、Citation Verifier、Final Answer 结构门槛。

**统计链**：CSV / XLSX、Dataset Profile、Analysis Plan、Python、Isolated Execution、Result Table、4 类图表、Analysis Provenance。

**UI**：4 个业务视图 + 右栏阅读器 + 工具卡片 + 设置页。

### P1

PMC、Europe PMC、Unpaywall、OpenAlex、Hybrid Project RAG（含向量）、Evidence Table、Reference Chasing、Counter Search、R、Draft from Verified Evidence、BibTeX / RIS、Forest / ROC / KM / Heatmap。

### P2

Systematic Review Workspace、Screening Workflow、Meta-analysis、Citation Graph、Institutional Database Connectors、Team Collaboration、Postgres / pgvector / Redis 基础设施。

---

## 35. Release Gates

| Gate | 内容 |
|---|---|
| Gate 1 — Source Integrity | Paper 的 PMID / DOI 必须来自 Connector / Parser |
| Gate 2 — Evidence Locator Integrity | 所有 `support_status = VERIFIED` 的 Evidence 必须 `locator_status ∈ {FOUND, PARTIAL}`，且能按 §13.3 规则重新定位 |
| Gate 3 — Claim Structure | 最终答案中每个 Claim 都绑定 ≥1 条满足 Gate 2 的 Evidence；无证据的 Claim 必须显式标注「证据不足」 |
| Gate 4 — Failure Honesty | 搜索、全文、解析、Evidence、统计任何步骤失败，都必须显示真实失败状态 |
| Gate 5 — Statistics Provenance | 每个统计数字和图都必须关联成功的 AnalysisRun |

**语义准确率**由人工 Gold Set 评估（Claim Support Precision、Relation Accuracy、Unsupported Claim Rate、Counter Evidence Miss Rate），不允许用模型自评分数代替。

---

## 36. MVP Definition of Done

### Research DoD

```text
中文研究问题
→ PubMed 真实 PMID
→ Paper
→ Abstract / Full Text
→ Evidence Span（可重新定位）
→ Claim
→ Citation Verify
→ 点击 Citation 定位原文
```

### Statistics DoD

```text
上传 CSV
→ Dataset Profile
→ Analysis Plan
→ 用户确认
→ Python 执行
→ 真实统计结果
→ 图表
→ Dataset / Code / Runtime 可追溯
```

两条链跑通，才算 V1 核心成立。

---

## 37. 用户故事与验收标准（US）

> 每条 AC 均可观察或可测试；UI 类故事包含浏览器验证项。

### US-001：创建并打开项目
**作为** 临床科研医生，**我希望** 用研究问题创建一个项目，**以便** 所有论文、证据和数据都归属该项目。

**验收标准：**
- [ ] 输入项目名称与 Research Question 后，`<workspace>/.medresearch/project.json` 生成且内容与输入一致
- [ ] 项目出现在 DSH 工作区列表，打开后进入该项目会话
- [ ] 项目概览显示 Questions / Papers / Evidence / Datasets / Analyses / Charts 计数
- [ ] 类型检查通过；浏览器中可见项目视图

### US-002：生成可编辑的 PubMed 检索式
**作为** 医学研究生，**我希望** 系统把中文问题转成 PICO / MeSH 候选和 PubMed Query，**以便** 我能先审阅再检索。

**验收标准：**
- [ ] 输入「PONV 与术后疼痛是否相关？」后，视图显示 normalized question、PICO、concepts、queries（至少 primary + broad）
- [ ] 每个 query 可编辑并重新执行
- [ ] 未点击执行前不发生 PubMed 网络请求
- [ ] 类型检查通过；浏览器中可见检索式编辑区

### US-003：执行 PubMed 检索并保存论文
**作为** 用户，**我希望** 看到真实 PMID 的结果列表并保存论文，**以便** 建立项目文献库。

**验收标准：**
- [ ] 检索返回的每条结果含 PMID，且 PMID 来自 E-utilities 响应而非模型输出
- [ ] 结果列表展示 Title / Authors / Journal / Year / PMID / DOI / Abstract 状态
- [ ] 「保存到项目」后论文写入项目域记录，重启后仍存在
- [ ] 网络超时或限流时显示可重试的真实错误，不显示空列表
- [ ] 类型检查通过

### US-004：解析论文并获取全文
**作为** 用户，**我希望** 系统解析全文并在拿不到时明确告知，**以便** 我知道证据来源等级。

**验收标准：**
- [ ] 上传 PDF 后生成 PaperDocument，`parseStatus ∈ {READY, PARTIAL, FAILED, ABSTRACT_ONLY}`
- [ ] 全文不可得时显示「当前仅获得 Abstract」
- [ ] 解析出的章节可导航，段落带 `order` 与 `page`
- [ ] 类型检查通过；浏览器中可见阅读器

### US-005：抽取并定位证据
**作为** 用户，**我希望** 每条证据都能定位到原文段落，**以便** 我核对结论。

**验收标准：**
- [ ] 每条 Evidence 保存 `original_text`、`offset_base`、`start_offset`、`end_offset`、`extractor_version`、`extractor_model`、`prompt_version`
- [ ] 归一化定位按 §13.3 规则产出 `locator_status ∈ {FOUND, PARTIAL, NOT_FOUND}`
- [ ] `NOT_FOUND` 的 Evidence 不进入最终答案
- [ ] 点击证据可滚动并高亮到对应段落
- [ ] 类型检查通过；浏览器中可见高亮

### US-006：展示支持 / 反对 / 不确定
**作为** 用户，**我希望** 同时看到三类证据，**以便** 避免只看到支持我预设观点的论文。

**验收标准：**
- [ ] 最终答案显示 SUPPORT / AGAINST / UNCERTAIN 计数
- [ ] 三类证据分别可展开
- [ ] 若仅有支持证据，UI 明确标注「未检索到反对证据」而非静默省略
- [ ] 类型检查通过；浏览器中可见三类分组

### US-007：Claim 通过引用校验
**作为** 用户，**我希望** 每条结论都绑定可验证证据，**以便** 我可以信任最终答案。

**验收标准：**
- [ ] 每个 Claim 的 `evidence_ids` / `counter_evidence_ids` 均指向存在的 Evidence
- [ ] 不满足 Gate 2 的 Claim 不进入最终答案，并记录 `reasons`
- [ ] 最终答案的每条 Claim 至少绑定 1 条 VERIFIED Evidence
- [ ] 类型检查通过

### US-008：点击引用定位原文
**作为** 用户，**我希望** 点击 `[1]` 跳到原文，**以便** 快速核对。

**验收标准：**
- [ ] 点击引用打开右栏 Paper Reader 并滚动到对应段落
- [ ] 面板显示 Paper / PMID / DOI / Section / Original Text / Location / Relation / locator_status
- [ ] 提供「打开 PubMed」「打开全文」按钮
- [ ] 类型检查通过；浏览器中可见定位结果

### US-009：上传数据集并生成 Profile
**作为** 用户，**我希望** 上传 CSV 后先看到数据概览，**以便** 确认变量类型。

**验收标准：**
- [ ] 上传 CSV / XLSX 后生成 Dataset Profile（rows / columns / missing / types / unique / range）
- [ ] 变量类型可手动修正并持久化
- [ ] 超过配置上限的文件被拒绝并给出明确提示
- [ ] 类型检查通过；浏览器中可见 Profile

### US-010：生成并确认分析计划
**作为** 用户，**我希望** 执行前先看到并确认分析计划，**以便** 我知道将跑什么统计。

**验收标准：**
- [ ] 提问后生成 AnalysisPlan（objective / outcome / exposures / covariates / steps / assumptions / warnings）
- [ ] 状态为 `WAITING_FOR_APPROVAL` 时不执行任何代码
- [ ] 用户确认后才进入代码生成
- [ ] 类型检查通过；浏览器中可见计划与确认按钮

### US-011：生成并执行统计代码
**作为** 用户，**我希望** 代码在隔离环境真实执行，**以便** 结果可信。

**验收标准：**
- [ ] 生成的 Python 代码经静态策略检查后才提交执行
- [ ] Runner 配置无网络、只读数据集、受控输出目录、CPU / 内存 / 超时限额
- [ ] 执行失败时 `status = FAILED`，保留代码与 stderr，不产生 result
- [ ] 执行成功时 result_json 由 Runner 产出，模型只做解释
- [ ] 类型检查通过

### US-012：查看统计结果与图表
**作为** 用户，**我希望** 看到真实统计结果和图表，**以便** 直接用于论文。

**验收标准：**
- [ ] 结果表展示 coefficient / OR / 95% CI / p-value / diagnostics
- [ ] 至少支持 Histogram、Box Plot、Bar Chart、Scatter
- [ ] 图表可导出 PNG / SVG
- [ ] AI 解释不出现因果表述
- [ ] 类型检查通过；浏览器中可见结果与图表

### US-013：查看 provenance
**作为** 用户，**我希望** 每个统计结果都能追到数据、代码和环境，**以便** 复现。

**验收标准：**
- [ ] 结果页展示 `dataset_hash`、`code_hash`、`runtime`、`package_versions`、`status`、时间戳
- [ ] 点击可查看生成的完整代码
- [ ] 任一字段缺失时显示为「缺失」而非隐藏
- [ ] 类型检查通过；浏览器中可见 provenance 面板

### US-014：视图切换与右栏阅读器
**作为** 用户，**我希望** 在项目视图之间切换并保持聊天可用，**以便** 边看结果边提问。

**验收标准：**
- [ ] 会话头部可切换 Research / Papers / Evidence / Statistics / Chat 视图
- [ ] 打开右栏阅读器不影响中心视图与聊天输入
- [ ] 无活跃会话时业务视图不渲染，且不报错
- [ ] 类型检查通过；浏览器中可见视图切换

### US-015：配置数据源与 Runner
**作为** 用户，**我希望** 配置 PubMed 与 Runner 参数，**以便** 合规且可控地使用。

**验收标准：**
- [ ] 设置页可配置 PubMed tool / email / API key、限流与超时
- [ ] 设置页可配置 Runner 镜像、CPU / 内存 / 超时与包白名单
- [ ] 未配置 API key 时检索仍可用，并在设置页提示速率限制
- [ ] 配置写入 DSH 设置域，重启后保留
- [ ] 类型检查通过；浏览器中可见设置项

---

## 38. 功能需求（FR）

- FR-1: 系统必须将自然语言研究问题转换为包含 PICO / PECO、核心概念、同义词、MeSH 候选与至少 primary、broad 两类 Query 的 QueryPlan。
- FR-2: 系统必须在用户显式确认后才向 PubMed 发起检索请求。
- FR-3: 系统必须仅使用 E-utilities 返回的 PMID / DOI 作为论文标识，不得采用模型生成的标识。
- FR-4: 系统必须按 PMID → DOI → PMCID → normalized(title + year) 的顺序去重论文。
- FR-5: 系统必须为每篇论文记录 `fulltextStatus ∈ {available, abstract_only, user_upload, unavailable}`。
- FR-6: 系统必须将论文解析为 PaperDocument、PaperSection、PaperParagraph 三层结构。
- FR-7: 系统必须为每条 Evidence 保存 `original_text`、`normalized_text`、`offset_base`、`start_offset`、`end_offset`。
- FR-8: 系统必须按 §13.3 规则计算 `locator_status ∈ {FOUND, PARTIAL, NOT_FOUND}`。
- FR-9: 系统必须禁止 `support_status = VERIFIED` 出现在 `locator_status = NOT_FOUND` 的 Evidence 上。
- FR-10: 系统必须为每条 Evidence 记录 `extractor_version`、`extractor_model`、`prompt_version`。
- FR-11: 系统必须将每条 Evidence 的关系标记为 SUPPORT、AGAINST 或 UNCERTAIN 之一。
- FR-12: 系统必须拒绝引用不存在的 `evidence_id` 的 Claim。
- FR-13: 系统必须在最终答案中为每个 Claim 绑定至少一条满足 Gate 2 的 Evidence。
- FR-14: 系统必须在证据不足时输出「当前检索结果不足以支持该结论」。
- FR-15: 系统必须将引用编号 `[n]` 由后端序列化器生成并映射到 `evidence_id → paper_id`。
- FR-16: 系统必须对每次研究查询与统计执行施加成本与超时预算，超预算时降级为部分成功。
- FR-17: 系统必须将行级数据集内容限制在隔离 Runner 内，不发送给模型。
- FR-18: 系统必须为每次 AnalysisRun 保存 `dataset_hash`、`code_hash`、`runtime`、`package_versions`、`stdout`、`stderr`、`result_json` 与状态。
- FR-19: 系统必须拒绝网络访问、白名单外依赖与宿主密钥进入 Runner。
- FR-20: 系统必须在 Runner 失败时保留代码与 stderr 且不产生统计结论。
- FR-21: 系统必须为业务数据提供导出与导入（备份）路径，并在域版本不匹配时 fail-loud。
- FR-22: 系统必须通过 `ctx.tools.restrict()` 实施 Agent Mode 的工具允许列表。
- FR-23: 系统必须将进入模型请求的项目上下文以工具结果或会话事件形式记录，保证可从会话日志重建。
- FR-24: 系统必须为所有客户端文案提供 zh / en 两套字典。
- FR-25: 系统必须在无活跃会话时不渲染会话作用域业务视图。
- FR-26: 系统必须为每个统计数字和图表记录其来源 AnalysisRun 标识。

---

## 39. 成功指标

- **证据可核验性**：人工抽检 50 条 VERIFIED Evidence，可重新定位率 ≥ 98%（`FOUND` + `PARTIAL` 计为可定位）。
- **引用完整性**：最终答案中无「无证据 Claim」；Gate 2 违反数 = 0。
- **结论准确性**：Gold Set 上 Claim Support Precision ≥ 0.85、Relation Accuracy ≥ 0.85（人工标注）。
- **统计可复现性**：同一 Dataset + 同一代码重跑，结果表数值一致率 100%。
- **失败诚实性**：抽样 20 次故障注入，100% 显示真实失败状态，无伪造结果。
- **时延**：单次研究查询 P50 ≤ 90s、P95 ≤ 240s（含 PubMed + 证据抽取，20 篇以内）。

---

## 40. 开放问题与假设

### 待决问题

1. Project 概览在没有活跃会话时如何呈现？候选：自动创建「项目概览会话」，或用 `shell.overlay` 打开概览浮层。**默认假设**：自动创建概览会话。
2. Gold Set 的标注流程与一致性评估由谁负责？V1 需要至少一名医学背景评审者。
3. 向量检索是否在 P1 引入，取决于 P0 的词法检索在 Gold Set 上的 Recall@20 是否达标。
4. 若未来确需 URL 深链，是否向上游提交「DSH 客户端 page/route 扩展点」提案（方案 C）。

### 技术假设

- DSH 版本锁定到已验证 commit；升级前跑 Compatibility Test。
- 客户端插件可自建打包配置（DSH 未对外发布 client bundle preset）。
- 统计 Runner 的自建隔离方案在目标操作系统上可用（Linux 容器或 bwrap；macOS 需另择方案）。
- 患者数据默认不出本机；若引入云 Runner，需先完成隐私合规评估。
