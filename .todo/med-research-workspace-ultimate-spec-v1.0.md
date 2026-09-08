# Med Research Workspace — 终极版 Technical SPEC

**版本**：V1.0  
**状态**：Implementation Ready  
**基础框架**：DeepSeek Harness（DSH）  
**目标**：把 PRD 落成可编码、可测试、可演进的工程规格。

---

# 1. 技术总目标

本系统必须真实跑通两条链路。

## 1.1 Evidence Chain

```text
Question
→ Query Plan
→ PubMed Search
→ Paper
→ Document
→ Evidence Candidate
→ Exact Source Anchor
→ Verification
→ Claim
→ Citation Gate
→ Final Answer
```

## 1.2 Statistics Chain

```text
Dataset
→ Dataset Profile
→ Analysis Plan
→ Code
→ Policy Check
→ Sandbox Execution
→ Result
→ Artifact
→ Interpretation
```

任何中间步骤失败，后续不得伪造成功。

---

# 2. DSH 集成策略

DeepSeek Harness 作为 Agent Harness，医学业务能力以独立插件形式扩展。

原则：

```text
不直接修改 DSH Core
→ Profile
→ Bundle
→ Plugin
→ Service
→ Tool
→ Workspace UI
```

由于 DSH 当前仍处于快速迭代阶段，本项目必须：

1. 锁定已验证版本或 commit。
2. 建立 `medical-adapter-dsh` 隔离层。
3. Domain 不直接 import 大量 DSH 内部实现。
4. 每次升级 DSH 执行 Compatibility Test。
5. 不把业务数据只存在 Session 中。

---

# 3. 推荐代码结构

```text
med-research/
│
├── apps/
│   └── medical-web/
│
├── packages/
│   ├── bundle-medical/
│   ├── plugin-project/
│   ├── plugin-literature/
│   ├── plugin-paper/
│   ├── plugin-fulltext/
│   ├── plugin-evidence/
│   ├── plugin-dataset/
│   ├── plugin-statistics/
│   ├── plugin-artifact/
│   ├── plugin-medical-ui/
│   │
│   ├── medical-contracts/
│   ├── medical-domain/
│   ├── medical-storage/
│   └── medical-adapter-dsh/
│
├── profiles/
│   └── med-research/
│
└── docs/
```

---

# 4. DSH Bundle / Profile

## 4.1 Bundle

```text
@medresearch/dsh-bundle-medical
```

`package.json`：

```json
{
  "name": "@medresearch/dsh-bundle-medical",
  "version": "1.0.0",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

## 4.2 Profile

建议：

```text
$DSH_HOME/profiles/med-research
```

组合顺序：

```text
@deepseek-ai/dsh-base
@deepseek-ai/dsh-web-app
@medresearch/dsh-bundle-medical
```

注意：

> DSH patch 是按 row id 替换 config，不应假设为 deep merge。

---

# 5. Cordis Services

通过 `ctx` 暴露稳定业务能力：

```text
ctx.projects
ctx.literature
ctx.papers
ctx.fulltext
ctx.evidence
ctx.datasets
ctx.statistics
ctx.artifacts
```

规则：

> Tool 只能调用 Service，不直接访问数据库。

正确：

```text
Tool
→ ctx.evidence.retrieve()
→ repository
```

禁止：

```text
Tool
→ raw SQL
```

---

# 6. Tool Registry

所有模型可调用能力注册为结构化 Tool。

推荐：

```text
project.create
project.get
project.get_context

literature.plan_query
literature.search_pubmed
literature.get_paper

paper.get
paper.get_document
paper.resolve_fulltext
paper.search_content

evidence.retrieve
evidence.verify
evidence.save
evidence.list_for_claim

dataset.profile
dataset.get_schema

statistics.plan
statistics.generate_code
statistics.execute

artifact.get
artifact.export
```

Tool 输入、输出必须定义 canonical schema。

禁止 Tool 直接返回一大段不稳定 Markdown 作为业务协议。

---

# 7. Domain Model — Project

```ts
interface Project {
  id: string
  name: string

  researchQuestion?: string
  background?: string

  population?: string
  interventionOrExposure?: string
  comparison?: string
  outcome?: string

  keywords: string[]

  status: 'active' | 'archived'

  createdAt: string
  updatedAt: string
}
```

---

# 8. Domain Model — Paper

```ts
interface Paper {
  id: string

  pmid?: string
  pmcid?: string
  doi?: string

