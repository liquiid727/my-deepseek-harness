# Med Research Workspace — 能力矩阵与功能矩阵

**版本**：V1.0
**定位**：基于 DeepSeek Harness（DSH）二次开发的医学科研 AI 工作台
**目标**：用于产品范围管理、研发拆解、Agent 实现与验收。

---

# 1. 文档说明

本文用于把产品能力收敛成两张核心矩阵：

- **能力矩阵**：产品“具备什么能力”，偏产品与架构视角。
- **功能矩阵**：页面与模块“具体有哪些功能”，偏研发与验收视角。

建议和项目中的 PRD / SPEC 配套使用：

```text
PRD
→ Why / What

SPEC
→ How

Capability Matrix
→ 能力边界

Feature Matrix
→ 功能范围与开发优先级
```

---

# 2. 产品能力总览

整体能力归纳为：

1. Research
2. Evidence
3. Paper Reader
4. Knowledge
5. Statistics
6. Skills
7. DSH Platform

---

# 3. 产品能力矩阵

| 能力域 | 核心能力 | 用户价值 | 核心输入 | 核心输出 | DSH 中的实现形态 | 优先级 |
|---|---|---|---|---|---|---|
| Research | 医学文献检索 | 快速找到真实论文 | 自然语言问题 | Paper List | Skill + Tool + Plugin | P0 |
| Research | Query Planning | 中文问题转 PubMed 检索式 | Research Question | MeSH / Keywords / Query | Agent + Skill | P0 |
| Research | 文献筛选 / Rerank | 从大量论文筛出相关文献 | Papers | Ranked Papers | Tool + Model | P0 |
| Evidence | Evidence Retrieval | 从论文找到真正相关原文 | Claim / Question + Paper | Evidence Span | Tool + RAG | P0 |
| Evidence | Claim Grounding | 结论绑定原文证据 | Evidence[] | Claim + Citation | Agent + Verifier | P0 |
| Evidence | Counter Evidence | 同时发现反对证据 | Claim | Support / Against / Uncertain | Agent + Tool | P0/P1 |
| Evidence | Citation Verification | 防止“真论文假引用” | Claim + Evidence | VERIFIED / REJECTED | Guard + Tool | P0 |
| Reader | 论文阅读 | 阅读 Abstract / PDF / XML | Paper | Structured Reader | Plugin + UI | P0 |
| Reader | 滑词翻译 | 医学英文即时翻译 | Selected Text | Translation | Skill | P0 |
| Reader | 医学术语解释 | 理解专业术语 | Selected Text | Explanation | Skill | P0 |
| Reader | AI 论文总结 | 快速理解论文 | Paper | Structured Summary | Skill | P0 |
| Reader | 论文问答 | 针对当前论文追问 | Question + Paper | Grounded Answer | Agent + RAG | P0 |
| Reader | 笔记 | 沉淀研究过程 | Selection / Manual | Note | Service + UI | P0 |
| Reader | 保存为 Evidence | 人工选择原文形成证据 | Text Selection | Evidence | Tool | P0 |
| Knowledge | Project Workspace | 组织长期科研项目 | Papers / Data / Notes | Project Context | Plugin + Service | P0 |
| Knowledge | Paper Library | 管理论文 | Papers | Library | Service + UI | P0 |
| Knowledge | Evidence Table | 结构化管理证据 | Evidence[] | Evidence Matrix | Service + UI | P0 |
| Knowledge | Project RAG | 对已收藏论文跨文献问答 | Project Papers | Evidence Retrieval | pgvector / FTS | P1 |
| Knowledge | Research Notes | 研究笔记、方法学笔记 | Notes | Knowledge | Service | P0 |
| Statistics | Dataset Profiling | 理解科研数据 | CSV / XLSX | Schema / Profile | Tool | P0 |
| Statistics | Analysis Planning | AI 规划统计方法 | Question + Dataset | Analysis Plan | Skill | P0 |
| Statistics | Code Generation | 自动生成统计代码 | Analysis Plan | Python Code | Agent | P0 |
| Statistics | Code Execution | 获得真实统计结果 | Code + Dataset | Result | Sandbox | P0 |
| Statistics | Statistical Interpretation | 解释 OR / CI / P 等 | Runner Result | Interpretation | Skill | P0 |
| Statistics | Visualization | 自动生成统计图 | Result / Data | PNG / SVG | Tool | P0 |
| Statistics | Reproducibility | 统计全过程可复现 | Run | Provenance | Service | P0 |
| Skills | Skill Marketplace | 安装科研能力 | Skill Package | Installed Skill | DSH Bundle / Skill | P1 |
| Skills | Skill Management | 启停 / 升级 / 卸载 Skill | Skill | Skill State | Plugin | P1 |
| Skills | Skill Builder | 用户创建自己的 Skill | Instructions | Custom Skill | DSH Skill | P1 |
| Skills | Skill Test | 上传论文测试 Skill | Input + Skill | Preview Result | Sandbox / Agent | P1 |
| Writing | Literature Review | 基于已验证证据辅助写作 | Evidence | Draft | Skill | P1 |
| Writing | Academic Translation | 学术中英互译 | Draft / Text | Translation | Skill | P1 |
| Writing | Citation Export | 导出引用 | Papers | RIS / BibTeX | Tool | P1 |
| Platform | Agent Runtime | 统一任务编排 | User Intent | Tool Workflow | DSH | P0 |
| Platform | Tool System | 接 PubMed、Runner 等 | Tool Call | Deterministic Result | DSH Tools | P0 |
| Platform | Permission / Approval | 敏感操作确认 | Tool Action | Approve / Deny | DSH Approval | P0 |
| Platform | Sandbox | 隔离代码执行 | Python Code | Result / Artifact | DSH / 独立 Runner | P0 |
| Platform | Session Context | 当前项目 / 论文 / 数据上下文 | Workspace | Agent Context | DSH Session | P0 |
| Platform | Plugin Architecture | 后续扩展能力 | Plugin | Capability | DSH Cordis | P0 |

