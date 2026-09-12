# R001 内置 Skill 交付目录

本目录随 [PRD](prd.md) 2.1.0 批准，13 项均为 V1 必交。S07 拥有定义、版本、来源和生命周期；业务输出遵守下表主责 Spec。内置定义只调用声明工具，不携带可执行包或原始凭据。所有模型派生结果保存输入来源与模型/Prompt 版本，医学质量采用 [评估协议](evaluation.md)。

| ID / Skill | 输入与触发 | 必交输出与失败行为 | 允许工具类别 / 业务 Owner |
|---|---|---|---|
| SKILL-01 PubMed Deep Search | 当前 Project、研究问题；用户调用 | 可编辑 PICO/PECO、关键词/MeSH、主/宽 query；确认后真实 Paper 列表与 rank reason；不足/partial 不造来源 | literature plan/search/get/related；S02 |
| SKILL-02 Medical Translator | 原文 anchors、目标 zh/en；选区翻译或显式文档翻译 | 原文/译文逐段对齐，术语保持上下文，数字/单位/引用保持；缺 source 或对齐失败逐段报错 | paper read/search；S03 |
| SKILL-03 Paper Summarizer | Paper/Document version、全文或章节范围、summary mode | 一句话、三分钟或完整结构摘要，未知字段明确未报告；每项事实附 anchors，局限性与项目相关性可追溯 | paper read/search；S03 |
| SKILL-04 Evidence Extractor | Claim/question、Paper IDs | 候选 quote/anchors/sourceType/provenance；调用 locator/verifier 后输出三类关系；未验证候选不成为已支持结论 | paper read/search、evidence retrieve/save/verify；S04 |
| SKILL-05 PONV Evidence Reviewer | PONV 研究命题与选中 Papers/Evidence | PICO、研究设计、风险因素/结局、效应值与 CI、支持/反对/不足、质量限制及引用；缺字段不推算 | paper read/search、evidence retrieve/verify/gate；S04 |
| SKILL-06 Critical Appraisal | 当前 Paper/Document 与研究设计 | 方法学质量、随机/混杂/选择/测量/缺失/报告偏倚逐域判断（low/high/unclear/not-applicable）、原文理由、适用性和证据限制；不把未报告标成低风险 | paper read/search、evidence retrieve/verify；S03，S04 验证输出证据 |
| SKILL-07 Logistic Regression | Dataset/Profile、二分类 Outcome、Exposure/Covariates | 事件编码、参考水平、缺失处理、模型公式与假设、代码；批准后系数/OR/CI/P、样本数、收敛诊断与 Forest/ROC；非二分类或完全分离时警告/失败，不报虚假估计 | dataset schema、statistics plan/generate/execute/result；S05 |
| SKILL-08 Survival Analysis | Dataset/Profile、time/event、groups/covariates | time 单位与 event 编码、KM/log-rank；选择协变量时 Cox HR/CI/P 与假设诊断；负 time/错误 event 拒绝，全部删失不输出可估计效应 | dataset schema、statistics plan/generate/execute/result；S05 |
| SKILL-09 Meta Analysis | 用户整理 Dataset/Profile，study ID、效应尺度、estimate 与 SE 或 CI | 固定效应与随机效应 inverse-variance 汇总、异质性 Q/I²/tau²、Forest Plot、纳入/排除理由；尺度不一致或不能取得方差时请求修正；少于两研究拒绝合并 | dataset schema、statistics plan/generate/execute/result；S05 |
| SKILL-10 Literature Review Writer | 选中 verified Claims/Evidence、目标章节/语言 | 有引文的综述结构与正文、冲突和局限；无合格证据显示不足片段；编辑后重新验证 | knowledge drafts、evidence gate/serialize、writing generate/validate；S08 |
| SKILL-11 Academic Translator | Draft revision 或用户文本、zh/en 方向 | 标题/段落/表格结构、数字统计符号、引用 identity 保持的译文；对齐错误保留旧版并标错 | writing translate、knowledge drafts；S08 |
| SKILL-12 Thoracic Paper Extractor | 胸外科 Paper/Document | study design、手术/病种、纳排、人群、样本量、干预/比较、围术期结局与随访、效应及局限的字段表；每值有 anchor，未报告显式缺失 | paper read/search、evidence retrieve/verify；S03，S04 验证输出证据 |
| SKILL-13 Clinical Guideline Reader | 用户授权的指南 Document、研究问题 | 发布机构/日期/版本、适用人群、推荐原文、原指南强度/证据等级、限制与更新声明；无原等级写未报告，不自创分级或个体建议 | paper read/search、evidence retrieve/verify；S03，S04 验证输出证据 |

所有统计 Skill 只读取 schema/profile/aggregates，不能通过 prompt、tool stdout 或测试 preview 获得 Dataset 行；execute 仍需用户批准当前 plan/code。Meta Analysis 的估计输入来自用户 Dataset；Paper 抽取值不得未经用户确认就成为统计输入。

字段抽取以 source anchor 为事实依据，Critical Appraisal 的偏倚判断是明确标注的模型派生评价，需要保存规则版本及引用原文；不能把评价冒充论文原文。摘要 Supporting/Counter Evidence 由 S04 action contribution 验证后展示，未安装该 required 贡献的 profile 不符合 V1。

目录每项有唯一 definition ID、语义版本、publisher=内置目录、输入/输出 JSON Schema、例子、触发器、知识文件清单、model preference 与工具清单。模型偏好必须解析到部署可用模型；缺失时在校验阶段报错，不悄悄替换。知识文件限制为当前 Workspace 授权资料并保存版本引用。用户明确调用是所有 Skill 的默认触发；上传/关键词自动触发仅在安装页显式启用且权限已批准时生效，同一上传/消息与 Skill version 去重一次。

完整验收逐个执行正例、缺失输入、来源不足和越权拒绝；允许共享公开 Paper/合成 Dataset，但记录每个 Skill 的输出与断言。目录中出现名称、安装成功或静态 preview 都不能替代业务语义验收。