  title: string
  abstract?: string

  authors: Author[]
  journal?: string
  publicationDate?: string

  publicationTypes: string[]
  meshTerms: string[]
  keywords: string[]

  source:
    | 'pubmed'
    | 'pmc'
    | 'europe_pmc'
    | 'upload'

  sourceUrl?: string

  fulltextStatus:
    | 'available'
    | 'abstract_only'
    | 'user_upload'
    | 'unavailable'

  createdAt: string
  updatedAt: string
}
```

关键约束：

```text
PMID / DOI 只能来自 Connector / Parser。
模型不得自行创建。
```

---

# 9. Domain Model — PaperDocument

```ts
interface PaperDocument {
  id: string
  paperId: string

  sourceType:
    | 'abstract'
    | 'pmc_xml'
    | 'europe_pmc_xml'
    | 'uploaded_pdf'

  contentHash: string

  license?: string
  accessUrl?: string

  parseStatus:
    | 'READY'
    | 'PARTIAL'
    | 'FAILED'
    | 'ABSTRACT_ONLY'

  createdAt: string
}
```

---

# 10. Domain Model — Sections / Paragraphs

```ts
interface PaperSection {
  id: string
  documentId: string

  title: string

  type:
    | 'abstract'
    | 'introduction'
    | 'methods'
    | 'results'
    | 'discussion'
    | 'conclusion'
    | 'references'
    | 'other'

  order: number
}
```

```ts
interface PaperParagraph {
  id: string
  sectionId: string

  order: number
  text: string

  page?: number

  startOffset?: number
  endOffset?: number
}
```

---

# 11. Domain Model — Evidence

```ts
interface Evidence {
  id: string

  projectId: string
  paperId: string
  documentId: string

  sourceType:
    | 'fulltext'
    | 'abstract'
    | 'secondary_citation'

  section?: string
  paragraphId?: string
  page?: number

  originalText: string
  normalizedText: string

  startOffset?: number
  endOffset?: number

  relation:
    | 'SUPPORT'
    | 'AGAINST'
    | 'UNCERTAIN'

  retrievalScore?: number
  rerankScore?: number

  verificationStatus:
    | 'PENDING'
    | 'VERIFIED'
    | 'PARTIAL'
    | 'REJECTED'

  createdAt: string
}
```

硬约束：

> `VERIFIED Evidence` 必须有可重新定位的 `originalText`。

---

# 12. Domain Model — Claim

```ts
interface Claim {
  id: string
  projectId: string
  researchQueryId: string

  text: string

  evidenceIds: string[]
  counterEvidenceIds: string[]

  evidenceStatus:
    | 'SUFFICIENT'
    | 'INSUFFICIENT'
    | 'CONFLICTING'

  confidence?: number

  verificationStatus:
    | 'PENDING'
    | 'VERIFIED'
    | 'REJECTED'

  createdAt: string
}
```

---

# 13. Domain Model — Dataset

```ts
interface Dataset {
  id: string
  projectId: string

  filename: string
  contentHash: string

  rowCount: number
  columnCount: number

  schema: DatasetColumn[]

  createdAt: string
}
```

```ts
interface DatasetColumn {
  name: string

  inferredType:
    | 'continuous'
    | 'ordinal'
    | 'binary'
    | 'categorical'
    | 'date'
    | 'id'
    | 'unknown'

  nullable: boolean
  missingCount: number
  uniqueCount: number

  min?: number
  max?: number
  mean?: number
  median?: number
}
```

---

# 14. Domain Model — AnalysisRun

```ts
interface AnalysisRun {
  id: string

  projectId: string
  datasetId: string
  datasetHash: string

  question: string

  analysisPlan: AnalysisPlan

  language: 'python'
  generatedCode: string
  codeHash: string

  runtime: string
  runtimeVersion: string
  packageVersions: Record<string, string>

  status:
    | 'planned'
    | 'approved'
    | 'running'
    | 'succeeded'
    | 'failed'

  stdout?: string
  stderr?: string

  resultJson?: unknown
  artifactIds: string[]

  createdAt: string
  finishedAt?: string
}
```

---

# 15. 数据存储

推荐：

```text
PostgreSQL
→ domain data

Object Storage
→ PDF / CSV / XLSX / PNG / SVG

Redis
→ cache / rate limit / transient jobs

pgvector
→ Project-level embeddings
```

V1 不要求 OpenSearch。

规模增长后再增加：

```text
OpenSearch
→ project / library search
```

---

# 16. 最小数据库表

```text
projects

