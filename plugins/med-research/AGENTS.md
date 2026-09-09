# AGENTS.md — Med Research Workspace

> **落地方式**：把本文件复制为 `<MED_REPO>/AGENTS.md`。它是本仓库的常驻约束，每个会话开工前自动生效，不需要在提示词里重复。
> 本仓库是在 DeepSeek Harness（DSH）之上构建的 **out-of-tree 插件套件**，不修改 DSH checkout 的任何文件。

---

## 1. 事实来源（Source of Truth）

- 需求：`docs/prd/med-research-workspace-ultimate-prd-v1.1.md`
- 技术规格：`docs/spec/med-research-workspace-ultimate-spec-v1.1.md`
- 原始评审留档：DSH checkout 的 `.todo/` 下 v1.0 两份文档。

规则：需求缺失、矛盾或与本文冲突时，**停下来报告**，不要自行发挥或改需求。文档是唯一权威，不要凭记忆实现。

---

## 2. 不可违反的约束（Standing Orders）

### 2.1 DSH 集成

1. **不改 DSH Core。** 全部能力通过 out-of-tree 包 + bundle patch 行提供（SPEC §2、§4）。
2. **记录 DSH 版本。** 新仓库 `README.md` 必须写明适配的 DSH version / commit；升级前跑 Compatibility Test（SPEC §65.2）。
3. **注册即 effect。** 所有贡献走 `ctx.effect()` / `ctx.on()` 并返回 disposer（DSH 约定）。
4. **patch 非 deep merge。** bundle patch 按 row id 整体替换 config，每行重述其全部 config。
5. **客户端插件三处注册齐全**：tsconfig 引用、bundle patch 的 `dsh.client` 行、bundle `package.json` 依赖；缺一会在不同阶段失败（SPEC §42.4）。

### 2.2 命名与结构

6. **包名** `@medresearch/dsh-<name>`；服务键加 `med` 前缀（`ctx.medProjects` 等，SPEC §5）。
7. **工具名扁平 snake_case**（`literature_search_pubmed`）。点号会破坏 PTC 的 `tools.<name>(args)`（SPEC §6）。
8. **包布局与导出形态**按 `mydsh-plugin-repo-standard` 技能；一个 UI 功能 = 一个客户端插件包。

### 2.3 模型与上下文

9. **模型可见 ⟺ 已记录。** 任何进入模型请求的项目上下文必须走工具结果或 `medical/project-context` 会话事件（SPEC §41）。
10. **不写模型适配器。** 模型接入由 DSH 的 `dsh-llm-pi-ai` / `dsh-llm-deepseek` 配置提供；插件内的 provider/model 一律从 `Config` 读，**不得硬编码**。路由策略未定前不得自行选模型。
11. **会话内模型固定。** 不中途切换 provider/model（跨路由的 provider 原生状态回放不可靠）。
12. **行级数据不进模型。** 数据集行级内容只允许进入隔离 Runner；模型只看到 schema / profile / 聚合结果（SPEC §47、§50）。

### 2.4 存储

13. **V1 存储 = DSH `storage-domain`（sqlite backend）+ 项目目录**；不用 Postgres / pgvector / Redis（SPEC §15）。
14. **每个域自带 `version`**，并提供 `medExport` / `medImport` 导出导入路径；版本不匹配必须 fail-loud，禁止静默兼容（SPEC §15.2）。

### 2.5 统计执行

15. **Runner 必须自建隔离实现**（容器或 bwrap）：无网络、只读数据集、受控输出目录、CPU/内存/超时限额、包白名单、无宿主密钥（SPEC §36）。
16. **禁止**把 DSH 实验包 `code-runtime-python` 当作数据集执行器；E2B 默认禁用。
17. **未经 `ctx.approval.request()` 不得执行统计代码**；审批策略放 `tools/pre-execute`，不放 Tool 实现体（SPEC §40）。
18. **Runner 失败时不得输出统计结论**；保留代码与 stderr，`status = FAILED`。

### 2.6 证据链

19. **Evidence 状态必须拆开**：`locator_status ∈ {FOUND, PARTIAL, NOT_FOUND}` 与 `support_status ∈ {PENDING, VERIFIED, REJECTED}`（SPEC §11）。
20. **硬约束**：`support_status = VERIFIED` 只能出现在 `locator_status ∈ {FOUND, PARTIAL}` 上；`NOT_FOUND` 一律 `REJECTED`。
21. **定位遵循 SPEC §22.3 归一化规则**；offset 基准固定为归一化段落文本。
22. **每条 Evidence 必须记录** `extractor_version` / `extractor_model` / `prompt_version`。
23. **引用编号 `[n]` 由后端序列化器生成**，模型不得自编 DOI / PMID / 引用号（SPEC §29）。

