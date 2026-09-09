# Med Research Workspace — Gate 与 DoD 证据表

> 用途：PRD §35 的 Gate 1–5 与 PRD §36 两条 DoD，逐条对应到实际存在的测试与命令。
> 基线：`pnpm run typecheck` 退出码 0；`pnpm run test` = 45 files / 255 passed + 1 skipped（macOS 内存强制断言）。
> 复跑单条：`npx vitest run <文件> -t '<测试名>'`。表中只列已实际断言的项；未覆盖项集中在文末。

---

## Gate 1 — Source Integrity（PMID / DOI 只来自 Connector / Parser）

| 断言 | 证据 |
|---|---|
| EFetch 响应归一化出真实 PMID / DOI | `plugin-literature/tests/connector.spec.ts` → `normalizes real EFetch records for a known PMID set` |
| 空结果不编造记录、也不发 EFetch | 同上 → `returns an empty result without inventing records or calling EFetch` |
| 缺 DOI / 摘要的记录照实保留并标 unavailable | 同上 → `keeps a record with no DOI and no abstract, marking full text unavailable` |
| 搜索落库时用 connector 给的标识符 | `plugin-literature/tests/service.spec.ts` → `persists searched papers with connector-assigned identifiers` |
| 解析出的论文沿用 connector 标识符（上传/解析不新造） | `plugin-paper/tests/service.spec.ts` → `stores a parsed JATS document with ordered sections and normalized paragraphs` |
| 身份优先级 PMID > DOI > PMCID > title+year | `medical-domain/tests/dedup.spec.ts` → `prefers PMID over DOI, PMCID, and title` |

## Gate 2 — Evidence Locator Integrity

| 断言 | 证据 |
|---|---|
| 每条 evidence 的偏移基于归一化段落 | `plugin-paper/tests/service.spec.ts` → `keeps evidence offsets relative to the normalized paragraph (SPEC §22.3)` |
| 归一化规则（NFKC、连字、连字符、空白、引号） | `medical-domain/tests/normalize.spec.ts`（9 例） |
| 定位在归一化边界上仍命中 | `plugin-evidence/tests/service.spec.ts` → `matches a quote across normalization edges (ligature, hyphen, whitespace)` |
| 近似匹配记为 PARTIAL 且仍可定位 | 同上 → `accepts a near match as PARTIAL and keeps it locatable` |
| 错段落的引文记为 NOT_FOUND / REJECTED | 同上 → `records a quote from the wrong paragraph as NOT_FOUND / REJECTED` |
| 硬约束：NOT_FOUND 永远不能变 VERIFIED（负例） | 同上 → `never turns a NOT_FOUND evidence into VERIFIED (hard rule negative)`；`medical-domain/tests/evidence-state.spec.ts` → `forces REJECTED whenever the locator is NOT_FOUND` |
| Claim Gate 会拒绝「引文已无法重新定位」的证据 | `medical-domain/tests/claim-gate.spec.ts` → `rejects evidence whose quote no longer relocates` |

## Gate 3 — Claim Structure

| 断言 | 证据 |
|---|---|
| 无证据的 Claim 被 Claim Gate 以 `noSupport` 拒绝（不放行） | `medical-domain/tests/claim-gate.spec.ts` → `reports no supporting evidence when the claim binds none (FR-13/FR-14)` |
| 引用编号由后端序列化器按首次出现顺序生成 | `medical-domain/tests/citation.spec.ts` → `numbers citations in first-appearance order and maps to paper ids` |
| 引用未知证据被拒 | 同上 → `rejects a claim citing unknown evidence (FR-12)` |
| 无证据时绝不发明引用 | 同上 → `never invents a citation for a claim without evidence` |
| 绑定的 evidence 不存在时拒绝 | `claim-gate.spec.ts` → `rejects a claim that binds an evidence_id that does not exist (FR-12)` |
| 未 VERIFIED / locator NOT_FOUND 的证据不能支撑 Claim | 同上 → `rejects evidence that is not VERIFIED`、`rejects evidence whose locator is NOT_FOUND` |
| 反证也可绑定，悬空反证被拒 | 同上 → `accepts verified counter evidence and rejects a dangling counter id` |

## Gate 4 — Failure Honesty