research_queries
query_plans

papers
paper_sources
project_papers

paper_documents
paper_sections
paper_paragraphs

evidence_chunks
evidences

claims
claim_evidences

files
datasets
dataset_columns

analysis_runs
artifacts

sessions
audit_logs
```

---

# 17. Research Query Input

```ts
interface ResearchQueryInput {
  projectId: string
  question: string

  dateFrom?: string
  dateTo?: string

  publicationTypes?: string[]
  languages?: string[]

  maxResults?: number
}
```

---

# 18. Query Planner Output

```ts
interface QueryPlan {
  normalizedQuestion: string

  pico?: {
    population?: string
    interventionOrExposure?: string
    comparison?: string
    outcome?: string
  }

  concepts: Array<{
    name: string
    synonyms: string[]
    meshCandidates: string[]
  }>

  queries: Array<{
    source: 'pubmed'
    query: string
    purpose:
      | 'primary'
      | 'broad'
      | 'counter'
  }>
}
```

V1 至少：

- primary
- broad

P1 增加：

- counter

---

# 19. PubMed Connector

使用 NCBI E-utilities。

流程：

```text
ESearch
→ PMID[]
→ EFetch / ESummary
→ Normalize
→ Paper[]
```

要求：

- tool identifier
- contact email
- API key configurable
- rate limiter
- retry with backoff
- cache by query hash
- batch fetch
- timeout
- request logging
- connector metrics

禁止：

> 把 PubMed HTML 页面爬虫作为主接口。

---

# 20. Paper Normalization

不同来源统一映射到 `Paper`。

去重顺序：

```text
PMID
→ DOI
→ PMCID
→ normalized(title + year)
```

保存原始来源：

```ts
interface PaperSourceRecord {
  paperId: string
  source: string
  sourceId: string
  rawMetadata: unknown
}
```

---

# 21. Full-text Resolver

Service：

```ts
interface FulltextService {
  resolve(paper: Paper): Promise<FulltextResolution>
}
```

```ts
interface FulltextResolution {
  status:
    | 'available'
    | 'abstract_only'
    | 'unavailable'

  source?:
    | 'pmc'
    | 'europe_pmc'
    | 'unpaywall'
    | 'openalex'
    | 'publisher'
    | 'user_upload'

  url?: string
  license?: string

  machineReadable?: boolean
}
```

优先级：

```text
PMCID
→ PMC
→ Europe PMC
→ Unpaywall
→ OpenAlex
→ Publisher
→ Upload
```

自动获取全文仅使用明确允许的程序化渠道。

---

# 22. 文档解析

## 22.1 XML / JATS

尽量保留：

- section hierarchy
- paragraph
- table caption
- figure caption
- references

## 22.2 PDF

V1 目标：

- text extraction
- page number
- paragraph approximation

双栏、扫描版等解析不保证完美。

失败状态：

```text
PARTIAL
FAILED
```

UI 必须公开。

---

# 23. Chunking

禁止纯固定 token 盲切。

推荐：

```text
Paper
→ Section
→ Paragraph
→ Semantic Window
```

```ts
interface EvidenceChunk {
  id: string

  paperId: string
  documentId: string

  sectionType: string
  sectionTitle: string

  paragraphIds: string[]

  text: string

