# 决策：阶段 3 —— 文档解析、全文解析渠道与 PDF 提取缺口

- 状态：已实施（阶段 3），其中 PDF 文本提取**未实现**（见 §4）
- 日期：2026-09-08
- 依据：SPEC §21–§23、§34；AGENTS.md §2.2 #8、§5

## 1. 共享有序 XML 读取包 `medical-xml`

PubMed EFetch 与 JATS 都需按文档顺序读取 XML（`preserveOrder`），且属性必须与元素一起读取。

**决定**：抽出 `@medresearch/dsh-medical-xml`，提供 `parseOrderedXml`/`children`/`child`/`attrOf`/`textOf`。`plugin-literature` 的 `pubmed/parse.ts` 改为使用它。

**放弃**：两个包各写一份（重复约 70 行，且行为可能漂移）。

## 2. 解析状态语义（`parseStatus`）

- `READY`：正文有段落。
- `ABSTRACT_ONLY`：只有摘要解析成功。
- `PARTIAL`：有结构但无段落（或 PDF 有页失败/空白）。
- `FAILED`：XML 非法、非 JATS，或 PDF 无任何文本。

无效 XML 返回 `FAILED` 而不是抛异常，保证 UI 能显示真实失败状态（Gate 4）。

## 3. 全文解析走 Europe PMC `fullTextXML`

SPEC §21 的渠道优先级是 PMCID → PMC → Europe PMC → …。NCBI 的 PMC OA 服务返回的是打包链接而非直接 XML。

**决定**：V1 对带 PMCID 的论文请求 `https://www.ebi.ac.uk/europepmc/webservices/rest/<PMCID>/fullTextXML`，成功则 `available` + `machineReadable`，失败或非 200 则按摘要回退为 `abstract_only`/`unavailable`。Unpaywall/OpenAlex/Publisher 属 P1。

**放弃**：把 NCBI PMC OA 包（tgz/pdf）解包（需要额外解压与许可判断，且 PDF 提取未就绪）。

## 4. PDF 文本提取使用 `pdfjs-dist`

`plugin-paper` 的 `upload` 依赖注入的 `extractPdf` 适配器；适配器使用 `pdfjs-dist` 的 legacy 构建（Node 无 DOM 也可运行）。某一页提取失败时标记 `failed`，装配出的文档状态为 `PARTIAL`，不会静默丢页。

**验证**：`packages/plugin-paper/tests/fixtures/pdf/sample.pdf`（pdfkit 生成的两页 PDF）经真实 `pdfjs-dist` 提取出两页文本，并通过 `upload` 落库为 `READY` 文档与带页码段落。样本由根 `devDependencies` 的 `pdfkit` 生成，运行时不需要它。

**放弃**：手写最小 PDF 解析（xref 易错）；从 Europe PMC/PMC 下载真实 OA PDF（两个端点当前 404）。

## 5. `paper_search_content` 为线性扫描

SPEC §15/§23 的 FTS 索引属后续工作。

**决定**：V1 在论文范围内做大小写不敏感子串扫描，结果条数由 `maxSearchResults`（默认 50）限制。论文级 FTS 与向量检索延后（P1）。