---

# 4. 核心能力关系

## 4.1 文献研究链

```text
                         Research
                            │
                  PubMed / PMC Search
                            │
                            ▼
                         Papers
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
         Paper Reader                  Project Library
              │                            │
       翻译 / 总结 / 问答                  │
       滑词 / 笔记                         │
              │                            │
              └─────────────┬──────────────┘
                            ▼
                       Evidence Engine
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          SUPPORT         AGAINST        UNCERTAIN
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                         Claims
                            │
                            ▼
                    Citation Verifier
                            │
                            ▼
                    Research Conclusion
```

## 4.2 数据统计链

```text
Dataset
   ↓
Statistics Question
   ↓
Analysis Plan
   ↓
Code
   ↓
Sandbox
   ↓
Result
   ↓
Chart
   ↓
Interpretation
```

## 4.3 Skill 横向增强

```text
               Skill System

Research   Reader   Evidence   Statistics   Writing
   ▲         ▲         ▲           ▲          ▲
   └─────────┴─────────┴───────────┴──────────┘
                       │
                  Installed Skills
```

---

# 5. Workspace / Project 功能矩阵

左侧 Workspace 的核心语义：

> 左侧不是“功能菜单”，而是“我有哪些研究项目”。

| 功能 | 描述 | P0 | P1 | 验收重点 |
|---|---|:---:|:---:|---|
| 新建研究项目 | 创建科研 Workspace | ✅ | | 可创建并进入 Project |
| 项目基础信息 | 问题、背景、PICO / PECO | ✅ | | 可编辑保存 |
| 项目概览 | Papers / Evidence / Data / Analysis 数量 | ✅ | | 数据实时准确 |
| 项目切换 | 左侧 Workspace 切换 | ✅ | | Agent Context 同步切换 |
| Project Sessions | 项目内历史会话 | ✅ | | 会话属于 Project |
| Papers | 项目论文库 | ✅ | | 可增删 / 筛选 |
| Evidence | 项目证据库 | ✅ | | Claim 可关联 Evidence |
| Notes | 项目笔记 | ✅ | | Paper / Selection 可引用 |
| Datasets | 项目数据集 | ✅ | | Dataset 可追溯 |
| Statistics Runs | 分析历史 | ✅ | | Result 可重新查看 |
| Drafts | 草稿 | | ✅ | 可引用 Verified Evidence |
| Team Collaboration | 团队共享 | | 后期 | 暂不做 |

---

# 6. Research / PubMed 功能矩阵