  pageStart?: number
  pageEnd?: number
}
```

---

# 24. Evidence Retrieval

查询输入：

```text
Research Question
+ Candidate Claim
+ Concept Terms
```

召回：

```text
BM25 Top 30
+
Vector Top 30
→ Merge
→ Rerank Top 10
→ Evidence Extraction
```

V1 可以：

```text
Postgres FTS + pgvector
```

---

# 25. Evidence Extraction Protocol

模型先输出 Candidate，不直接变成 Verified Evidence。

示例：

```json
{
  "candidate_evidence": [
    {
      "paragraph_id": "p_123",
      "quote": "original sentence...",
      "relation": "AGAINST",
      "reason": "The study reports no significant association."
    }
  ]
}
```

后端验证：

1. paragraph 存在。
2. quote exact / normalized match。
3. relation 合法。
4. 保存 PENDING Evidence。
5. 进入 semantic verifier。
6. 通过后变 VERIFIED。

Quote 无法定位：

```text
REJECTED
```

---

# 26. Secondary Citation Detection

若 Evidence 来自 Discussion：

> Previous study X found ...

并且原文是在引用另一篇研究，而不是当前研究自己的 Result，则标记：

```text
sourceType = secondary_citation
```

P1：

```text
Reference
→ DOI / PMID
→ 搜索原研究
→ 升级为 Direct Evidence
```

---

# 27. Claim Generation Protocol

Claim Generator 的输入只能是：

- Research Question
- Verified Evidence
- Paper Metadata

输出：

```json
{
  "claims": [
    {
      "text": "...",
      "evidence_ids": ["ev_1", "ev_2"],
      "counter_evidence_ids": ["ev_3"],
      "evidence_status": "CONFLICTING"
    }
  ]
}
```

模型不能创建不存在的 `evidence_id`。

---

# 28. Citation Verification

每个 Claim 检查：

```text
Evidence exists
AND
Evidence VERIFIED
AND
Paper exists
AND
Original Text re-locatable
AND
Semantic direction correct
```

输出：

```ts
interface ClaimVerificationResult {
  claimId: string
  passed: boolean
  reasons: string[]
}
```

只有 passed Claim 才进入最终科研回答。

---

# 29. Final Answer Serializer

禁止让模型自由生成 Citation Number。

正确：

```text
Structured Claim JSON
→ Backend Serializer
→ [1][2][3]
```

`[1]` 由后端映射：

```text
citation_index
→ evidence_id
→ paper_id
```

避免：

- 引用号不存在
- 引用号错位
- 模型自己编 DOI

---

# 30. Evidence API

```text
POST /api/projects/:id/research/query
GET  /api/research/:queryId
GET  /api/research/:queryId/papers

POST /api/projects/:id/evidence/retrieve
POST /api/evidence/:id/verify

GET  /api/projects/:id/claims
GET  /api/claims/:id/evidence
```

---

# 31. Paper API

```text
GET  /api/papers/:id
GET  /api/papers/:id/document
GET  /api/papers/:id/sections
GET  /api/papers/:id/paragraphs/:paragraphId

POST /api/papers/:id/resolve-fulltext
POST /api/papers/:id/upload
POST /api/papers/:id/search
```

---

# 32. Project API

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET /api/projects/:id/overview
```

---

# 33. Dataset Pipeline

```text
Upload
→ File Validate
→ Hash
→ Parse
→ Infer Schema
→ Profile
→ Persist
```

V1 推荐限制：

```text
CSV  ≤ 100 MB
XLSX ≤ 50 MB
Rows ≤ 1,000,000
```

均应做成配置项。

---

# 34. Analysis Plan

```ts
interface AnalysisPlan {
  objective: string

  outcome?: string
  exposures: string[]
  covariates: string[]

  steps: Array<{
    id: string
    method: string
    reason: string
    variables: string[]
  }>

  assumptions: string[]
  warnings: string[]
}
```

生成后状态：

```text
WAITING_FOR_APPROVAL
```

默认不直接执行。

---

# 35. Statistics Runner 抽象

```ts
interface StatisticsRunner {
  execute(input: {
    datasetPath: string
    code: string
    timeoutMs: number
  }): Promise<StatisticsRunResult>
}
```

允许两个实现：

```text
DSH Python Code Runtime
或
Dedicated Python Container Runner
```

业务代码只依赖接口，不依赖具体 runtime。

这样即使 DSH Python Runtime 在当前版本仍属于实验能力，也可以替换成独立 Runner。

---

# 36. Runner Security

强制：

- Network disabled
- Dataset read-only
- Isolated writable output
- Timeout
- CPU limit
- Memory limit
- Package allowlist
- No host secrets
- No arbitrary shell

禁止：

```text
pip install arbitrary package
curl
wget
socket
shell escape
```

---

# 37. Statistics Output Contract

Runner 只返回机器数据。

```ts
interface StatisticsRunResult {
  status:
    | 'succeeded'
    | 'failed'

  stdout: string
  stderr: string

  resultJson?: unknown

  outputs: Array<{
    type:
      | 'table'
      | 'figure'
      | 'file'

    path: string
    mimeType: string
  }>

  runtime: {
    language: 'python'
    version: string
    packages: Record<string, string>
  }
}
```

AI Interpretation 只能读取成功的结果。

---

# 38. Artifact

```ts
interface Artifact {
  id: string
  projectId: string
  analysisRunId?: string

  type:
    | 'figure'
    | 'table'
    | 'file'

  mimeType: string
  storageKey: string

  datasetHash?: string
  codeHash?: string

  metadata: Record<string, unknown>

  createdAt: string
}
```

