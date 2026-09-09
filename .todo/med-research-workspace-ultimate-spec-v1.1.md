# Med Research Workspace — 终极版 Technical SPEC V1.1

**版本**：V1.1（V1.0 评审修订版）
**状态**：Implementation Ready
**基础框架**：DeepSeek Harness（DSH）
**目标**：把 [PRD V1.1](med-research-workspace-ultimate-prd-v1.1.md) 落成可编码、可测试、可演进的工程规格。
**上游**：V1.0 见 [med-research-workspace-ultimate-spec-v1.0.md](med-research-workspace-ultimate-spec-v1.0.md)。

---

## 0. V1.1 变更摘要

| # | 改动 | 章节 |
|---|---|---|
| 1 | 接口层由 REST 改为 DSH Typert `@Remote`；UI 由路由页面改为客户端插件视图 | §30–32、§42 |
| 2 | 存储由 Postgres/pgvector/Redis 改为 `storage-domain`（SQLite）+ 项目目录；补版本与导出策略 | §15–16、§27 |
| 3 | Evidence 状态拆分为 `locator_status` + `support_status`，补归一化算法与 offset 基准 | §11、§22、§25 |
| 4 | 统计 Runner 明确为自建隔离执行器，排除 DSH 实验 Python runtime 与默认 E2B | §35–36 |
| 5 | 工具名扁平 snake_case；服务键加 `med` 前缀避免全局冲突 | §5–6 |
| 6 | 新增「模型可见 ⟺ 已记录」的会话事件契约 | §41 |
| 7 | 新增成本/时延预算、行级数据隔离、缓存隐私规则 | §24、§47 |
| 8 | 新增测试策略、验收映射、实施计划、风险与假设 | §63–65 |

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
→ Locate
→ Semantic Verify
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
→ Isolated Execution
→ Result
→ Artifact
→ Interpretation
```

任何中间步骤失败，后续不得伪造成功。

---

# 2. DSH 集成策略与不变式

医学业务能力以独立插件形式扩展 DSH，不修改 DSH Core。

```text
Profile → Bundle → Plugin → Service → Tool → Workspace UI
```

由于 DSH 仍在快速迭代，本项目必须：

1. 锁定已验证版本或 commit。
2. 建立 `medical-adapter-dsh` 隔离层。
3. Domain 不直接 import 大量 DSH 内部实现。
4. 每次升级 DSH 执行 Compatibility Test。
5. 不把业务数据只存在 Session 中。

## 2.1 必须遵守的 DSH 不变式

| 不变式 | 约束 | 落地方式 |
|---|---|---|
| 模型可见 ⟺ 已记录 | 任何进入模型请求的内容必须能从会话日志重建 | 项目上下文走工具结果或 `medical/project-context` 会话事件（§41） |
| 注册即 effect | 所有贡献通过 `ctx.effect()` / `ctx.on()` 注册并返回 disposer | 每个 registry 的 `register()` 返回 disposer |
| patch 非 deep merge | patch 按 row id 整体替换 `config` | bundle patch 中每行重述其全部 config |
| 一个 context 一个服务实例 | 同一服务键只能有一个 provider | 统计 Runner 用独立服务键，不与 `ctx.codeRuntime` 混用 |
| 客户端文案 locale-owned | 产品文案走类型化字典 | 提供 zh / en 字典 |

---

# 3. 代码结构

仓库与 DSH checkout 分离（out-of-tree）：

```text
med-research/
├── packages/
│   ├── bundle-medical/            # 纯数据：cordis.patch.yml
│   ├── plugin-project/
│   ├── plugin-literature/
│   ├── plugin-paper/
│   ├── plugin-fulltext/
│   ├── plugin-evidence/
│   ├── plugin-dataset/
│   ├── plugin-statistics/
│   ├── plugin-artifact/
│   ├── plugin-medical-ui/         # 客户端插件（浏览器半）
│   ├── medical-contracts/         # Service Definition + 领域类型 + zod schema
│   ├── medical-domain/            # 纯领域逻辑（无 DSH 依赖）
│   ├── medical-storage/           # storage-domain 域声明与仓储
│   ├── medical-runner-container/  # StatisticsRunner 的 V1 provider
│   └── medical-adapter-dsh/       # DSH 版本适配与 Compatibility Test
└── docs/
```

`apps/medical-web` **不再存在**（V1.1 取消独立前端）。

---

# 4. DSH Bundle / Profile

## 4.1 Bundle

```json
{
  "name": "@medresearch/dsh-bundle-medical",
  "version": "1.1.0",
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

`cordis.patch.yml` 的 `insert` 列出全部 host 行与 `dsh.client` 行（客户端插件行必须声明 `dsh.client` 且提供 `exports["./client"]`）。

## 4.2 Profile

```text
$DSH_HOME/profiles/med-research
```

组合顺序：

```text
@deepseek-ai/dsh-base
@deepseek-ai/dsh-web-app
@medresearch/dsh-bundle-medical
```

安装：

```sh
dsh plugin --profile med-research add @medresearch/dsh-bundle-medical
```

注意：DSH patch 按 row id 替换 config，不做 deep merge。

---

# 5. Cordis Services

所有业务服务键加 `med` 前缀，避免与其它插件全局冲突：

```text
ctx.medProjects
ctx.medLiterature
ctx.medPapers
ctx.medFulltext
ctx.medEvidence
ctx.medDatasets
ctx.medStatistics
ctx.medArtifacts
ctx.medRunner            # StatisticsRunner 服务（§35）
```

规则：

> Tool 只能调用 Service，不直接访问存储。

```text
Tool → ctx.medEvidence.retrieve() → repository
```

禁止：

```text
Tool → raw SQL / 直接读写 storage backend
```

---

# 6. Tool Registry

所有模型可调用能力注册为结构化 Tool，命名使用**扁平 snake_case**（点号会破坏 PTC 的 `tools.<name>(args)`）：

```text
project_create / project_get / project_get_context

literature_plan_query / literature_search_pubmed / literature_get_paper

paper_get / paper_get_document / paper_resolve_fulltext / paper_search_content

evidence_retrieve / evidence_verify / evidence_save / evidence_list_for_claim

dataset_profile / dataset_get_schema

statistics_plan / statistics_generate_code / statistics_execute

artifact_get / artifact_export
```

每个 Tool 必须：

- 用 `defineTool` 定义，输入输出有 canonical JSON Schema。
- 输出为机器可读结构，禁止把大段 Markdown 当业务协议。
- 在客户端插件中按工具名注册 `tool.call.toolview` 卡片（§42）。

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

  /** 项目目录（DSH Workspace 路径），项目与工作区 1:1。 */
  workspacePath: string

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

  source: 'pubmed' | 'pmc' | 'europe_pmc' | 'upload'
  sourceUrl?: string

  fulltextStatus: 'available' | 'abstract_only' | 'user_upload' | 'unavailable'

  createdAt: string
  updatedAt: string
}
```

关键约束：

```text
PMID / DOI 只能来自 Connector / Parser。模型不得自行创建。
```

---

# 9. Domain Model — PaperDocument

```ts
interface PaperDocument {
  id: string
  paperId: string