### 2.7 UI

24. **UI 用方案 A**：`conversation.view` 视图 + `ctx.sidebarRightTabs` / `sidebar.right.pane.tab` + `tool.call.toolview` + `settings.section` + `shell.overlay`（SPEC §42）。
25. **不做 URL 路由，不建独立前端，不替换 shell**（`root` / `sidebar.workspaces` 为 single 且已被占用）。
26. **视图是会话作用域**：无活跃会话时不渲染且不报错（FR-25）。
27. **客户端文案全部走 zh/en 类型化字典**，禁止硬编码产品文案；不运行时 import 其它 `@deepseek-ai/dsh-client-*` feature 包的值。
28. **客户端打包配置自带**（DSH 未对外发布 client bundle preset）。

### 2.8 Agent 行为

29. **Agent Mode 用 `ctx.tools.restrict()` 动态允许列表**，不切换 preset（preset 只在会话未产出前可换，SPEC §39）。
30. **不得伪造结果、静默降级或吞掉错误**；任何中间步骤失败都必须暴露真实失败状态（Gate 4）。
31. **Evidence 不足时必须明确说不足**，不得用模型参数知识填充研究结果。
32. **不把相关性描述为因果关系**，除非证据明确支持。

---

## 3. 仓库布局

```text
med-research/
├── AGENTS.md
├── docs/
│   ├── prd/med-research-workspace-ultimate-prd-v1.1.md
│   ├── spec/med-research-workspace-ultimate-spec-v1.1.md
│   └── decisions/          # 非平凡决策记录
├── packages/
│   ├── bundle-medical/
│   ├── plugin-project/ plugin-literature/ plugin-paper/ plugin-fulltext/
│   ├── plugin-evidence/ plugin-dataset/ plugin-statistics/ plugin-artifact/
│   ├── plugin-medical-ui/
│   ├── medical-contracts/ medical-domain/ medical-storage/
│   ├── medical-runner-container/ medical-adapter-dsh/
└── package.json
```

---

## 4. 编码约定

- ESM；跨包用包名导入，包内相对导入带扩展名。
- 部署可变参数一律做成可校验的 `Config` 字段；不写 `DEFAULT_*` 常量、不藏 `?? default`。
- 显式优于隐式：默认值必须是拥有方实现里的显式 `resolve(request): Spec` 步骤。
- 跨边界的不透明 id 用 branded 类型，不用裸 `string`。
- 单次写入原子、失败 loud；空 `catch` 必须写明它吞了什么、为什么没有别的东西能到那里。
- 注释写契约（前置/后置/不变量/失败语义），不写推理过程或变更历史。

---

## 5. 测试与验证

按表面选最小检查集，**不要默认跑全量**：

| 表面 | 必跑 |
|---|---|
| 领域逻辑 / 归一化 / 状态机 | 单元测试 |
| 存储域 / Runner 接口 / Tool schema | 契约测试 |
| PubMed connector / 解析器 / Runner | 录制回放的集成测试 |
| 客户端组件 | 组件测试 + 浏览器实际可见 |
| 两条可信链 | keyless 录制回放 E2E |

- 每个阶段的失败用例、边界用例必须覆盖，不只 happy path。
- 真实外部 API（PubMed、Runner 镜像）只在显式 e2e 模式下调用；日常用 fixture 回放。
- **不得声称通过任何未实际运行的检查**；汇报时给出命令与真实输出。

---

## 6. 阶段与完成定义

- 推进顺序：SPEC §64 的 8 个阶段；P0/P1 范围按 PRD §34。
- 一次只做一个阶段；做完停下汇报，等确认再进入下一阶段。
- 完成定义：PRD §36 的 Research DoD 与 Statistics DoD 两条链端到端跑通。
- 发布门槛：PRD §35 的 Gate 1–5 逐条给出证据。

---

## 7. 汇报格式

每个阶段结束时输出：

1. 改动文件清单（新增 / 修改）。
2. 实际执行的命令与真实输出。
3. 对照本文第 2 节，逐条说明是否违反。
4. 未决问题与需要我决策的点。
5. 是否可以进入下一阶段。

---

## 8. 决策记录

非平凡改动必须在 `docs/decisions/` 留一份决策记录：问题、决定、放弃的方案与原因、需要的验证。局部机械改动可豁免。