| 断言 | 证据 |
|---|---|
| PubMed 限流 → 失败外显且不落库 | `medical-e2e/tests/failure-honesty.spec.ts` → `a rate-limited PubMed search fails loud and stores no papers` |
| 解析失败 → FAILED 且无段落/证据 | 同上 → `an unparseable document is FAILED and yields no paragraphs or evidence` |
| Runner 失败 → 无 result、无 artifact | 同上 → `a failed run stores no result and no artifact` |
| Runner 自身不伪造结果 | `plugin-statistics/tests/statistics.spec.ts` → `keeps code and stderr and stores no result on failure (FR-20)`；`medical-runner-container/tests/process-runner.spec.ts` → `reports code errors without inventing a result` |
| Runner 资源限制 | `medical-runner-container/tests/process-runner.spec.ts` → wall-clock timeout、CPU-second limit、输出截断均有回归断言；内存上限由 launcher/RSS watchdog best-effort 执行，macOS 因系统不支持可用的 `RLIMIT_AS`/进程 RSS 监控而跳过强制分配断言 |
| 连接器不重试不可重试错误、超时外显 | `plugin-literature/tests/connector.spec.ts` → `does not retry a non-retryable HTTP error`、`maps a hanging request to PUBMED_TIMEOUT` |

## Gate 5 — Statistics Provenance

| 断言 | 证据 |
|---|---|
| 未审批不得执行 | `plugin-statistics/tests/statistics.spec.ts` → `requires an approved run before execution`、`asks before statistics_execute and allows every other tool`；`composition.spec.ts` → `runs the project tools through the real Tool runtime and binds the session`（真实注册表里无审批通道时 `statistics_execute` fail-closed） |
| 成功 run 记录完整 provenance | 同上 → `records full provenance on a successful run` |
| 成功 run 的产物自动注册为 artifact | 同上 → `links a succeeded run's outputs to artifact records`；`does not register artifacts for a failed run` |
| artifact 只能关联成功 run | `plugin-artifact/tests/artifact.spec.ts` → `refuses to link an artifact to a run that did not succeed (Gate 5)` |
| 每个 artifact 都能追回成功 run | 同上 → `traces every registered artifact back to a succeeded run` |
| 统计链路端到端（CSV → 隔离执行 → artifact provenance） | `medical-e2e/tests/statistics-chain.spec.ts` → `runs CSV → profile → plan → code → isolated execution → artifact provenance` |
| 三个统计回归 fixture（线性回归 / 卡方 / 逻辑回归） | `plugin-statistics/tests/regression.spec.ts`（3 例） |

---

## DoD — Research Chain

`medical-e2e/tests/research-chain.spec.ts` → `runs question → real PMID → JATS → evidence → verified claim → [1] citation`

覆盖：研究问题 → 真实 PMID（录制回放）→ Paper → JATS 全文 → Evidence Span（可重新定位）→ Claim → 引用序列化。
**未覆盖**：浏览器里点击 citation 跳到原文（见文末）。

## DoD — Statistics Chain

`medical-e2e/tests/statistics-chain.spec.ts` → `runs CSV → profile → plan → code → isolated execution → artifact provenance`

覆盖：上传 CSV → Profile → Analysis Plan → 确认 → 隔离执行 → 真实结果 → artifact provenance。

---

## 组合与接线