  sourceType: 'abstract' | 'pmc_xml' | 'europe_pmc_xml' | 'uploaded_pdf'

  contentHash: string

  license?: string
  accessUrl?: string

  parseStatus: 'READY' | 'PARTIAL' | 'FAILED' | 'ABSTRACT_ONLY'

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
    | 'abstract' | 'introduction' | 'methods' | 'results'
    | 'discussion' | 'conclusion' | 'references' | 'other'
  order: number
}

interface PaperParagraph {
  id: string
  sectionId: string
  order: number
  /** 归一化后的段落文本（offset 基准）。 */
  text: string
  /** 归一化前的原始文本，用于 UI 展示。 */
  rawText: string
  page?: number
  /** 相对该段落归一化文本的字符偏移。 */
  startOffset?: number
  endOffset?: number
}
```

**offset 基准（V1.1 明确）**：所有偏移相对 `PaperParagraph.text`（归一化文本），不相对文档全文。

---

# 11. Domain Model — Evidence

```ts
interface Evidence {
  id: string

  projectId: string
  paperId: string
  documentId: string

  sourceType: 'fulltext' | 'abstract' | 'secondary_citation'

  section?: string
  paragraphId?: string
  page?: number

  originalText: string
  normalizedText: string

  /** 偏移基准；V1 固定为 'normalized_paragraph'。 */
  offsetBase: 'normalized_paragraph'
  startOffset?: number
  endOffset?: number

  relation: 'SUPPORT' | 'AGAINST' | 'UNCERTAIN'

  retrievalScore?: number
  rerankScore?: number

  /** 确定性：原文能否重新定位。 */
  locatorStatus: 'FOUND' | 'PARTIAL' | 'NOT_FOUND'