| 功能 | 输入 | 系统动作 | 输出 | 优先级 |
|---|---|---|---|---|
| 自然语言检索 | 中文研究问题 | Query Planner | Query Plan | P0 |
| PICO / PECO 提取 | 问题 | LLM Structured Output | PICO / PECO | P0 |
| Keyword Expansion | Concept | 同义词扩展 | Keywords | P0 |
| MeSH 推荐 | Concept | MeSH Mapping | MeSH Terms | P0 |
| PubMed Query | Plan | 生成检索式 | Boolean Query | P0 |
| Query 编辑 | Query | 用户修改 | Final Query | P0 |
| PubMed Search | Query | ESearch | PMID[] | P0 |
| Metadata Fetch | PMID[] | EFetch / ESummary | Papers | P0 |
| 去重 | Papers | PMID / DOI / Title | Unique Papers | P0 |
| AI Rerank | Top 100 | Relevance Ranking | Top 20 | P0 |
| 年份筛选 | Filter | Search Filter | Papers | P0 |
| Study Type | Filter | Publication Type | Papers | P0 |
| Full Text Filter | Filter | Resolver State | Papers | P1 |
| Counter Search | Claim | 反向检索 | Contrary Papers | P1 |
| Related Papers | Paper | 引用 / 语义关系 | Related Papers | P1 |

---

# 7. Paper Reader 功能矩阵

| 功能 | 描述 | P0 | P1 |
|---|---|:---:|:---:|
| Abstract 阅读 | PubMed Abstract | ✅ | |
| PDF 阅读 | 用户上传 PDF | ✅ | |
| PMC XML 阅读 | 结构化全文 | | ✅ |
| 论文目录 | Abstract / Methods / Results... | ✅ | |
| 原文模式 | 英文原文 | ✅ | |
| 翻译模式 | 中文翻译 | ✅ | |
| 双语对照 | 原文 + 中文 | ✅ | |
| 滑词翻译 | 选中文本即时翻译 | ✅ | |
| 医学术语解释 | 解释专业医学词汇 | ✅ | |
| 简单解释 | 简单语言解释句子 | ✅ | |
| 问 AI | 对选中段落提问 | ✅ | |
| 高亮 | 标记文本 | ✅ | |
| 记笔记 | Selection → Note | ✅ | |
| 保存 Evidence | Selection → Evidence | ✅ | |
| 复制引用 | Paper Citation | ✅ | |
| 全文总结 | Structured Summary | ✅ | |
| 章节总结 | 按章节总结 | ✅ | |
| Reference Explorer | 查引用论文 | | ✅ |
| Related Papers | 推荐相关论文 | | ✅ |

---

# 8. Paper Reader 滑词能力矩阵

建议滑词浮层作为标准交互：

```text
┌──────────────────────────────────────┐
│ 翻译 │ 术语解释 │ 问 AI │ 记笔记 │ 证据 │
└──────────────────────────────────────┘
```

| 动作 | 输出 |
|---|---|
| 翻译 | 医学专业中文翻译 |
| 术语解释 | 医学定义 + 上下文解释 |
| 问 AI | 针对选区继续追问 |
| 简单解释 | 用更容易理解的语言说明 |
| 记笔记 | Note + 原文引用 |
| 高亮 | Annotation |
| 保存 Evidence | Evidence Object |
| 复制 | Original Text |
| 引用 | Paper Citation |

核心原则：

> 翻译不替换原文，原文永远是 Source of Truth。

---

# 9. 论文 AI 阅读矩阵

| 阅读视角 | 输出内容 |
|---|---|
| 一句话总结 | 论文核心贡献 |
| 3 分钟阅读 | 结构化快速摘要 |
| Research Question | 研究问题 |
| Study Design | RCT / Cohort / Meta 等 |
| Population | 研究人群 |
| Sample Size | 样本量 |
| Intervention / Exposure | 干预 / 暴露 |
| Comparator | 对照 |
| Outcome | 结局 |
| Methods | 方法 |
| Statistics | 统计方法 |
| Key Results | 核心结果 |
| Effect Size | OR / RR / HR / CI 等 |
| Conclusion | 作者结论 |
| Limitations | 局限性 |
| Bias | 潜在偏倚 |
| My Project Relevance | 和当前项目关系 |
| Supporting Evidence | 支持当前研究 |
| Counter Evidence | 与当前假设相反 |
| Worth Following | 值得继续追踪的 Reference |

---

# 10. Evidence Engine 功能矩阵