| 断言 | 证据 |
|---|---|
| 全部 9 个 med 插件经真实 Loader 共用一个存储域集启动（单飞共享句柄） | `medical-e2e/tests/composition.spec.ts` → `boots every med plugin over one shared storage domain set and registers their tools` |
| 组合后的服务在共享存储上真实读写 | 同上 → `serves a composed service call over the shared storage`（上传 CSV → `statistics_plan` → 执行 → artifact）与 `creates a project through the composed fs and workspace services`（真实 fs 写 `project.json` + 注册 workspace） |
| 每个模型可调用工具都有客户端卡片 | 同上：组合注册的工具集与 `MED_TOOL_NAMES` 交叉校验 |
| DSH 版本 / 导出面兼容 | `medical-adapter-dsh/tests/compatibility.spec.ts`（17 个包） |
| 产物字节下载（非 JSON Remote） | `plugin-artifact/tests/artifact.spec.ts` 路由响应；`plugin-medical-ui/tests/toolview.client.spec.tsx` 卡片链接；`composition.spec.ts` 断言 Web 组合注册该路由 |
| profile 安装可复现 | `medical-e2e/tests/install-profile.spec.ts`（含「bundle 行命名的 DSH 包必须是 profile 依赖」） |
| 备份 / 恢复入口（FR-21、SPEC §15.2） | `plugin-project/tests/backup.spec.ts`（7 例：往返、含空格路径、缺路径、不可读路径、非法 JSON、域版本不匹配、未声明域）；`composition.spec.ts` → `registers the backup commands and round-trips the store through the real fs`（真实 Loader + 真实 `ctx.fs`） |
| 审计日志（SPEC §49） | `medical-storage/tests/audit.spec.ts`（4 例）；`research-chain.spec.ts` 断言 `project.create` → `evidence.verify`；`statistics-chain.spec.ts` 断言 `dataset.upload` → `statistics.approve` → `code.execute` → `artifact.export`；`plugin-project/tests/service.spec.ts`（`project.delete`）；`plugin-paper/tests/pdfjs.spec.ts`（`paper.upload` 只记 `paperId`/`filename`）；审计行随备份往返（`backup.spec.ts`、`composition.spec.ts`） |
| 会话 ↔ 项目绑定（FR-23、SPEC §41） | `plugin-project/tests/tools.spec.ts`（6 例：创建即绑定、无 agent 不写、省略 id 用绑定解析、显式 id 重新绑定、`PROJECT_NOT_BOUND`、`PROJECT_NOT_FOUND`）；`plugin-project/tests/service.spec.ts`（`bindSession` 校验项目、覆盖旧绑定；`sessionProject` 读回）；`composition.spec.ts` → `runs the project tools through the real Tool runtime and binds the session` |
| 工具经真实注册表执行 | `composition.spec.ts` → `runs the project tools through the real Tool runtime and binds the session`（schema 校验、绑定落盘、缺参拒绝、无绑定信封、`statistics_execute` 无审批通道 fail-closed）；→ `returns the declared envelope for every offline-safe tool`（13 个失败信封的稳定 code、2 个空读 `ok: true`、2 个统计工具经注册表失败） |
| 真实 Statistics 链（隔离执行 + 审批，非回放） | med-research profile 实测：dataset_profile → plan → generateCode → execute（点「允许一次」）；run `9f37221e…` succeeded，`resultJson={n:8,rates:{drug_a:0.5,drug_b:0.25}}`，artifact `bed9c7f3…` 关联该 run |
| 真实 Research 链（live PubMed，非回放） | med-research profile 实测：9 次工具调用走通 plan → search → document → retrieve → save → verify；最终 evidence `d7719a19…` 记录 `locatorStatus=FOUND`、`supportStatus=VERIFIED`、`sourceType=abstract`、offset 1596–1751 |
| 真实模型 → 工具 → 服务 → 存储 → UI | med-research profile 实测：`project_create` 2 步成功，磁盘生成 `project.json`，研究视图列出项目（见 profile 安装决策记录） |
| 真实模型轮次：审计 + 绑定（SPEC §41、§49） | 2026-09-09 med-research profile 新会话 `session-e61e1d15…`（DeepSeek-V4-Flash-0910）：`project_create` 落库 `3bb0daf6…`，`med_audit_logs` 出现 `project.create` 行，`med_session_project` 写入该会话绑定；同轮发现模型 6 次传 `projectId: ""`，据此修复空串处理 |
| Runner 允许 `urllib.parse`（FR-19） | `process-runner.spec.ts` → `keeps urllib.request blocked while allowing the pure urllib.parse parser`（静态预检拒 `urllib.request`、动态 import 被 guard 拒、`pathlib` + `urllib.parse` 成功）与 `disallowedImports` 断言；见 `docs/decisions/2026-09-09-runner-urllib-parse-allowance.md` |

---

## 尚未覆盖 / 需要单独证据