  /** 语义：是否支持对应 Claim（模型 + 人工）。 */
  supportStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'

  /** 抽取 provenance。 */
  extractorVersion: string
  extractorModel: string
  promptVersion: string

  createdAt: string
}
```

硬约束：

> `supportStatus = VERIFIED` 必须有 `locatorStatus ∈ {FOUND, PARTIAL}`。
> `locatorStatus = NOT_FOUND` 一律 `supportStatus = REJECTED`。

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

  evidenceStatus: 'SUFFICIENT' | 'INSUFFICIENT' | 'CONFLICTING'

  confidence?: number

  supportStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'

  /** 校验失败原因；通过时为空数组。 */
  rejectionReasons: string[]

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

interface DatasetColumn {
  name: string
  inferredType:
    | 'continuous' | 'ordinal' | 'binary'
    | 'categorical' | 'date' | 'id' | 'unknown'
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

  status: 'planned' | 'approved' | 'running' | 'succeeded' | 'failed'

  stdout?: string
  stderr?: string

  resultJson?: unknown
  artifactIds: string[]

  createdAt: string
  finishedAt?: string
}
```

---

# 15. 存储架构

## 15.1 V1 方案

```text
结构化业务数据 → DSH storage-domain（SQLite backend）
大文件         → 项目目录 <workspace>/.medresearch/
全文检索       → SQLite FTS / 进程内索引（项目范围）
向量           → P1（插件自管）
缓存           → 进程内 + 文件（Redis 延后 P2）
```

DSH `dsh-base` 已挂载 `storage` + `storage-json` + `storage-domain`（默认 `backend: json`）。医学 bundle 追加 `storage-sqlite` 行，并把自己的域路由到 `sqlite`。

## 15.2 版本与迁移

DSH 存储没有迁移框架：版本不匹配是 fail-loud 拒绝。因此：

- 每个域声明 `version`，初始为 1。
- 需要变更时新增版本并在插件启动时执行一次性导出 → 转换 → 导入。
- 必须提供 `medExport` / `medImport` 命令或工具，作为备份与迁移路径。

## 15.3 禁止

- 直接把业务对象写进会话日志作为唯一存储。
- 让存储 backend 的细节泄漏到 Tool 或 UI 层。

---

# 16. 最小数据域表

```text
med_projects
med_papers
med_paper_sources
med_project_papers
med_documents
med_sections
med_paragraphs
med_evidence_chunks
med_evidences
med_claims
med_claim_evidences
med_datasets
med_dataset_columns
med_analysis_runs
med_artifacts
med_session_project      # sessionId → projectId 绑定
med_audit_logs
```

每个域用 `defineDomain` + zod 表 schema 声明；记录键使用品牌化 id。

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
    purpose: 'primary' | 'broad' | 'counter'
  }>
}
```

V1 至少 primary、broad；counter 为 P1。

---

# 19. PubMed Connector

使用 NCBI E-utilities（GET）：

```text
ESearch → PMID[] → EFetch / ESummary → Normalize → Paper[]
```

要求：

- tool identifier、contact email、API key 可配置
- rate limiter、retry with backoff
- 按 query hash 缓存
- batch fetch、timeout、请求日志、connector 指标
- 分页：受 `ctx.web.fetch` 响应上限约束，必须按 `retmax` 分批

禁止：把 PubMed HTML 页面爬虫作为主接口。

---

# 20. Paper Normalization

统一映射到 `Paper`。去重顺序：

```text
PMID → DOI → PMCID → normalized(title + year)
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

```ts
interface FulltextService {
  resolve(paper: Paper): Promise<FulltextResolution>
}

interface FulltextResolution {
  status: 'available' | 'abstract_only' | 'unavailable'
  source?: 'pmc' | 'europe_pmc' | 'unpaywall' | 'openalex' | 'publisher' | 'user_upload'
  url?: string
  license?: string
  machineReadable?: boolean
}
```

优先级：

```text
PMCID → PMC → Europe PMC → Unpaywall → OpenAlex → Publisher → Upload
```

自动获取全文仅使用明确允许的程序化渠道。OA PDF 为二进制，必须走插件自带 HTTP 客户端（`ctx.web.fetch` 拒绝二进制响应）。

---

# 22. 文档解析与归一化

## 22.1 XML / JATS

尽量保留 section hierarchy、paragraph、table caption、figure caption、references。

## 22.2 PDF