---

# 39. DSH Tool Execution Policy

利用 DSH Tool Pipeline：

```text
pre-execute
→ guards
→ execute
→ post-execute
→ result
```

增加 Medical Guard：

- 当前 mode 是否允许 Tool
- Project scope 是否匹配
- 用户是否有权限
- Statistics 是否已批准
- 文件路径是否在 Workspace 内
- Full-text 来源是否允许

---

# 40. DSH Approval Policy

建议：

### 不需要 Approval

- PubMed Search
- Paper Metadata
- Evidence Retrieval

### 需要 Approval 或明确确认

- Statistics Execute
- 文件写入
- 导出
- 删除项目资产
- 高风险 Workspace 操作

---

# 41. DSH Session Context

```ts
interface MedicalSessionContext {
  projectId?: string

  mode:
    | 'research'
    | 'paper'
    | 'statistics'

  activePaperId?: string
  activeDatasetId?: string
  activeResearchQueryId?: string
}
```

Session 仅负责交互上下文。

业务数据必须持久化到数据库。

---

# 42. Web UI 架构

建议保留 DSH Agent Interaction 能力，但业务 UI 不只做聊天框。

核心路由：

```text
/project/:id
/project/:id/research
/project/:id/papers
/project/:id/evidence
/project/:id/statistics
```

设计：

> Chat 是 Workspace 控制入口，不是整个产品。

---

# 43. Research UI State Machine

```text
IDLE
→ PLANNING
→ PLAN_READY
→ SEARCHING
→ PAPERS_READY
→ RETRIEVING_EVIDENCE
→ VERIFYING
→ ANSWER_READY
```

任意阶段：

```text
→ ERROR_PARTIAL
```

例如：

> PubMed 成功，3 篇全文失败。

应显示部分成功，而不是整页失败。

---

# 44. Evidence UI State

```text
FULLTEXT_VERIFIED
ABSTRACT_VERIFIED
SECONDARY
UNVERIFIED
REJECTED
```

状态必须显式展示。

---

# 45. Statistics UI State Machine

```text
NO_DATASET
→ PROFILING
→ READY
→ PLANNING
→ PLAN_READY
→ WAITING_APPROVAL
→ GENERATING_CODE
→ EXECUTING
→ SUCCEEDED
→ FAILED
```

失败时：

- 保留代码
- 保留 stderr
- 提供修复入口

但不得伪造 result。

---

# 46. Error Model

```ts
interface DomainError {
  code: string
  message: string

  retryable: boolean
  partialDataAvailable: boolean

  source?: string
  details?: unknown
}
```

关键错误：

```text
PUBMED_RATE_LIMIT
PUBMED_TIMEOUT
PAPER_NOT_FOUND

FULLTEXT_NOT_AVAILABLE
FULLTEXT_LICENSE_BLOCKED

PDF_PARSE_PARTIAL
PDF_PARSE_FAILED

EVIDENCE_NOT_FOUND
EVIDENCE_QUOTE_MISMATCH
CLAIM_UNSUPPORTED

DATASET_PARSE_FAILED

STATISTICS_PLAN_INVALID
CODE_EXECUTION_TIMEOUT
CODE_EXECUTION_FAILED
```

---

# 47. Cache

可缓存：

- PubMed Query Result
- Paper Metadata
- PMID → Paper
- Full-text Resolution
- OA Resolution
- Embeddings
- 短期 Rerank

禁止：

- 未 scope 的 Project Evidence
- 用户 Dataset 明文进入共享缓存

---

# 48. Observability

Research Run：

```text
trace_id
project_id
session_id
query_id

planner_latency
pubmed_latency

paper_count
fulltext_success_count

evidence_count
verified_evidence_count

claim_count
rejected_claim_count

model
tokens
cost
```

Statistics：

```text
analysis_run_id
runner_latency
status
artifact_count
```

---

# 49. Audit Log

关键事件：

- project create / delete
- paper upload
- evidence verify
- claim verify
- dataset upload
- statistics approval
- code execute
- artifact export

用于 Debug 和科研复现。

---

# 50. 医学数据安全

Dataset 可能包含患者敏感信息。

V1：

- 上传前提示用户去标识化
- Project 隔离
- Private Object Storage
- Encryption at Rest
- Signed URL
- Audit Log
- Runner 无网络
- 不把 Dataset 发给文献 Connector
- LLM 输入尽量最小化