| 项 | 状态 | 原因 |
|---|---|---|
| 浏览器里点击引用定位原文 | 组件层已覆盖，浏览器端待真实数据 | `plugin-medical-ui/tests/views.client.spec.tsx` 断言「打开原文」传出 `paper-1\|document-1\|paragraph-1\|17\|21` 且 Papers 视图高亮该 span；见 `docs/decisions/2026-09-08-citation-focus.md`。浏览器演示需要先跑通 Research 链产生数据 |
| 无活跃会话不渲染（FR-25） | 已覆盖 | 浏览器实测：清空客户端状态后进入 hero，`medTabs` 为空、无 Med 文案、CDP `Log`/`Runtime` 零异常事件；截图 `.med-run/screenshots/06-no-session.png` |
| Claim Gate + 引用序列化器的模型入口 | 库已实现、未接线 | `verifyClaim` / `serializeCitations` 只在单测中使用；SPEC §6 没有对应工具名，SPEC §27–§29 也未说明调用路径。需要你裁决：新增一个 `evidence_verify_claim` 工具，还是把序列化放进答案管线 |
| Gold Set 人工评估（语义准确率） | 未覆盖 | PRD §35 要求人工评估，不能由测试代替 |
| 真实 PubMed 网络链路 | 已覆盖 | 2026-09-09 在 med-research profile 实测（真实 NCBI E-utilities 200 + 9 次工具调用） |
| 两条 DoD 的真实模型演示 | 已覆盖（数据面） | 2026-09-09 在 med-research profile 各跑一次真实轮次：Research 链 9 次工具调用、Statistics 链 5 次工具调用 + 审批；证据见上表 |
| 浏览器里从引用点回原文 | 组件层已覆盖，浏览器入口未覆盖 | 需要列表读取才能让视图发现 claimId/paperId；右栏席位类型包亦未发布；Remote 还存在 SPEC §30 `medResearch` 与 §5/PRD `medLiterature` + `medPapers` 命名漂移，见 `docs/decisions/2026-09-09-remote-surface-spec-drift.md` |
| Agent Mode 允许列表（FR-22 / SPEC §39） | 未实现 | PRD §31 定义了三种 mode 的工具前缀允许列表，但没有定义用户如何切换 mode；`ctx.tools.restrict()` 只接受 agent 作用域 ctx，插件 apply 阶段无法全局调用。需要裁决切换入口与工具名基准 |
| P0 四类图表（PRD §26、§36） | 模板、profile 视图与 figure 产物链已覆盖，分析结果视图未覆盖 | `plugin-statistics/src/charts.ts` 提供四类无依赖 SVG 模板；`plugin-medical-ui/src/client/profile-chart.tsx` 展示真实 profile 缺失值 Bar Chart；`medical-e2e/tests/statistics-chain.spec.ts` 验证 SVG figure 的执行、provenance 与导出；尚未接入分析结果生成代码/Remote 结果视图，见 `docs/decisions/2026-09-09-p0-chart-types.md` |
| 审计的 `claim.verify` 与 `sessionId` | 部分 | `claim.verify` 没有服务入口（Claim Gate 是库函数，见上一行），无法留痕；`sessionId` 服务层拿不到，字段保持可选。其余 7 个 SPEC §49 动作已覆盖 |
| 统计工具失败信封的稳定性 | 已覆盖 | `medical-e2e/tests/composition.spec.ts` 经真实注册表断言未知 dataset → `DATASET_NOT_FOUND`、未知 analysis run → `STATISTICS_PLAN_INVALID`，均为 `isError: false` 的 `{ ok:false,error }` 信封；执行入口的未知/未审批 run 也复用该稳定码并有服务层边界测试；未捕获异常仍保持真实失败。 |
| Tool envelope 成功/失败分支互斥且字段完整 | 已覆盖 | `medical-contracts/tests/tool-envelope.spec.ts` 编译共享 schema 并断言成功、失败、缺字段及混合字段均按 exact-one `oneOf` 规则校验。 |
| 图表产物仅允许匹配的 PNG/SVG | 已覆盖 | `plugin-artifact/tests/artifact.spec.ts` → `rejects figure outputs outside the PRD PNG/SVG export contract`、`rejects a figure whose extension disagrees with its MIME type`；不支持格式在复制前以 `FIGURE_FORMAT_UNSUPPORTED` 失败且不落库。 |
| Runner 拒绝损坏的 SVG figure | 已覆盖 | `medical-runner-container/tests/process-runner.spec.ts` → `rejects an incomplete SVG figure instead of registering it as an output`；同时接受 XML declaration/DOCTYPE 合法前导；不完整 SVG 不进入 outputs/artifact 链。 |
| GIF 证据 | 未覆盖 | 本机缺 `ffmpeg` / `ffprobe` |
