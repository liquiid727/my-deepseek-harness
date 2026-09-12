# R001 共享接口与状态约定

本文件是 [PRD](prd.md) 与 S01–S08 的规范性接口补充，随 PRD 2.1.0 批准；描述目标行为，不表示当前实现已经具备这些能力。

## 所有权与交付依赖

| Owner | 唯一拥有的数据/接口 | Consumers |
|---|---|---|
| S01 | Project、Workspace/Session binding、Mode、审计、备份协调；共享客户端动作注册 | S02–S08 |
| S02 | QueryPlan、SearchRun、Paper 元数据及 Project membership；search/get/save/unsave/related | S03、S04、S06 |
| S03 | Document/Paragraph、Note（Project/Paper/Selection）、Annotation、Reader derivatives；resolve/focus、Reader action registry | S04、S06、S07 |
| S04 | Evidence、Claim、Verification、CitationMap；save/verify/gate/serialize/compare/chase | S06、S08；通过 S03 registry 注册证据操作 |
| S05 | Dataset/Profile、AnalysisPlan/Approval/Run/Result/Artifact；import/profile/execute/export/listRuns | S01 概览通过贡献接口聚合，S07 |
| S06 | Tag、对象与 Tag 的关系、可重建索引、Draft/Revision；search/rag/drafts/saveRevision | S08；调用 S02/S03 管理 Papers/Notes |
| S07 | SkillDefinition/Version、TestRun、Publication、Installation；catalog/drafts/test/publish/install | 各业务 Skill 的定义装载与权限执行 |
| S08 | 写作生成/翻译、Draft 事实验证、确定性引用导出；generate/translate/validate/export | S06 通过编辑动作注册接口进入写作 |

实现依赖为 S01 → S02 → S03 → S04 → S06 → S08；S05 依赖 S01；S07 依赖 S01、S02、S03、S04、S05、S08。S07 自身可先实现目录与生命周期，但 13 个 Skill 的集成验收必须等待业务接口。S02–S08 不依赖 S07 才能完成业务操作；它们通过 Service/Tool 提供能力，S07 装载调用这些能力的定义。

S03 的 Reader action registry 提供 selection/focus 输入与可释放 action contribution；S04 注册 Evidence/Reference Chasing 动作，不要求 S03 import S04。S06 的 Draft editor action registry 由 S08 注册写作/翻译/导出。贡献缺失须显示依赖缺失诊断；完整 V1 profile 缺少 required 贡献在装载时失败，不能用禁用按钮完成 V1 验收。S01 的 overview、backup 和导航使用相同贡献方向，不能反向依赖业务包。

## 公共请求、版本与身份

所有写操作接受 ProjectId、当前 SessionId（会话动作）、requestId、expectedVersion 与业务输入；返回实体 ID/version、operationId、auditId 和成功数据或稳定错误。ID 使用各拥有包导出的 branded 类型；时间使用 UTC ISO 时间。无 Session 的项目创建接受 Workspace 输入，成功后建立绑定。

相同 Project/requestId/输入的重试返回原操作；同 requestId 不同输入返回 REQUEST_CONFLICT。并发写以 expectedVersion 比较，落后版本返回 VERSION_CONFLICT 且不覆盖。分页使用 opaque cursor、稳定排序、nextCursor 和 total/totalStatus，不能把未知总量显示为零。所有公开字段、错误及语义需要 Service Definition 和对应 Remote/Tool 一致声明；本文给出的操作名是目标逻辑接口，现有等义名称可保留，但消费者必须完整更新。

读写先验证当前 Project 与对象 membership；未授权访问返回 SCOPE_DENIED，不回显其他 Project 名称或内容。Project 切换时取消旧页面请求；无法取消的完成通知保留原 Project/operationId，不写入新页面选择。切换本身不撤销已获批的后台统计任务。

每个模型输入记录不可变内容或可解析、随 Session 导出保存的版本化附件引用，以及内容 hash、来源、Prompt/模型版本；仅存 ID 或 hash 而无法恢复原输入不符合 Session replay。敏感 Dataset 行永不成为模型输入或 Session 附件；UI preview 通过鉴权数据接口返回。

## Reader、Note 与 Evidence

SourceAnchor = ProjectId、PaperId、DocumentId、documentVersion、ParagraphId、start、end；offset 是规范化段落文本的 Unicode code point 索引，半开区间 [start,end)。规范化顺序为 Unicode NFC、CRLF→LF、连续空白折叠为单空格、去除首尾空白；保留规范化区间到原始字节/文本选区的映射。PDF page 从 1 起，section/page 为辅助定位，不替代 Paragraph/offset。

跨段落选区保存有序 anchors，不拼造单段 offset；显示合并文本时保留段落分隔。源文本和解析版本不可变；重新解析产生新 Document version，旧 anchor 仍指向旧版本。确实丢失或损坏时返回 STALE_ANCHOR 并使引用不合格，不近似跳到另一段。

S03 保存全部 Notes：Project Note 可无 anchor，Paper Note 有 PaperId，Selection Note 必须有 anchors；S06 调用该服务进行 CRUD，拥有 Tag 关系。Note 文本不是合格医学证据；RAG 可用 Note 找回来源，最终事实必须经 S04 验证。Note/Highlight 删除软删除记录并保留历史引用；撤销恢复同一 ID，重复撤销幂等。Evidence 撤销由 S04 写入 withdrawn 状态并使 Claim/Draft 失效。

