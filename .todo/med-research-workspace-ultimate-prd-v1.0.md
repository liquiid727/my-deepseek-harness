# Med Research Workspace — 终极版 PRD

**版本**：V1.0  
**状态**：Implementation Ready  
**底座**：DeepSeek Harness（DSH）  
**定位**：医学科研 Evidence-First AI Workspace  
**核心原则**：准确性第一、证据优先、所有重要结论可追溯到原文、统计结果必须来自真实代码执行。

---

## 1. 产品一句话定义

> 面向医学科研人员的 AI Research Workspace：基于 PubMed / PMC / Europe PMC 等真实来源完成文献检索、论文阅读、证据抽取与结论验证，并基于用户真实科研数据完成统计分析、代码执行、表格和统计图输出。

本产品不是“医学版 ChatGPT”，也不是“医学版秘塔”的全量复刻。

产品真正解决的是两条可信链：

```text
科研问题
→ 真实论文
→ 原文证据
→ 可验证结论
```

以及：

```text
真实数据
→ 统计方案
→ 真实代码
→ 沙箱执行
→ 统计结果 / 图表
```

---

## 2. 产品核心价值

### 2.1 文献研究价值

普通 AI：

```text
问题
→ LLM 回答
→ [1][2][3]
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

最终不是只告诉用户“结论”，而是提供：

```text
Claim
├── Evidence #1
│   ├── Paper
│   ├── PMID / DOI
│   ├── Results / Discussion
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

准确性和可核验性高于响应速度、回答长度和模型“看起来聪明”。

### P02 — Evidence First

任何重要医学科研结论必须先取得证据，再生成 Claim。

### P03 — Tool Grounding

论文事实只能来自：

- PubMed / PMC / Europe PMC 等已接入数据源
- 用户上传并成功解析的论文
- 明确接入的可信学术数据源

模型参数知识不能直接成为论文引用来源。

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

必须展示：

- SUPPORT
- AGAINST
- UNCERTAIN

不能只寻找支持用户预设观点的论文。

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

---

## 5. 目标用户

### Persona A：临床科研医生

任务：

- 查 PubMed
- 找近 5 年研究
- 比较不同论文结论
- 找 Discussion 证据
- 对自己数据做 Logistic Regression
- 输出统计图

### Persona B：医学研究生

任务：

- 开题
- 文献综述
- PICO / PECO
- MeSH / Keyword
- 论文阅读
- 数据统计
- 论文图表

V1 优先服务个人科研场景。

---

## 6. 核心 Jobs To Be Done

1. 我用中文描述研究问题，系统帮我生成透明、可编辑的 PubMed 检索式。
2. AI 给出结论时，我能直接看到原文证据，并跳转到对应论文位置。
3. 不同研究存在冲突时，系统同时展示支持、反对、不确定证据。
4. 我上传数据后，AI 先告诉我分析计划，再真实执行代码。
5. 任意统计表和图，都可以找到它对应的数据、代码和执行环境。

---

## 7. 产品信息架构

```text
Med Research
│
├── Projects
│   └── Project
│       ├── Overview
│       ├── Research
│       ├── Papers
│       ├── Evidence
│       ├── Files
│       ├── Statistics
│       ├── Charts
│       └── Drafts
│
├── Research
├── Papers
├── Statistics
├── Files
└── Settings
```

所有核心资产优先属于 Project。

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

系统可以将自然语言问题辅助转换为：

- PICO
- PECO
- Core Concepts
- MeSH Candidates

### 8.2 Overview

示例：

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

用户：

> PONV 与术后疼痛是否存在相关关系？

### 9.2 Query Planning

系统先生成：

- 标准化研究问题
- PICO / PECO
- 核心概念
- 同义词
- MeSH Candidates
- 时间范围
- Publication Type
- PubMed Query

示例：

```text
Concept A
"postoperative nausea and vomiting"
PONV

Concept B
"postoperative pain"
"pain severity"
```

PubMed Query：

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

### V1 Discovery

- PubMed

### V1 / P1 Full-text Resolver

- PMC
- Europe PMC
- Unpaywall
- OpenAlex

### 用户资料

- PDF 上传

