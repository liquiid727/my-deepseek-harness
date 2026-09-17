# R001 实现情况核对 — 2026-09-14

本轮在 `plugins/med-research`（分支 `medical-workbench`）上继续实现 R001 的八个 required Spec。**没有任何 Spec 达到 accepted**：本轮全部产出为工程实现与实现者自测，缺少独立 QA、医学评审、冻结 Gold Set/阈值和真实 profile 浏览器证据。PRD 2.1.0 与八份 `acceptance.md` 的 decision 仍为 blocked，共识为 **0/8 accepted**。

与 [2026-09-13 核对](implementation-status-2026-09-13.md) 的差别是本轮做了实现，不只是盘点。

## 先修的基线（此前无法建立可信真值）

| 问题 | 处理 |
|---|---|
| `fs-ext` 原生模块 ABI 不匹配（NODE_MODULE_VERSION 141 vs 127）导致组合测试整文件无法加载 | `pnpm rebuild fs-ext` |
| `packages/medical-e2e/package.json` 缺 `plugin-knowledge/skills/writing` 依赖，新包无法解析 | 补 workspace 依赖并重新安装 |
| 8 个失败用例经逐一核实多为**过期期望**（代码已扩展、测试未跟上） | 更新至当前合同，并在测试内写明理由 |
| 真实缺陷：`evidence_save` 在项目不存在时抛裸 `Error` 而非带 code 的信封 | 引入 `PROJECT_NOT_FOUND` 并补测试 |
| 真实缺陷：`researchQueryRevision: plan.revision` 在 `exactOptionalPropertyTypes` 下不合法 | 按 schema 文档化的迁移默认值修正调用点 |
| 真实缺陷：审计写入不做校验，`skill.save_draft` 等未声明的 action 被**静默写入** | 补全 action 枚举；writer 写入前按 schema 校验；`auditOp` 收紧为 `AuditAction`，漂移变成编译错误 |

## 本轮各 Spec 的实现进展

| Spec | 本轮实际完成 | 仍缺 |
|---|---|---|
| [S01](specs/S01-project-workspace/spec.md) | 导航从 5 视图扩到 8 视图；Skills 入口启用；提供/消费两个贡献注册表；profile 组装校验 | Project 列表分页与"当前选择"；create 建立初始 Session；新的真实 profile 浏览器证据（旧截图早于本轮，已标为历史） |
| [S02](specs/S02-literature-discovery/spec.md) | 真实 filter trace 与排除原因；Study Type / Full Text / language 过滤；可注入 AI rerank 且降级显式；冻结候选 + opaque cursor 分页；计数分列；所有网络路径受批准约束 | 独立 related-link connector；live profile 仍走词法序并如实标注降级；Recall/Precision/Counter Miss Rate 未测 |
| [S03](specs/S03-paper-reading/spec.md) | Reader action registry（6 个必交 id）；结构化摘要覆盖规范 16 字段与 `未报告` 语义；报告字段带 anchor | 摘要仍是章节标题投影而非模型抽取；选区工具条与窄屏未在浏览器复核 |
| [S04](specs/S04-evidence-claims/spec.md) | 统一资格规则（PARTIAL 可合格、secondary/UNCERTAIN/withdrawn 不合格）；Claim 聚合 CONSISTENT/INCONSISTENT/CONFLICTING + 去重计数；gate 改用域层 `verifyClaim`；`verify` 记录理由与版本；`withdraw` 传播；引用映射去重并带 PMID/DOI/focus；`chase` 有界追引 | 无 live reference connector；语义关系仍由调用方给定，Relation Accuracy 未测 |
| [S05](specs/S05-reproducible-statistics/spec.md) | 七种图表齐备（+Forest/ROC/Correlation/KM）；`chartApplicability` 给出禁用原因；SVG 出版安全校验；`run`/`listCharts` 暴露到 Remote | `chartApplicability` 未接入视图；隔离矩阵未扩展；无浏览器证据 |
| [S06](specs/S06-knowledge-library/spec.md) | Project RAG（当前 Project 语料 + corpusVersion + 不足即 INSUFFICIENT）；`myLibrary`/`uploaded` 作用域与 membership；search 带 matchedField 与 tag 命中；`setDraftStatus` 收紧为只能置 `DRAFT` | 语料按需计算，`INDEX_REBUILDING` 状态不会出现；无浏览器证据 |
| [S07](specs/S07-skills-center/spec.md) | 完整生命周期 upgrade/revoke/uninstall/deleteDraft；扩权必须重新确认；`updateAvailable` 派生而非覆盖；校验深度；受控测试与取消；全程审计 | 受控测试未真实调用模型；13 个内置 Skill 的业务语义未验收 |
| [S08](specs/S08-evidence-writing/spec.md) | 逐事实现据链接与显式不足占位；编辑事实即回 `DRAFT`；翻译按块/表格单元确定性比对；RIS/BibTeX/Markdown 确定性导出与 `METADATA_INCOMPLETE`/`CITATION_STALE`；`EXPORTED` 生命周期 | 未接入模型写作/翻译轮次，因此文风与译文质量未测 |

## 本轮实际执行的检查

```
cd plugins/med-research
pnpm run typecheck                     → exit 0（host + client 两个 program）
pnpm exec vitest run                   → 158 suites / 425 tests：424 passed, 1 skipped, 0 failed
pnpm run verify:client                 → client bundle ok, 131386 bytes
node scripts/install-local-profile.mjs --print-only --json
                                       → 20 个 @medresearch 包 + 3 个 bundle 组装成功，不写入 harness home
```

组合测试在真实 Loader 上启动 storage / sqlite / storage-domain / fs-local / session-jsonl / workspace / commands / web / tools 与全部 15 个医学插件，并断言：全部服务与 40+ 工具注册、artifact 下载路由注册、备份命令往返、真实工具派发与失败信封，以及 `medReaderActions.missing() === []` 与 `medDraftEditorActions.missing() === []`。

新增/重写的针对性测试：S04 lifecycle（16）、S06 knowledge（18）、S03 summary（5）、S01/S06 selection-actions（8）、S05 charts-p1（15）、审计校验（3）、S02 gaps（含 dedup）、S07 lifecycle（23）、S08 service（20）。

## 未执行

- **真实 API**：环境与仓库根均无 `DEEPSEEK_API_KEY`，`pnpm run test:e2e`、keyless replay 之外的模型链路、以及真实 profile 任务均无法完成。
- **浏览器**：本轮未启动 `pnpm dsh --profile med-research` 生成新截图；S01 的既有截图早于本轮改动，已在其证据中标记为历史而非当前证据。
- **隔离矩阵之外的分析链**：本轮未扩展 runner 隔离测试。
- **独立 QA 与医学评审**：无 QA owner、无 Medical Reviewer、无冻结 Gold Set 与检索阈值，因此 AC-R001-016 与最终 QA 保持 blocked。
- **本地 profile 实装**：`install-local-profile.mjs --force` 在本轮结束时仍在构建 Web payload，未完成，不作为通过证据。

## 判定

- 设计批准的 8 个 Spec 各自的实现都比上一轮更接近合同，但仍**没有任何一个**满足 accepted 条件。
- 不得把本轮的实现者自测（单测、组合测试、类型检查、bundle 校验）当作独立 QA 或医学评审。
- 剩余阻塞的最小所需输入：一份 `DEEPSEEK_API_KEY`（或等价的模型凭据）；一位医学背景且独立于实现与生成模型的 Medical Reviewer；产品负责人批准的分层 Gold Set 与检索指标阈值；一次以当前构建产物运行的真实 profile 浏览器评审。
