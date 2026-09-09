# Med Research Workspace — 会话交接

- 更新：2026-09-09
- 仓库：`/Users/mac_liquiid/Desktop/code/my-deepseek-harness/plugins/med-research`
- 待裁决事项集中记录：`.todo/0909-implement`
- 验证基线：`pnpm run typecheck` 退出码 0（node + client 两面）；`pnpm run test` = 45 files / 255 passed + 1 skipped（macOS 内存强制断言）；`pnpm run verify:client` 通过

## 已完成

| 阶段 | 交付 | 证据 |
|---|---|---|
| 1 | contracts / domain / storage（8 域 18 表） | 领域单测 + 存储契约（版本不匹配 fail-loud、export/import 往返、共享句柄单飞） |
| 2 | plugin-project / plugin-literature | SPEC §55 全部录制回放（真实 NCBI 样本） |
| 3 | plugin-paper / plugin-fulltext | 真实 JATS + 真实 PDF（pdfjs）解析、FOUND/PARTIAL/NOT_FOUND |
| 4 | plugin-evidence | SPEC §56 全矩阵（含 NOT_FOUND→REJECTED 负例） |
| 5 | plugin-dataset / plugin-statistics / medical-runner-container | 隔离 15 例（含 CPU-second 限制）+ SPEC §57 三个回归 fixture + XLSX |
| 6 | plugin-artifact | run 关联 + 导出 + Gate 5；统计执行自动注册 artifact |
| 7（部分） | plugin-medical-ui 的 state + i18n | 状态机与 zh/en 字典 |
| 7（部分） | 宿主 Remote 面 + 客户端数据层 | 7 服务 `@Remote`/`typertRemote`；`createMedRemote` 经真实 Gateway 往返；见 `docs/decisions/2026-09-08-remote-surface.md` |
| 7（部分） | 客户端席位与打包 | 4 视图 + 21 个工具卡片 + 设置页；自带 `lib/client.js` 与产物校验；见 `docs/decisions/2026-09-08-phase7-client-ui.md` |
| 7（部分） | 真实 profile 启动 + 浏览器可见验证 | `dsh --profile med-research --port 3099` 加载成功；4 视图切换、输入框可用、设置分节均实测；见 `docs/decisions/2026-09-08-shared-med-storage-and-profile-install.md` |
| 7（部分） | 引用定位（Evidence → Papers focus） | 组件层已覆盖：`openView('med-papers', paperId\|documentId\|paragraphId\|start\|end)`，Papers 视图高亮并滚动到引文段；见 `docs/decisions/2026-09-08-citation-focus.md` |
| 8（部分） | `scripts/install-local-profile.mjs` | tarball + overrides 的可复现安装；2026-09-09 `pnpm run install:profile --profile med-research --force`、`--print-only` 成功；用本地 checkout 的 `pnpm dsh --profile med-research --dump-config` 成功；3099 端口已有运行中的 profile 进程（重复启动按预期 `EADDRINUSE` 失败） |
| 8（部分） | 真实 Research 链（live PubMed） | 9 次工具调用 / 10 步 / 220K tok：project_create → literature_plan_query → literature_search_pubmed（真实 NCBI）→ paper_get_document → evidence_retrieve → project_save_paper → evidence_retrieve → evidence_save → evidence_verify；最终 `done <evidence id>` |
| 8（部分） | 产物下载路由 | `medArtifacts/export` 改走精确 Fetch 路由 `/api/medArtifact.export`（宿主纯函数 + 客户端卡片下载链接）；路径常量在 contracts 共用 |
| 8（部分） | 真实 Statistics 链（隔离执行 + 审批） | 5 次工具调用 / 6 步 / 116K tok：dataset_profile → statistics_plan → statistics_generate_code → statistics_execute（浏览器点「允许一次」）→ run succeeded，`resultJson={n:8,rates:{drug_a:0.5,drug_b:0.25}}`，artifact 已注册 |
| 8（部分） | Gate 5 竞态修复 | `inject` 增加 `medArtifacts`、`artifactRoot` 改必填；见 `docs/decisions/2026-09-09-statistics-artifact-registration.md` |
| 8（部分） | 存储介质路由修复 | bundle 只插 SQLite backend，profile 把 base 的 `storage-domain` 路由到 sqlite；med 域落到 `.med-run/med.sqlite`（见 `docs/decisions/2026-09-09-storage-backend-routing.md`） |
| 8（部分） | 真实模型轮次冒烟 | 模型调用 `project_create` 成功（2 步 / 36K tok），磁盘生成 `project.json`，研究视图列出项目；修掉两个前置条件（profile 缺 `dsh-storage-sqlite` 导致 REQUEST_EXTENSION、workspaceRoot 必须在会话工作区内）；见 profile 安装决策记录 |
| 8（部分） | 真实 Loader 组合测试 | `medical-e2e/tests/composition.spec.ts`：**全部 9 个 med 插件**经真实 Loader（含本地 fs、会话持久化、workspace 注册）共用一个存储域集启动、注册 22 个工具、提供 9 个服务；断言 artifact 下载路由、每个工具都有卡片、真实 `project_create` 落盘并注册 workspace |
| 8（部分） | Gate / DoD 证据表 | `docs/checklists/gate-evidence.md`：Gate 1–5 与两条 DoD 逐条对应到测试名；兼容面扩到 17 个包 |
| 8（部分） | medical-adapter-dsh、bundle-medical、§29 引用序列化器 | 兼容性测试、patch 结构测试、citation 3 例 |
| 8（部分） | FR-21 备份/恢复入口 | `plugin-project` 注册 `/med-export` / `/med-import` 人工命令（`commands` 为可选表面），经 `ctx.fs` 读写、失败原样上报；见 `docs/decisions/2026-09-09-med-export-import-commands.md` |
| 8（部分） | 审计日志（SPEC §49） | `medical-storage` 新增 `createAuditWriter`；7 个动作在服务层留痕（claim.verify 无服务入口），两条真实链路断言行序与字段；见 `docs/decisions/2026-09-09-audit-trail.md` |
| 8（部分） | 会话 ↔ 项目绑定（SPEC §41） | `project_create` 创建即绑定、`project_get_context` 可省略 `projectId` 用绑定解析并可重新绑定；新增 `PROJECT_NOT_BOUND` 错误码；见 `docs/decisions/2026-09-09-session-project-binding.md` |
| 8（部分） | 工具经真实注册表执行 | `composition.spec.ts` 用真实 Tool runtime 跑 `project_create` / `project_get_context`：参数 schema 校验、绑定落盘、缺参拒绝、无绑定信封；并验证无审批通道时 `statistics_execute` fail-closed（SPEC §40） |
| 8（部分） | 工具面信封矩阵 | 同文件 `returns the declared envelope for every offline-safe tool`：13 个工具返回稳定失败码、2 个空读返回 `ok: true`、2 个统计工具经注册表失败；客户端视图测试补 `afterEach(cleanup)` |
| 8（部分） | 真实模型轮次：审计 + 绑定 + 空串实测 | med-research profile 新会话 `session-e61e1d15…`（模型 DeepSeek-V4-Flash-0910）：`project_create` 落库 `3bb0daf6…`，`med_audit_logs` 出现 `project.create` 行，`med_session_project` 写入该会话绑定；模型 6 次把「不传」写成 `projectId: ""` 导致失败，据此把空串/纯空白按未传处理并 trim 显式 id |
| 8（部分） | Runner 允许 `urllib.parse` | `pathlib` 间接 import `urllib.parse`，此前生成代码用 `pathlib` 必失败；guard 与静态 allowlist 同步允许该子模块，`urllib.request` 仍拒；见 `docs/decisions/2026-09-09-runner-urllib-parse-allowance.md` |
| E2E | medical-e2e：Research 链、Statistics 链、Gate 4 | 5 例跨链集成（keyless） |