### 不接入

- Sci-Hub 正式 Connector
- 非授权全文爬虫

---

## 11. 两级检索体系

本产品不将所有检索都叫 RAG。

### Level 1 — Literature Retrieval

解决：

> 哪些论文相关？

```text
Research Question
→ Query Planner
→ PubMed
→ Metadata Filter
→ Deduplicate
→ Rerank
→ Candidate Papers
```

主要能力：

- Boolean Search
- MeSH
- Date
- Publication Type
- Metadata
- PubMed Rank
- Rerank

### Level 2 — Evidence Retrieval

解决：

> 哪一段原文真正支持这个结论？

```text
Paper
→ Abstract / Full Text
→ Section-Aware Parse
→ Section-Aware Chunk
→ Hybrid Retrieval
→ Rerank
→ Evidence Span
→ Verify
```

这里才使用：

- BM25
- Embedding
- Hybrid Search
- Reranker

向量索引仅针对：

- 当前论文
- 当前 Project
- 用户已保存论文

不对整个 PubMed 全库向量化。

---

## 12. Search Result

每篇论文展示：

- Title
- Authors
- Journal
- Year
- PMID
- DOI
- Publication Type
- MeSH
- Abstract 状态
- Full-text 状态
- AI Relevance
- Saved / Excluded

操作：

- 查看摘要
- 打开原文
- 保存到 Project
- 找证据
- 对比
- 添加 Note

---

## 13. Evidence Engine

Evidence Engine 是产品最重要的能力。

### 13.1 Evidence 数据

每条 Evidence 至少保存：

```text
evidence_id
paper_id
document_id

source_type
fulltext | abstract | secondary_citation

section
paragraph_id
page

original_text
normalized_text

start_offset
end_offset

relation
SUPPORT | AGAINST | UNCERTAIN

retrieval_score
rerank_score

verification_status
PENDING | VERIFIED | PARTIAL | REJECTED
```

### 13.2 Evidence 不等于 Chunk

```text
Chunk
→ Candidate Evidence
→ Exact Locate
→ Semantic Verify
→ Evidence
```

Chunk 只是检索单位。

Evidence 是已经可定位、可验证的原始证据。

---

## 14. Evidence Levels

### A — Full-text Direct Evidence

来自全文，且能定位到 Results / Methods / Conclusion 等具体位置。

### B — Abstract Direct Evidence

当前只有 Abstract，但 Abstract 直接包含相关研究结果。

UI 必须标识：

> Abstract Evidence — 当前未获取全文

### C — Secondary Citation

当前论文只是引用了另一个研究的观点。

UI：

> Secondary Citation — 尚未核验原始研究

系统后续可以追 Reference → DOI / PMID → 原始论文。

---

## 15. Claim Engine

每个 Claim：

```text
claim_id
claim_text

evidence_ids[]
counter_evidence_ids[]

evidence_status
SUFFICIENT
INSUFFICIENT
CONFLICTING

verification_status
PENDING
VERIFIED
REJECTED
```

### Claim Gate

最终答案前检查：

```text
Claim
↓
有 Evidence ID？
↓
Evidence 存在？
↓
Paper 存在？
↓
PMID / DOI / Uploaded Source 可追溯？
↓
Original Text 存在？
↓
Original Text 可定位？
↓
语义是否真的支持 Claim？
↓
PASS / REJECT
```

失败 Claim 禁止进入最终科研结论。

---

## 16. Citation Verifier

必须检查：

1. Paper 标识真实存在于系统。
2. Evidence 属于该 Paper。
3. Evidence 原文可以重新定位。
4. Claim 与 Evidence 语义方向一致。
5. SUPPORT / AGAINST 没有标反。
6. 没有把二手引用伪装成直接证据。
7. 最终重要 Claim 全部有 Citation。

最终科研回答要求：

```text
Citation Coverage = 100%
```

结构验证失败时，不允许生成“看起来完整”的回答。

---

## 17. Evidence Adequacy

不能简单用论文数量判断证据强弱。

至少展示：

- Supporting Studies
- Against Studies
- Uncertain Studies
- Full-text Direct Evidence Count
- Abstract Evidence Count
- Study Types
- Sample Size（能提取时）
- Publication Years
- 是否存在 Meta-analysis / Systematic Review
- 是否存在明显冲突