| 功能 | 作用 | 优先级 |
|---|---|---|
| Evidence Retrieval | 从论文找到证据 | P0 |
| Original Text 保存 | 保存真实原文 | P0 |
| Paragraph Locator | 定位到段落 | P0 |
| Page Locator | PDF 页码 | P0 |
| Section Locator | Results / Discussion | P0 |
| SUPPORT | 支持 Claim | P0 |
| AGAINST | 反对 Claim | P0 |
| UNCERTAIN | 证据不确定 | P0 |
| Fulltext Evidence | 全文直接证据 | P0 |
| Abstract Evidence | 摘要直接证据 | P0 |
| Secondary Citation | 二手引用 | P0 |
| Evidence Verify | 验证原文存在 | P0 |
| Semantic Verify | Evidence 是否真的支持 Claim | P0 |
| Claim → Evidence | 建立关联 | P0 |
| Evidence → Paper | 回到论文 | P0 |
| Citation Serializer | 后端生成 `[1]` | P0 |
| Counter Evidence | 主动寻找反证 | P1 |
| Reference Chasing | 二手引用追原文 | P1 |
| Evidence Table | 跨论文证据表 | P0 |
| Evidence Compare | 比较证据冲突 | P1 |

核心可信链：

```text
Claim
↓
Evidence ID
↓
Original Text
↓
Paragraph
↓
Paper
↓
PMID / DOI
```

---

# 11. Knowledge / Library 功能矩阵

| 模块 | 功能 |
|---|---|
| Paper Library | 收藏 / 删除 / 标签 / 搜索 |
| Project Papers | 当前项目论文 |
| My Papers | 用户全部论文 |
| Uploaded Papers | 用户上传 PDF |
| Evidence Library | 全部 Evidence |
| Evidence Group | 按 Claim 分组 |
| Notes | 项目研究笔记 |
| Paper Notes | 单篇论文笔记 |
| Selection Notes | 滑词笔记 |
| Tags | 标签管理 |
| Search | 标题 / 作者 / PMID / Note |
| Project RAG | 对当前项目资料问答 |
| Export | RIS / BibTeX / Markdown |

---

# 12. Statistics Lab 功能矩阵

| 阶段 | 功能 | P0 |
|---|---|:---:|
| 数据 | CSV 上传 | ✅ |
| 数据 | XLSX 上传 | ✅ |
| 数据 | Dataset Preview | ✅ |
| 数据 | 类型推断 | ✅ |
| 数据 | Missing 分析 | ✅ |
| 数据 | 用户修正变量类型 | ✅ |
| Planning | 自然语言统计问题 | ✅ |
| Planning | Outcome 识别 | ✅ |
| Planning | Exposure 识别 | ✅ |
| Planning | Covariates 识别 | ✅ |
| Planning | 统计方法推荐 | ✅ |
| Planning | Analysis Plan | ✅ |
| Execution | Python Code | ✅ |
| Execution | Code Preview | ✅ |
| Execution | 用户确认 | ✅ |
| Execution | Sandbox Run | ✅ |
| Result | stdout / stderr | ✅ |
| Result | OR / RR / CI / P | ✅ |
| Result | AI 解释 | ✅ |
| Chart | Histogram | ✅ |
| Chart | Box Plot | ✅ |
| Chart | Scatter | ✅ |
| Chart | Forest Plot | ✅ |
| Chart | ROC | ✅ |
| Chart | Kaplan-Meier | P1 |
| Chart | Correlation | ✅ |
| Export | PNG | ✅ |
| Export | SVG | ✅ |
| Provenance | Dataset Hash | ✅ |
| Provenance | Code Hash | ✅ |
| Provenance | Runtime | ✅ |
| Provenance | Package Version | ✅ |
| Provenance | Execution Log | ✅ |

---

# 13. Skills 能力矩阵

| Skill 类别 | 示例 |
|---|---|
| Search | PubMed Deep Search |
| Translation | Medical Translator |
| Reading | Paper Summarizer |
| Evidence | Evidence Extractor |
| Evidence | PONV Evidence Reviewer |
| Quality | Critical Appraisal |
| Statistics | Logistic Regression |
| Statistics | Survival Analysis |
| Statistics | Meta Analysis |
| Writing | Literature Review Writer |
| Writing | Academic Translator |
| Specialty | Thoracic Paper Extractor |
| Guideline | Clinical Guideline Reader |

---

# 14. Skill Center 功能矩阵

| 功能 | 描述 | 优先级 |
|---|---|---|
| Skill 广场 | 浏览 Skill | P1 |
| 分类 | 文献 / 统计 / 翻译 / 写作 | P1 |
| Search | 搜索 Skill | P1 |
| Skill Detail | 查看介绍 | P1 |
| Install | 安装 | P1 |
| Uninstall | 卸载 | P1 |
| Enable / Disable | 启停 | P1 |
| Update | 更新版本 | P1 |
| Installed | 已安装列表 | P1 |
| My Skills | 自建 Skill | P1 |
| Create Skill | 创建 | P1 |
| Edit Skill | 编辑 | P1 |
| Test Skill | 测试运行 | P1 |
| Publish | 发布 | P1 |
| Install to Workspace | 安装到项目 | P1 |