V1 目标：text extraction、page number、paragraph approximation。双栏、扫描版等解析不保证完美。

失败状态：`PARTIAL` / `FAILED`，UI 必须公开。

## 22.3 归一化算法（V1.1 新增）

归一化函数 `normalizeParagraph(raw: string): string` 必须按固定顺序执行：

```text
1. Unicode NFKC
2. 软连字符 (U+00AD) 删除；行末连字符 + 换行 → 合并
3. 常见连字展开（ﬁ→fi, ﬂ→fl, ﬀ→ff, ﬃ→ffi, ﬄ→ffl）
4. 引号/破折号统一（‘’“” → '"'；– — → '-'）
5. 连续空白（含 \n \t \u00A0）折叠为单空格
6. 去除首尾空白
```

大小写不敏感匹配在比较阶段处理，不改变存储文本。

**对齐算法**：

```text
exact:    normalizedText === candidateSpan
aligned:  在段落内滑动窗口，编辑距离 / 长度 ≤ tolerance（默认 0.05，可配置）
```

结果映射：`exact → FOUND`；`aligned → PARTIAL`；均失败 → `NOT_FOUND`。

---

# 23. Chunking

禁止纯固定 token 盲切。推荐：

```text
Paper → Section → Paragraph → Semantic Window
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

查询输入：Research Question + Candidate Claim + Concept Terms。

```text
BM25 Top 30 + Vector Top 30 → Merge → Rerank Top 10 → Evidence Extraction
```

V1：SQLite FTS / 进程内 BM25；向量为 P1。

**预算（V1.1 新增）**：每次研究查询必须设定 `maxModelCalls`、`maxTokens`、`wallClockMs`；超预算时返回部分成功结果并记录 `partialReason`。

---

# 25. Evidence Extraction Protocol

模型先输出 Candidate，不直接变成 Verified Evidence：

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

1. `paragraph_id` 存在。
2. `quote` 按 §22.3 归一化后能定位（exact 或 aligned）。
3. `relation` 合法。
4. 保存 `PENDING` Evidence，并写入 `locatorStatus`。
5. 进入 semantic verifier。
6. 通过后 `supportStatus = VERIFIED`。

Quote 无法定位：`locatorStatus = NOT_FOUND` → `supportStatus = REJECTED`。

**provenance**：保存 `extractorVersion`、`extractorModel`、`promptVersion`。

---

# 26. Secondary Citation Detection

若 Evidence 来自 Discussion（如 "Previous study X found ..."）且原文是在引用另一篇研究，则标记：

```text
sourceType = secondary_citation
```

P1：Reference → DOI / PMID → 搜索原研究 → 升级为 Direct Evidence。

V1 默认保守：无法确定时按 `fulltext` 处理但在 UI 标注「可能为二手引用」。

---

# 27. Claim Generation Protocol

输入只能是 Research Question、Verified Evidence、Paper Metadata。输出：

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
AND Evidence.supportStatus = VERIFIED
AND Evidence.locatorStatus ∈ {FOUND, PARTIAL}
AND Paper exists
AND Original Text re-locatable（按 §22.3）
AND Semantic direction correct
```

```ts
interface ClaimVerificationResult {
  claimId: string
  passed: boolean
  reasons: string[]
}
```

只有 `passed` 的 Claim 才进入最终科研回答。

---

# 29. Final Answer Serializer

禁止让模型自由生成 Citation Number。

```text
Structured Claim JSON → Backend Serializer → [1][2][3]
```

`[1]` 由后端映射：

```text
citation_index → evidence_id → paper_id
```

避免引用号不存在、错位、模型自编 DOI。

---

# 30. Remote 接口（替代 REST）

DSH Web 的客户端-宿主通信走 Typert `@Remote`，不是 REST。业务插件定义自己的 Remote contribution，客户端插件用 `ctx.remote.$mount(...)` 挂载：

```text
medProjects/list | create | get | update | delete | overview

medResearch/planQuery | search | get | papers

medPapers/get | document | sections | paragraph | resolveFulltext | upload | search

medEvidence/retrieve | verify | listForClaim

medDatasets/upload | profile | schema

medStatistics/plan | generateCode | execute

medArtifacts/get | export
```

方法必须是严格生成的 contribution；快速起步阶段可临时用 `ctx.connection.rpc.handle`，但正式实现必须迁移到 `@Remote`。

---

# 31. Paper 接口