内部摘要状态：

```text
STRONG_SUPPORT
MODERATE_SUPPORT
WEAK_SUPPORT
INSUFFICIENT
CONFLICTING
```

注意：

> 这是产品内部 Evidence Summary，不等同正式 GRADE 证据评级。

---

## 18. Final Research Answer UI

示例：

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

点击 `[1]`：

```text
Evidence #1

Paper:
Acupressure Versus Ondansetron...

PMID:
XXXXXXXX

DOI:
xx.xxxx/xxxx

Source:
Results

Original Text:
“......”

Location:
Results → Paragraph 4

Relation:
AGAINST

[定位原文]
[打开 PubMed]
[打开全文]
```

---

## 19. Paper Reader

采用 Split View：

```text
┌────────────────────────┬─────────────────────────┐
│ Research / Evidence    │ Paper Reader            │
│                        │                         │
│ Claim [1][2]           │ PDF / HTML              │
│ Support Evidence       │                         │
│ Counter Evidence       │ ← 自动定位原文          │
│                        │                         │
└────────────────────────┴─────────────────────────┘
```

支持：

- PDF
- Structured HTML / XML
- Abstract
- Section Navigation
- Search in Paper
- Ask This Paper
- Highlight Evidence
- Save Evidence
- Note

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

## 21. Project RAG

Project RAG 是底层技术能力，不是产品核心卖点。

```text
Saved Papers / Uploaded PDFs
→ Parse
→ Section
→ Chunk
→ BM25
→ Embedding
→ Hybrid Search
→ Rerank
→ Evidence
```

任何 Chunk 必须保留 locator：

- paper_id
- section
- paragraph
- page
- offsets

---

## 22. Statistics Lab

### 22.1 上传

支持：

- CSV
- XLSX

上传后生成 Dataset Profile：

```text
Rows
Columns
Missing
Variable Types
Unique
Range
Potential Anomalies
```

变量类型：

- Continuous
- Ordinal
- Binary
- Categorical
- Date
- ID
- Unknown

用户可以修正。

### 22.2 用户问题

> 术后疼痛是否与 PONV 有关联，并控制年龄、性别和阿片剂量。

系统先生成 Analysis Plan：

```text
Outcome:
PONV

Exposure:
Pain Score

Covariates:
Age
Gender
Opioid Dose

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

V1 语言：

- Python

允许：

- pandas
- numpy
- scipy
- statsmodels
- matplotlib
- openpyxl

P1：

- R

禁止模型直接填写统计数值。

---

## 24. Statistical Execution

流程：

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

Runner：

- No Network
- CPU Limit
- Memory Limit
- Timeout
- Temporary FS
- Read-only Dataset Mount
- Scoped Output Directory
- Package Allowlist

执行失败：

```text
AnalysisRun.status = FAILED
```

AI 只允许解释错误，不能编造统计结果。

---

## 25. Statistical Result

必须分为：

### Raw Result

真实执行输出：

- coefficient
- OR
- 95% CI
- p-value
- diagnostics
- table

### AI Interpretation

只能基于真实 Raw Result 做解释。

必须避免：

> 统计关联 = 因果关系

---

## 26. Charts

V1 支持：

- Histogram
- Box Plot
- Bar Chart
- Scatter
- Forest Plot
- ROC
- Kaplan-Meier
- Correlation Heatmap

每张图保存：

```text
artifact_id
analysis_run_id
dataset_hash
code_hash
runtime
created_at
```

导出：

- PNG
- SVG

---

## 27. Reproducible Research

每次分析保存：

```text
analysis_run_id
project_id
dataset_id
dataset_hash

question
analysis_plan

language
generated_code
code_hash

runtime
python_version
package_versions

stdout
stderr
result_json

table_artifacts
figure_artifacts