## 下一步（新会话从这里开始）

1. 读 `docs/decisions/` 下四份阶段 7 记录，尤其是 `2026-09-08-shared-med-storage-and-profile-install.md`（真实启动步骤与踩坑）。
2. **待你决策的阻塞**（见 `2026-09-08-phase7-client-ui.md`）：
   - `@deepseek-ai/dsh-client-ui-sidebar-right` 未发布到 npm → 右栏 Paper Reader / Evidence 详情无法注册；当前用 `openView('med-papers', paperId)` 在 Papers 视图内读原文。（运行时该包存在，仅缺类型声明。）
   - Remote 面缺列表读取（项目论文 / 文档段落 / 项目证据 / 数据集 / 分析运行）→ 视图只能 focus-driven；另有 SPEC §30 的 `medResearch/.../papers` 与 §5/PRD 的 `medLiterature` + `medPapers` 命名漂移，见 `docs/decisions/2026-09-09-remote-surface-spec-drift.md`，需确认 canonical surface。
   - **Claim Gate + 引用序列化器没有模型入口**：`verifyClaim` / `serializeCitations` 已实现并有单测，但 SPEC §6 无对应工具名、SPEC §27–§29 未说明调用路径。需要裁决：新增 `evidence_verify_claim` 工具，还是把序列化接进答案管线。
   - **FR-22 / SPEC §39 的 Agent Mode 允许列表未实现**：PRD §31 定义了三种 mode 的前缀允许列表，但没有定义用户如何切换 mode（DSH 命令？设置项？）；PRD §31 还写了 `paper_get_content`，SPEC §6 里没有这个名字（实际是 `paper_get_document`）。需要你确认切换入口与以哪份文档的工具名为准。
   - **P0 图表结果接线尚未完成**：PRD §26 / §36 已明确为 Histogram、Box Plot、Bar Chart、Scatter；统计插件提供四类无依赖 SVG 模板，Statistics 视图已展示 profile 缺失值 Bar Chart，但尚未接入分析结果生成代码/Remote 结果视图（见 `docs/decisions/2026-09-09-p0-chart-types.md`）。
3. 浏览器可见验证的剩余项：点引用定位原文（需要数据）；真实 Research/Statistics 链的完整演示；GIF 录制（本机缺 `ffmpeg`/`ffprobe`，需先装或用其他编码路径）。FR-25（无活跃会话不渲染且不报错）已在 hero 上实测通过。
4. 阶段 8 收尾：两条 DoD 的浏览器 E2E（需要模型轮次）。
5. 已知缺口：容器 provider（Linux/CI 验证）；Typert 生成产物（严格 schema）；`shell.overlay` 长任务进度；P0 四类图表模板/客户端渲染；Gold Set 人工评估；审计的 `claim.verify` 与 `sessionId` 待 Claim Gate 服务入口。统计规划/代码生成的未知 dataset/run 已映射为 SPEC §46 稳定 code 信封（见 `docs/decisions/2026-09-09-statistics-error-envelope-research.md`）。

## 约束提醒

- `AGENTS.md` 常驻，不得违反（不改 DSH checkout、工具名 snake_case、模型可见⟺已记录、文案走 zh/en 字典等）。
- 每阶段完成后按 `AGENTS.md` §7 汇报，等确认再进下一阶段。
- `.med-run/` 是本地 profile 运行态（sqlite、workspaces、截图），已 gitignore，不要提交。