```text
medPapers/get(id)
medPapers/document(id)
medPapers/sections(id)
medPapers/paragraph(paragraphId)
medPapers/resolveFulltext(id)
medPapers/upload(projectId, fileRef)
medPapers/search(id, query)
```

---

# 32. Project 接口

```text
medProjects/create(input)
medProjects/list()
medProjects/get(id)
medProjects/update(id, patch)
medProjects/delete(id)
medProjects/overview(id)
```

`create` 必须同时创建项目目录与 `project.json`，并把项目与一个 DSH Workspace 绑定。

---

# 33. Dataset Pipeline

```text
Upload → File Validate → Hash → Parse → Infer Schema → Profile → Persist
```

V1 限制（均为配置项）：

```text
CSV  ≤ 100 MB
XLSX ≤ 50 MB
Rows ≤ 1,000,000
```

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

生成后状态：`WAITING_FOR_APPROVAL`，默认不执行。

---

# 35. Statistics Runner 抽象

```ts
interface StatisticsRunner {
  execute(input: {
    datasetPath: string
    code: string
    limits: {
      timeoutMs: number
      cpuSeconds: number
      memoryMb: number
      maxOutputBytes: number
    }
    allowlist: string[]
  }): Promise<StatisticsRunResult>
}
```

V1 provider：`medical-runner-container`（自建隔离执行器）。

业务代码只依赖接口，不依赖具体 runtime。DSH 实验包 `code-runtime-python` **不得**用作本接口的 provider。

---

# 36. Runner Security

强制：

- Network disabled
- Dataset read-only
- Isolated writable output
- Timeout / CPU limit / Memory limit
- Package allowlist
- No host secrets
- No arbitrary shell

禁止：`pip install` 任意包、`curl`、`wget`、`socket`、shell escape。

**选型说明（V1.1）**：

- DSH `code-runtime-python` 明确「Containment — not a security boundary」，且只提供临时目录，无网络隔离与数据集挂载 → 排除。
- DSH `sandbox` 只管文件效果，不管网络 → 不作为唯一手段。
- E2B 现成配置只有 `apiKey/cwd/timeoutMs`，无网络开关/白名单/只读挂载，且为第三方云 → 默认不用于患者数据；使用前须完成隐私合规评估。

---

# 37. Statistics Output Contract

Runner 只返回机器数据：

```ts
interface StatisticsRunResult {
  status: 'succeeded' | 'failed'
  stdout: string
  stderr: string
  resultJson?: unknown
  outputs: Array<{
    type: 'table' | 'figure' | 'file'
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

  type: 'figure' | 'table' | 'file'

  mimeType: string
  storageKey: string

  datasetHash?: string
  codeHash?: string

  metadata: Record<string, unknown>

  createdAt: string
}
```

---

# 39. DSH 工具执行策略

利用 DSH Tool Pipeline：

```text
pre-execute → guards → execute → post-execute → result
```

Medical Guard 检查：

- 当前 mode 是否允许该 Tool
- Project scope 是否匹配
- 用户是否有权限
- Statistics 是否已批准
- 文件路径是否在项目目录内
- Full-text 来源是否允许

Agent Mode 的允许列表用 `ctx.tools.restrict()` 动态注册（**不切换 preset**：DSH preset 只在会话未产出前可换）。

---

# 40. DSH 审批策略

| 操作 | 审批 |
|---|---|
| PubMed Search / Paper Metadata / Evidence Retrieval | 不需要 |
| Statistics Execute | 需要（`ctx.approval.request()`，fail-closed，仅 `allowed-once`） |
| 文件写入 / 导出 / 删除项目资产 | 需要 |
| 高风险 Workspace 操作 | 需要 |

审批请求放在 `tools/pre-execute` 策略层，不写进 Tool 实现体。

---

# 41. DSH 会话上下文与「模型可见 ⟺ 已记录」

```ts
interface MedicalSessionContext {
  projectId?: string
  mode: 'research' | 'paper' | 'statistics'
  activePaperId?: string
  activeDatasetId?: string
  activeResearchQueryId?: string
}
```

会话只负责交互上下文；业务数据必须持久化到项目域。

**约束（V1.1）**：`SessionHeader` 没有自定义元数据字段，因此：

1. `projectId ↔ sessionId` 的绑定写入 `med_session_project` 域。
2. 任何注入模型请求的项目上下文（如当前项目、已保存论文摘要）必须：
   - 作为 Tool Result 返回，或
   - 通过新增的 `medical/project-context` 会话事件记录（携带 `projectId`、`injectedFacts[]` 的 opaque ref），再从日志投影渲染。