---

# 15. Skill Builder 功能矩阵

| 配置项 | 用途 |
|---|---|
| Name | Skill 名称 |
| Description | 简介 |
| Version | 版本 |
| System Instructions | 核心 Prompt |
| Trigger | 触发条件 |
| Allowed Tools | 可用 Tool |
| Input Schema | 输入 |
| Output Schema | 输出 |
| Knowledge | 专属知识 |
| Examples | Few-shot 示例 |
| Model | 模型 |
| Test Input | 调试 |
| Preview | 结果预览 |
| Publish | 发布 |
| Install | 安装 |

Tool Permission 示例：

```text
☑ PubMed
☑ Paper Reader
☑ Evidence
☐ Statistics
☐ Files
```

Skill Builder 的本质：

> DSH Skill 的产品化编辑器。

---

# 16. DSH 能力映射矩阵

| 产品能力 | DSH 对应层 |
|---|---|
| Research Agent | Agent Runtime |
| Project Context | Session + Custom Service |
| PubMed | Tool |
| PMC | Tool |
| Fulltext Resolver | Plugin + Service |
| Evidence Engine | Plugin + Service + Tool |
| Translation | Skill |
| Paper Summary | Skill |
| Statistics Plan | Skill |
| Statistics Execute | Tool + Sandbox |
| Skill Marketplace | Custom Plugin |
| Skill Install | Bundle / Skill Loader |
| Skill Builder | Custom Plugin |
| File Upload | Workspace / File Service |
| Approval | Approval Policy |
| Statistics Permission | Tool Guard |
| Project-specific Skills | Profile / Workspace Config |
| Model Selection | Model Adapter |
| Observability | Telemetry |

推荐结构：

```text
DSH Core
   │
   ▼
Medical Profile
   │
   ▼
Medical Bundle
   │
   ├── Project Plugin
   ├── Literature Plugin
   ├── Reader Plugin
   ├── Evidence Plugin
   ├── Statistics Plugin
   ├── Skills Plugin
   └── Medical UI Plugin
           │
           ▼
        Skills
           │
           ▼
         Tools
```

---

# 17. 五个核心 Workspace

| Workspace | 用户在这里完成什么 |
|---|---|
| **Research** | 找论文、找证据、回答科研问题 |
| **Paper Reader** | 读论文、翻译、总结、笔记、保存证据 |
| **Knowledge** | 管论文、Evidence、Notes、Project Knowledge |
| **Statistics Lab** | 数据分析、代码执行、统计图 |
| **Skills Center** | 安装、创建、管理自己的科研技能 |

关系：

```text
                    Research
                       │
                       ▼
                  Paper Reader
                       │
                       ▼
                    Evidence
                       │
                       ▼
                   Knowledge
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
         Statistics            Writing

                ▲
                │
             Skills
        横向增强所有能力
```

---

# 18. V1 Scope 建议

第一阶段建议优先完成：

```text
Project
   +
PubMed Research
   +
Evidence Engine
   +
Paper Reader
      ├─ 翻译
      ├─ 总结
      ├─ 滑词
      └─ 笔记
   +
Statistics Lab
   +
Skill 基础框架
```

首批内置 Skill：

```text
Medical Translator
Paper Summarizer
Evidence Extractor
Critical Appraisal
PubMed Deep Search
Logistic Regression
```

第二阶段再开放：

```text
用户创建 Skill
→ 测试 Skill
→ 发布 Skill
→ 安装到当前 Workspace
→ Agent 自动获得新能力
```

---

# 19. 最终产品定义

Med Research Workspace 最终可以定义成：

> **基于 DSH 二次开发的医学科研 Research OS。**

它不是一个单一聊天机器人，而是一套围绕真实科研工作流构建的工作台：

```text
研究问题
→ PubMed 检索
→ 论文阅读
→ 翻译 / 总结 / 笔记
→ Evidence
→ 可验证结论

真实数据
→ 分析方案
→ 代码
→ 执行
→ 图表

Skills
→ 横向增强 Research / Reader / Evidence / Statistics / Writing
```

核心产品原则：

- 准确性第一
- Evidence First
- 原文可追溯
- 结论必须有依据
- 统计结果来自真实执行
- Skill 可安装、可创建、可组合