如果未来处理真实可识别患者数据，需要独立做隐私与合规评估。

---

# 51. Literature Data Compliance

全文保存：

```text
source
license
access_url
retrieved_at
```

原则：

- 使用官方 API
- 遵守自动访问要求
- 保留 license metadata
- 不接 Sci-Hub
- 不绕过付费墙

---

# 52. Gold Set

准确性第一，因此必须建设人工 Gold Set。

每条：

```text
question
expected_key_papers[]
expected_evidence_spans[]
expected_direction
review_notes
reviewer
```

首版建议：

```text
30–50 个真实科研问题
```

后续扩到 100+。

---

# 53. Evaluation Metrics

## Retrieval

- Recall@20
- Precision@20

## Evidence

- Evidence Precision
- Locator Accuracy
- Relation Accuracy

## Claim

- Citation Coverage
- Claim Support Precision
- Unsupported Claim Rate
- Counter Evidence Miss Rate

## Statistics

- Execution Success
- Fixture Result Consistency
- Provenance Completeness

---

# 54. Hard Release Gates

结构门槛：

```text
Paper Identity Validity = 100%

Verified Evidence Locator Integrity = 100%

Final Claim Citation Coverage = 100%

Statistics Provenance Coverage = 100%
```

语义准确率使用人工 Gold Set 审核，不允许用模型自评分数代替。

---

# 55. Test Matrix — PubMed

必须覆盖：

- known PMID
- empty result
- malformed query
- timeout
- rate limit
- batch fetch
- duplicate records
- missing DOI
- missing Abstract

---

# 56. Test Matrix — Evidence

必须覆盖：

- Full-text direct support
- Full-text direct against
- Abstract direct support
- secondary citation
- wrong paragraph
- quote mismatch
- relation reversed
- claim without evidence
- conflicting evidence

---

# 57. Test Matrix — Statistics

Fixture：

- binary logistic regression
- linear regression
- categorical comparison
- missing data
- code error
- timeout

固定 Dataset + 人工确认结果做 regression test。

---

# 58. E2E — Research

```text
用户输入：
PONV 与术后疼痛是否相关？

→ Query Planner
→ PubMed
→ 返回真实 Papers
→ 保存 5 篇
→ Evidence Retrieval
→ 2 Support
→ 2 Against
→ 1 Uncertain
→ Claim
→ Verifier
→ Final Answer
→ 点击 [1]
→ Paper Reader 定位原文
```

---

# 59. E2E — Statistics

```text
上传 ponv.csv
→ Dataset Profile
→ 提问
→ Analysis Plan
→ 用户确认
→ Python Code
→ Runner
→ OR / CI / p
→ Figure
→ Provenance
→ 查看 dataset_hash + code + runtime
```

---

# 60. Milestone

## M0 — Vertical PoC

只跑：

```text
Question
→ PubMed
→ 20 Papers
→ Evidence
→ Claim
→ Original Text
```

## M1 — Research MVP

- Project
- Query
- Search
- Paper
- Evidence
- Verifier
- Reader

## M2 — Statistics MVP

- Dataset
- Plan
- Code
- Execute
- Table
- Chart
- Provenance

## M3 — OA Full Text

- PMC
- Europe PMC
- Unpaywall
- OpenAlex

## M4 — Project RAG

- Saved Papers
- BM25
- pgvector
- Hybrid Retrieval

---

# 61. 推荐开工顺序

不要先大改全部 UI。

按 Vertical Slice：

### Slice A

```text
中文问题
→ PubMed
→ PMID
→ Top 20
```

### Slice B

```text
Paper
→ Abstract / PDF
→ Evidence
→ Original Text
```

### Slice C

```text
Evidence
→ Claim
→ Citation Verifier
→ Final Answer
```

### Slice D

```text
CSV
→ Analysis Plan
→ Python
→ Execute
→ Table / Chart
```

### Slice E

最后补：

```text
Project
Papers
Evidence Table
Statistics History
UI polish
```

---

# 62. Definition of Done

V1 不是“页面完成”，而是以下两条可信链完整跑通。

## Research DoD

```text
Question
→ PubMed Real Paper
→ Evidence
→ Original Source
→ Verified Claim
→ Clickable Citation
```

## Statistics DoD

```text
Real Dataset
→ Analysis Plan
→ Executed Code
→ Real Result
→ Chart
→ Full Provenance
```

只要这两条成立，产品核心就成立。