不得只从数据库读取后直接拼进提示词。

---

# 42. Web UI 架构（DSH 客户端插件）

## 42.1 承载方式

产品 UI 是 out-of-tree 客户端插件，插入 `dsh-web-app` 之上；不改 DSH Core，不建独立前端。

## 42.2 席位映射

| 界面 | DSH 扩展点 | 注册键 / id |
|---|---|---|
| Research 视图 | `conversation.view`（list, session） | `med-research` |
| Papers 视图 | `conversation.view` | `med-papers` |
| Evidence 视图 | `conversation.view` | `med-evidence` |
| Statistics 视图 | `conversation.view` | `med-statistics` |
| Paper Reader | `ctx.sidebarRightTabs.register()` + `sidebar.right.pane.tab` | `med.paper-reader` |
| Evidence 详情 | `sidebar.right.pane.tab` | `med.evidence-detail` |
| 工具结果卡片 | `tool.call.toolview`（keyed） | 各工具名 |
| 模式 / 项目切换 | `conversation.session.header.actions` | `med.mode` |
| 设置页 | `settings.section` | `med.settings` |
| 长任务进度 | `shell.overlay`（list） | `med.progress` |

## 42.3 视图状态与导航

- 视图切换用会话头部的视图选择（`selectView(view)`）；跨视图跳转用 `openView(view, focus)`。
- 没有 URL 路由；视图选择不进入浏览器历史。
- 视图是会话作用域：无活跃会话时不渲染，不报错。
- 右栏状态 memory-only：刷新后重置。

## 42.4 客户端插件打包要求

- `package.json` 声明 `dsh.client { platform: 'web' }` 且提供 `exports["./client"]`。
- 自带打包配置（DSH 未对外发布 client bundle preset）。
- 不得运行时 import 其它 `@deepseek-ai/dsh-client-*` feature 包的值；跨包通过 slot 与注入服务协作。
- 提供 zh / en 字典，所有产品文案走 `t`。

---

# 43. Research UI 状态机

```text
IDLE → PLANNING → PLAN_READY → SEARCHING → PAPERS_READY
→ RETRIEVING_EVIDENCE → LOCATING → VERIFYING → ANSWER_READY
```

任意阶段 → `ERROR_PARTIAL`。例如「PubMed 成功，3 篇全文失败」显示部分成功，而不是整页失败。

---

# 44. Evidence UI 状态

```text
FULLTEXT_FOUND / FULLTEXT_PARTIAL
ABSTRACT_FOUND / ABSTRACT_PARTIAL
SECONDARY
NOT_FOUND
REJECTED
```

状态必须显式展示；`PARTIAL` 显示「已定位但非精确匹配」。

---

# 45. Statistics UI 状态机

```text
NO_DATASET → PROFILING → READY → PLANNING → PLAN_READY
→ WAITING_APPROVAL → GENERATING_CODE → EXECUTING
→ SUCCEEDED / FAILED
```

失败时保留代码与 stderr、提供修复入口，但不得伪造 result。

---