status
created_at
finished_at
```

---

## 28. Draft / Writing（P1）

允许：

> 根据当前 Project 中 VERIFIED Evidence 写一段 Literature Review。

规则：

```text
Draft 只能引用 VERIFIED Evidence。
```

引用仍然可以点击回到原文。

后期导出：

- Markdown
- DOCX
- BibTeX
- RIS

---

## 29. 基于 DSH 的产品架构

原则：

> 不把业务逻辑硬改进 DSH Core，优先通过 Profile / Bundle / Plugin / Service / Tool 扩展。

结构：

```text
dsh-base
  ↓
dsh-web-app
  ↓
@medresearch/dsh-bundle-medical
  ↓
profile: med-research
```

业务插件：

```text
plugin-project
plugin-literature
plugin-paper
plugin-fulltext
plugin-evidence
plugin-dataset
plugin-statistics
plugin-artifact
plugin-medical-ui
```

---

## 30. Research Agent

V1 只做一个主 Research Agent。

```text
Research Agent
├── project.*
├── literature.*
├── paper.*
├── evidence.*
├── dataset.*
├── statistics.*
└── artifact.*
```

原则：

> Agent 负责决策与流程编排。  
> Tool 负责确定性动作。  
> Service 负责稳定业务能力。

不要一开始拆：

- PubMed Agent
- PDF Agent
- Citation Agent
- Statistics Agent
- Chart Agent

让多个 Agent 互聊。

---

## 31. Agent Modes

### Research Mode

允许：

- literature.plan_query
- literature.search_pubmed
- paper.get
- paper.resolve_fulltext
- evidence.retrieve
- evidence.verify
- project.save_paper

### Paper Mode

允许：

- paper.get_content
- paper.search_content
- evidence.retrieve
- evidence.save

### Statistics Mode

允许：

- dataset.profile
- statistics.plan
- statistics.generate_code
- statistics.execute
- artifact.export

Tool Allowlist 根据当前 Workspace 控制。

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

---

## 33. UI 页面

### Project Dashboard

- Research Question
- Papers
- Evidence
- Datasets
- Analyses
- Charts
- Recent Activity

### Research

左：

- Answer
- Claims
- Evidence
- Sources

右：

- Paper Reader

底：

- Research Input

### Papers

- List
- Filter
- Tags
- Fulltext Status
- Evidence Count
- Notes

### Evidence

- Evidence Table
- Claim Group
- Support / Against / Uncertain
- Source Level
- Verification State

### Statistics

左：

- Dataset
- Variables

右：

- Plan
- Code
- Result
- Charts

---

## 34. P0 / P1 / P2

### P0

- Project CRUD
- Query Planner
- PubMed Search
- PMID / DOI Metadata
- Search Result
- Save Paper
- Abstract Reader
- PDF Upload
- Basic PDF Parse
- Evidence Retrieval
- Evidence Original Text
- Evidence Locator
- SUPPORT / AGAINST / UNCERTAIN
- Claim → Evidence
- Citation Verifier
- Final Answer Gate
- CSV / XLSX
- Dataset Profile
- Analysis Plan
- Python
- Isolated Execution
- Result Table
- Chart
- Analysis Provenance

### P1

- PMC
- Europe PMC
- Unpaywall
- OpenAlex
- Hybrid Project RAG
- Evidence Table
- Reference Chasing
- Counter Search
- R
- Draft from Verified Evidence
- BibTeX / RIS

### P2

- Systematic Review Workspace
- Screening Workflow
- Meta-analysis
- Citation Graph
- Institutional Database Connectors
- Team Collaboration

---

## 35. Release Gates

### Gate 1 — Source Integrity

Paper 的 PMID / DOI 必须来自 Connector / Parser。

### Gate 2 — Evidence Integrity

所有 `VERIFIED Evidence` 必须能重新定位到原始文本。

### Gate 3 — Claim Coverage

Evidence-first Answer 中重要 Claim：

```text
Citation Coverage = 100%
```

### Gate 4 — Failure Honesty

搜索、全文、解析、Evidence、统计任何步骤失败，都必须显示真实失败状态。

### Gate 5 — Statistics Provenance

每个统计数字和图都必须关联成功 AnalysisRun。

---

## 36. MVP Definition of Done

### Research DoD

```text
中文研究问题
→ PubMed 真实 PMID
→ Paper
→ Abstract / Full Text
→ Evidence Span
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
