# 决策：阶段 2 —— QueryPlan 生成方、服务定义偏离与论文持久化

- 状态：已实施（阶段 2）
- 日期：2026-09-08
- 依据：PRD §30、SPEC §18–§19、AGENTS.md §2.2 #6、§2.3 #10、§2.1 #3；`mydsh-plugin-repo-standard`

## 1. QueryPlan 由 Agent 产出，工具只做确定性校验与持久化

PRD §30 明确「Agent 负责决策与流程编排；Tool 负责确定性动作；Service 负责稳定业务能力」。FR-1 要求把自然语言问题转成 PICO / 概念 / 同义词 / MeSH / 至少 primary+broad 查询，这是语义工作。

**决定**：`literature_plan_query` 接收 Agent 提出的结构化 `QueryPlan`，用 `queryPlanSchema` 校验、校验至少各有一条 primary/broad（SPEC §18），再落库为 `ResearchQuery`。插件不调用 LLM。

**放弃**：插件内调用 LLM 生成 plan。AGENTS.md §2.3 #10 要求 provider/model 一律从 Config 读且「路由策略未定前不得自行选模型」，当前无路由决策，插件内自选模型会违反该约束。

## 2. 有意偏离 out-of-tree 技能「不写 Service Definition」

`mydsh-plugin-repo-standard` 要求 out-of-tree 包只写 Provider/Consumer、不声明新服务。本仓库声明 `ctx.medProjects` / `ctx.medLiterature` 等。

**决定**：偏离，依据是本仓库 AGENTS.md §2.2 #6 与 SPEC §5 明确要求 `med` 前缀业务服务，且 SPEC §3 把 Service Definition 放进 `medical-contracts`。DSH 的 Cordis 支持 `ctx.provide`（`vendor/cordis/src/reflect.ts:277`），能力上可行。本仓库 AGENTS.md 优先于通用技能。

## 3. 搜索结果即时持久化为 Paper

`literature_search_pubmed` 把返回的记录按身份去重后写入 `med_papers`，`project_save_paper` 只写 `med_project_papers` 关联。

**决定**：先落 Paper，再落关联。理由：FR-3 要求 PMID/DOI 只能来自响应；若 `project_save_paper` 接收模型给的元数据，模型就能伪造标识。现在保存工具只接收服务端产生的 `paperId`。

**放弃**：内存缓存 Paper 元数据待保存时取用。重启即丢失，且 `med_session_project` 之类的绑定也需要持久。

## 4. project.json 写入走 `ctx.fs`，工作区注册走 `ctx.workspaceRegistry`

`ctx.workspaceRegistry.create` 要求目录已存在，`ctx.fs` 无 `mkdir` 但 `writeText` 会递归建父目录。

**决定**：先 `ctx.fs.writeText(<workspace>/.medresearch/project.json)`（隐式建目录），再 `ctx.workspaceRegistry.create(workspacePath, name)`，最后写域记录。顺序保证注册时目录存在。

**已知缺口**：`delete` 只删域记录，不删目录、不注销工作区（V1 无破坏性删除；SPEC §40 要求资产删除需审批，随工具策略层落地）。

## 5. 依赖 `fast-xml-parser` 解析 PubMed XML

EFetch 返回 XML，标题/摘要含 `<i>`/`<sup>` 等行内标签。`preserveOrder: true` 保留文档顺序，避免行内标签重排文本。

**放弃**：手写 XML 解析（易错、无测试价值）；用 ESummary JSON（不含摘要，无法满足 §8 的 abstract 字段）。