# 46. 错误模型

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
PUBMED_RATE_LIMIT / PUBMED_TIMEOUT / PAPER_NOT_FOUND
FULLTEXT_NOT_AVAILABLE / FULLTEXT_LICENSE_BLOCKED
PDF_PARSE_PARTIAL / PDF_PARSE_FAILED
EVIDENCE_NOT_FOUND / EVIDENCE_QUOTE_MISMATCH / CLAIM_UNSUPPORTED
DATASET_PARSE_FAILED
STATISTICS_PLAN_INVALID / CODE_EXECUTION_TIMEOUT / CODE_EXECUTION_FAILED
BUDGET_EXCEEDED / DOMAIN_VERSION_MISMATCH
```

---

# 47. 缓存与隐私

可缓存：PubMed Query Result、Paper Metadata、PMID → Paper、Full-text Resolution、OA Resolution、Embeddings（P1）、短期 Rerank。

禁止：

- 未 scope 的 Project Evidence。
- 用户 Dataset 明文进入共享缓存。
- **行级数据集内容进入模型上下文**（V1.1）：模型只允许看到 schema、profile 与聚合结果。

---

# 48. 可观测性

Research Run：

```text
trace_id / project_id / session_id / query_id
planner_latency / pubmed_latency
paper_count / fulltext_success_count
evidence_count / verified_evidence_count / partial_locator_count
claim_count / rejected_claim_count
model / tokens / cost / budget_exceeded
```

Statistics：

```text
analysis_run_id / runner_latency / status / artifact_count
```

---

# 49. 审计日志

关键事件：project create / delete、paper upload、evidence verify、claim verify、dataset upload、statistics approval、code execute、artifact export。

用于 Debug 和科研复现。

---

# 50. 医学数据安全

Dataset 可能包含患者敏感信息。V1：

- 上传前提示用户去标识化
- Project 隔离
- 私有对象存储 / 本地加密
- Signed URL（如启用远程存储）
- Audit Log
- Runner 无网络
- 不把 Dataset 发给文献 Connector
- **行级数据不进模型**；LLM 输入最小化到 schema / profile / 聚合结果

若未来处理真实可识别患者数据，需要独立做隐私与合规评估。

---

# 51. 文献数据合规

全文保存：

```text
source / license / access_url / retrieved_at
```

原则：使用官方 API、遵守自动访问要求、保留 license metadata、不接 Sci-Hub、不绕过付费墙。

---

# 52. Gold Set

```text
question
expected_key_papers[]
expected_evidence_spans[]
expected_direction
review_notes
reviewer
```

首版 30–50 个真实科研问题，后续扩到 100+。每条必须由人工标注并记录评审者。

---

# 53. 评估指标

| 维度 | 指标 |
|---|---|
| Retrieval | Recall@20、Precision@20 |
| Evidence | Evidence Precision、Locator Accuracy、Relation Accuracy |
| Claim | Claim Support Precision、Unsupported Claim Rate、Counter Evidence Miss Rate |
| Statistics | Execution Success、Fixture Result Consistency、Provenance Completeness |

语义指标必须来自人工 Gold Set，不允许模型自评。

---

# 54. 硬性发布门槛

```text
Paper Identity Validity              = 100%
Verified Evidence Locator Integrity  = 100%   # supportStatus=VERIFIED ⇒ locatorStatus ∈ {FOUND, PARTIAL}
Final Claim Structural Coverage      = 100%   # 每个 Claim ≥1 条满足上行的 Evidence
Statistics Provenance Coverage       = 100%
```

语义准确率使用人工 Gold Set 审核。

---

# 55. 测试矩阵 — PubMed

必须覆盖：known PMID、empty result、malformed query、timeout、rate limit、batch fetch、duplicate records、missing DOI、missing Abstract、分页边界。

---

# 56. 测试矩阵 — Evidence

必须覆盖：Full-text direct support、Full-text direct against、Abstract direct support、secondary citation、wrong paragraph、quote mismatch、relation reversed、claim without evidence、conflicting evidence、归一化边界（连字/连字符/空白）、`PARTIAL` 对齐。

---

# 57. 测试矩阵 — Statistics

Fixture：binary logistic regression、linear regression、categorical comparison、missing data、code error、timeout、超预算、白名单外依赖。

固定 Dataset + 人工确认结果做 regression test。

---

# 58. E2E — Research

```text
输入：PONV 与术后疼痛是否相关？
→ Query Planner → PubMed → 真实 Papers
→ 保存 5 篇 → Evidence Retrieval
→ 2 Support / 2 Against / 1 Uncertain
→ Claim → Verifier → Final Answer
→ 点击 [1] → Paper Reader 定位原文
```

---

# 59. E2E — Statistics

```text
上传 ponv.csv → Dataset Profile → 提问 → Analysis Plan
→ 用户确认 → Python Code → Runner
→ OR / CI / p → Figure → Provenance
→ 查看 dataset_hash + code + runtime
```

---

# 60. 里程碑

| 里程碑 | 内容 |
|---|---|
| M0 — Vertical PoC | Question → PubMed → 20 Papers → Evidence → Claim → Original Text |
| M1 — Research MVP | Project、Query、Search、Paper、Evidence、Locator、Verifier、Reader、4 个视图 |
| M2 — Statistics MVP | Dataset、Plan、Code、Execute、Table、4 类图、Provenance |
| M3 — OA Full Text | PMC、Europe PMC、Unpaywall、OpenAlex |
| M4 — Project RAG | Saved Papers、BM25、向量（P1）、Hybrid Retrieval |

---

# 61. 开工顺序（Slice）

### Slice A
```text
中文问题 → PubMed → PMID → Top 20
```

### Slice B
```text
Paper → Abstract / PDF → Evidence → Original Text（含 locator 状态）
```

### Slice C
```text
Evidence → Claim → Citation Verifier → Final Answer
```

### Slice D
```text
CSV → Analysis Plan → Python → Isolated Runner → Table / Chart
```

### Slice E（P1）
```text
Evidence Table、Statistics History、Reference Chasing、UI polish
```

Project 管理在 Slice A 内以最小形式完成（创建 + 概览），不单列。

---

# 62. Definition of Done

## Research DoD

```text
Question → PubMed Real Paper → Evidence → Original Source
→ Verified Claim → Clickable Citation
```

## Statistics DoD

```text
Real Dataset → Analysis Plan → Executed Code
→ Real Result → Chart → Full Provenance
```

---

# 63. 测试策略与验收映射

| 层级 | 范围 | 工具 |
|---|---|---|
| 单元 | 领域逻辑、归一化、去重、状态机 | vitest，per-file 覆盖 |
| 契约 | storage 域 schema、Runner 接口、Tool schema | vitest + 固定 fixture |
| 集成 | PubMed connector（录制回放）、解析器、Runner 容器 | vitest + 录制样本 |
| E2E | Research / Statistics 两条链 | 录制会话回放，keyless |
| 人工 | Gold Set 语义准确性 | 评审表格 |

| US / FR | 测试 | 类型 |
|---|---|---|
| US-001 / FR-32 | 创建项目并读回 project.json | integration |
| US-002 / FR-1,2 | QueryPlan 生成且未确认不请求 | unit + integration |
| US-003 / FR-3,4 | PMID 来源与去重 | integration |
| US-004 / FR-5,6 | 解析状态与章节结构 | integration |
| US-005 / FR-7,8,9,10 | 归一化定位与状态约束 | unit |
| US-006 / FR-11 | 三类关系分组 | component |
| US-007 / FR-12,13,14 | Claim Gate | unit |
| US-008 / FR-15 | 引用序列化与定位跳转 | E2E |
| US-009 / FR-33 | Dataset Profile | integration |
| US-010 / FR-34 | Plan 待批准不执行 | unit |
| US-011 / FR-18,19,20 | Runner 隔离与失败诚实 | integration |
| US-012 / FR-26 | 图表产物与 provenance | E2E |
| US-013 / FR-18 | provenance 完整性 | component |
| US-014 / FR-24,25 | 视图与右栏 | component |
| US-015 / FR-19 | 设置持久化 | integration |

---

# 64. 实施计划与 Issue 映射

| 阶段 | 交付 | 依赖 |
|---|---|---|
| 1 | `medical-contracts` + `medical-domain` + 存储域 | — |
| 2 | `plugin-project` + `plugin-literate`（PubMed connector） | 1 |
| 3 | `plugin-paper` + `plugin-fulltext`（解析与归一化） | 2 |
| 4 | `plugin-evidence`（检索、定位、校验） | 3 |
| 5 | `plugin-dataset` + `plugin-statistics` + `medical-runner-container` | 1 |
| 6 | `plugin-artifact` | 5 |
| 7 | `plugin-medical-ui`（4 视图 + 右栏 + 工具卡片 + 设置） | 2–6 |
| 8 | `bundle-medical` + profile + Compatibility Test | 全部 |

每阶段完成后运行该表面的最小检查集，不默认跑全量测试。

---

# 65. 风险与假设

## 65.1 技术风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| DSH 无 URL 路由 | 无法深链分享 | 用 `openView` 应用内导航；确有需要再提上游提案 |
| 右栏状态 memory-only | 刷新丢失打开的论文 | 把「上次打开的论文」写入项目域，重开时恢复 |
| 无迁移框架 | 域 schema 升级困难 | 每个域版本化 + 导出/导入命令 |
| PDF 解析质量 | locator 命中率低 | 归一化 + 对齐容差 + PARTIAL 状态 + UI 公开 |
| 自建 Runner 跨平台 | macOS 隔离方案不同 | 先支持 Linux 容器；macOS 用受限子进程并明确标注隔离等级 |
| 客户端打包 preset 未发布 | 外部插件构建摩擦 | 在 `medical-adapter-dsh` 内固化打包配置并做兼容测试 |

## 65.2 假设

- DSH 版本锁定到已验证 commit。
- 统计 Runner 的目标环境支持容器或 bwrap。
- 患者数据默认不出本机。
- 语义验证需要人工 Gold Set 才能判定准确率。