Evidence 的 locatorStatus 是 FOUND/PARTIAL/NOT_FOUND；supportStatus 是 PENDING/VERIFIED/REJECTED；relation 是 SUPPORT/AGAINST/UNCERTAIN；sourceType 是 ABSTRACT/FULLTEXT/SECONDARY。PARTIAL 必须给出可精确高亮的 matched anchors 与未匹配区间，只能用 matched text 做语义验证。合格 Evidence 必须未撤销、source version 可读、locator 非 NOT_FOUND、support 为 VERIFIED、relation 为 SUPPORT 或 AGAINST、source 非 SECONDARY。验证 UNCERTAIN 时保持 PENDING，不得成为 Claim 支持。

Claim 引用相对于同一命题解释 SUPPORT/AGAINST。肯定命题至少一个 SUPPORT；反向命题须单独验证，不能直接把 AGAINST 当成肯定支持。证据冲突时输出包含双方限制的陈述，不能消除反证。总体状态：有合格 SUPPORT 且有合格 AGAINST 为 CONFLICTING；仅一侧有合格证据为 CONSISTENT（标明支持或反对）；两侧均无为 INSUFFICIENT。计数按 Evidence ID 去重，并分别标明待验证与二手记录。

CitationMap 在同一输出 revision 内按 Evidence 首次出现编号，相同 Evidence 复用编号；新的正文 revision 可重排，历史输出不变。复制单篇 Paper 的书目引用不等于生成医学 Claim。删除 membership、撤销 Evidence 或源版本不可读必须传播失效至 Claim、RAG answer 与 Draft；保存历史版本但拒绝作为新的完成结果。

## 长任务与失败

ResearchRun：IDLE → PLANNING → PLAN_READY → SEARCHING → PAPERS_READY → RETRIEVING_EVIDENCE → LOCATING → VERIFYING → ANSWER_READY。PLAN_READY 只有确认当前 plan revision 才能搜索；后四阶段由 S04 执行并回报 operationId。可进入 CANCELLED、FAILED 或 ERROR_PARTIAL；partial 返回成功项、失败项与可重试阶段，不能假装完整答案。

AnalysisRun：NO_DATASET → PROFILING → READY → PLANNING → PLAN_READY → GENERATING_CODE → WAITING_APPROVAL → EXECUTING → SUCCEEDED/FAILED/CANCELLED。审批绑定 Dataset hash、Profile/Plan version、Code hash、Runner policy version；任何变化使审批失效。只允许同一有效审批创建一次执行，重试失败运行必须创建新 run 并重新审批。

取消是请求，不伪造已终止；Runner 确认退出和清理后置 CANCELLED。重启将无法确认仍在运行的任务置 FAILED（INTERRUPTED），保留代码与脱敏日志，不补造结果。产出在完整 schema/hash/provenance 验证后一次发布；失败/取消的临时文件不可通过 Artifact API 读取。

Skill 状态分开保存：定义 DRAFT/VALIDATED，测试 QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED，发布版本 PUBLISHED_LOCAL/REVOKED，安装 DISABLED/ACTIVE。测试成功不自动发布或激活。编辑产生新 draft revision，安装始终固定不可变 published version。撤销阻止新调用，取消在途测试/调用并等待清理；无法撤回已发生的副作用，必须记录其审计并保留结果历史。

Draft revision 保存正文、事实片段范围、Claim/Evidence versions 和 citation map。编辑涉及事实片段时重新验证，未验证为 DRAFT；全部事实通过且无缺失引用才为 REVIEWABLE。EXPORTED 表示该 revision 的成功导出记录；后续编辑生成新 revision。用户解除引用后该事实是 ungrounded，不能保留 REVIEWABLE。

## 安全、备份和配置

Agent Mode 与角色不同。Research 允许规划/检索、Reader/Knowledge、Evidence/Writing；Paper 允许 Reader/Knowledge、Evidence/Writing 与显式确认的 Related/Reference 查询；Statistics 允许 Dataset/Statistics 与当前 Project 元数据。所有模式允许目录查看和草稿编辑；Skill 的实际工具权限取定义声明、安装批准、Mode allowlist、部署策略四者交集。统计执行、外部检索和 Skill 扩权仍走各自审批，不因 Mode 或 Skill 激活绕过。

备份参与域为 Project、Paper/membership、Document/Notes/Annotations、Evidence/Claims、Dataset/Profile、Analysis/Artifacts、Knowledge/Tags/Drafts、Skill 定义/安装及可重建 Session 引用。清单含域版本、文件 hash、引用与原 Project identity；索引可重建。备份为用户显式导出的敏感本地文件，可含 Dataset 原文件，但预览/日志/截图不含真实行。导入先在隔离 staging 校验全部版本、hash、路径与引用，再原子恢复；已有同 ID Project 拒绝覆盖，用户先移出冲突对象。失败恢复原存储，密钥从不导出。

大小、超时、并发、Runner 资源、解析上限、检索缓存与 reference hop 上限由所属 Provider 的已验证 Config 声明并持久化有效值。缺配置 referent 最早失败；安全不变量不可通过配置关闭。受保护动作审计记录 actor、Project、Session、requestId、mode、有效工具集合、审批与决定；错误不泄露凭据、患者行或本地绝对路径。
