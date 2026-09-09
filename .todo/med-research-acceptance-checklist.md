# Med Research Workspace — 阶段验收清单

> 用法：goal 每完成一个阶段，逐条自检，并在汇报中给出**证据（文件:行 / 命令 / 输出）**。
> 约束来源：`AGENTS.md` §2；规格来源：`docs/spec/med-research-workspace-ultimate-spec-v1.1.md` §64。
> 任何一条不通过 → 不得进入下一阶段。

---

## 通用门禁（每个阶段都查）

- [ ] 改动文件清单已列出（新增 / 修改）
- [ ] typecheck 通过，附命令与真实输出
- [ ] 本阶段最小检查集全部通过，附命令与真实输出
- [ ] `AGENTS.md` §2 的 32 条约束逐条自检，无违反
- [ ] 无硬编码的部署参数（全部为可校验 `Config` 字段）
- [ ] 无未记录却进入模型请求的内容（违反「模型可见 ⟺ 已记录」）
- [ ] 无伪造结果、静默降级、吞掉错误的分支
- [ ] 非平凡决策已写入 `docs/decisions/`
- [ ] 失败用例与边界用例已覆盖，不只 happy path

---

## 阶段 1 — contracts / domain / 存储域

| 项 | 内容 |
|---|---|
| 交付 | `medical-contracts`、`medical-domain`、`medical-storage` |
| 必跑 | 领域单测：去重、状态机、`normalizeParagraph`（SPEC §22.3）、Claim Gate；存储契约测试：读写 + 版本不匹配 fail-loud |
| 通过 | FR-4/7/8/9/10/21 均有测试覆盖；`medExport` → `medImport` 往返一致 |
| 停止条件 | 领域模型与 SPEC §7–§14 有出入；或存储域无法表达某实体 |

## 阶段 2 — project / literature

| 项 | 内容 |
|---|---|
| 交付 | `plugin-project`、`plugin-literature` |
| 必跑 | SPEC §55 全部用例的录制回放（含空结果、超时、限流、重复、缺 DOI/Abstract、分页边界） |
| 通过 | PMID/DOI 只来自响应；未确认前零网络请求（FR-2）；`project.json` 生成且绑定 Workspace |
| 停止条件 | PubMed 限流/分页策略无法在配置内满足 |

## 阶段 3 — paper / fulltext

| 项 | 内容 |
|---|---|
| 交付 | `plugin-paper`、`plugin-fulltext` |
| 必跑 | 归一化与对齐单测（连字、连字符、空白、引号）；解析状态用例；PARTIAL 对齐用例 |
| 通过 | `locator_status ∈ {FOUND, PARTIAL, NOT_FOUND}` 产出正确；offset 基准为归一化段落 |
| 停止条件 | 解析器需要外部付费服务或违反合规渠道 |

## 阶段 4 — evidence

| 项 | 内容 |
|---|---|
| 交付 | `plugin-evidence` |
| 必跑 | SPEC §56 全部用例 |
| 通过 | `VERIFIED ⇒ FOUND/PARTIAL` 硬约束有**负例测试**；`NOT_FOUND ⇒ REJECTED`；provenance 三字段齐全 |
| 停止条件 | 语义校验无法给出可判定的通过标准 |

## 阶段 5 — dataset / statistics / runner

| 项 | 内容 |
|---|---|
| 交付 | `plugin-dataset`、`plugin-statistics`、`medical-runner-container` |
| 必跑 | SPEC §57 全部 fixture；隔离验证：无网络、只读数据集、白名单外依赖被拒、超时/超内存被限 |
| 通过 | 故障注入下 100% 显示真实失败状态且不产生结果表；未审批不得执行；provenance 完整（FR-18） |
| 停止条件 | 目标平台无法提供容器或 bwrap 隔离 |

## 阶段 6 — artifact

| 项 | 内容 |
|---|---|
| 交付 | `plugin-artifact` |
| 必跑 | 导出 PNG/SVG 可读；`artifact ↔ analysis_run_id` 关联测试 |
| 通过 | Gate 5 覆盖率 100%：每个数字与图都能追到成功的 AnalysisRun |
| 停止条件 | — |

## 阶段 7 — medical-ui

| 项 | 内容 |
|---|---|
| 交付 | `plugin-medical-ui`（客户端插件） |
| 必跑 | 组件测试；浏览器实际可见验证 |
| 通过 | 4 个视图可切换；点引用能定位原文；切换视图时输入框仍可用；无活跃会话不渲染且不报错（FR-25）；文案全部走 zh/en 字典 |
| 停止条件 | 需要 DSH 未提供的 slot / 路由能力 → 停下来给提案，不改 DSH |

## 阶段 8 — bundle / profile / E2E

| 项 | 内容 |
|---|---|
| 交付 | `bundle-medical`、profile `med-research`、Compatibility Test、E2E |
| 必跑 | keyless 录制回放 E2E（SPEC §58、§59）；`dsh plugin --profile med-research add <本地路径>` 加载验证 |
| 通过 | PRD §36 两条 DoD 端到端可演示；PRD §35 的 Gate 1–5 逐条给出证据 |
| 停止条件 | — |

---

## 整体收尾

- [ ] Research DoD：中文问题 → 真实 PMID → Evidence → 可重定位原文 → Verified Claim → 点击引用定位
- [ ] Statistics DoD：上传 CSV → Profile → Plan → 确认 → 隔离执行 → 真实结果 → 图表 → 完整 provenance
- [ ] `README.md` 写明适配的 DSH version / commit 与安装步骤
- [ ] `docs/decisions/` 覆盖全部非平凡决策
