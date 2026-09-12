# R001 逐项能力与验收归属

本表以 [能力矩阵](../../../.todo/0909/med-research-workspace-capability-feature-matrix-v1.0.md) 为输入，属于 [PRD](prd.md) 2.1.0 的规范性覆盖索引。所有列出的功能均为 V1 必交，原矩阵 P0/P1 只决定实施里程碑；无优先级的细化行也按所属能力纳入。Team Collaboration 的“后期”不纳入；矩阵第 18 节的阶段建议不缩减 V1。每行必须有单独断言结果，不能只运行同组代表项。

## REQ 与 AC 主责

| REQ | 主责 Spec | 参与责任 / AC |
|---|---|---|
| REQ-R001-001 | S01 | S05 数据/分析历史、S06 库；AC-R001-001 |
| REQ-R001-002 | S02 | AC-R001-002 |
| REQ-R001-003 | S02 | AC-R001-003 |
| REQ-R001-004 | S03 | AC-R001-004、AC-R001-005 |
| REQ-R001-005 | S04 | S03 source anchors；AC-R001-006 |
| REQ-R001-006 | S04 | S08 写作；AC-R001-007、AC-R001-012 |
| REQ-R001-007 | S05 | AC-R001-009 |
| REQ-R001-008 | S05 | AC-R001-010 |
| REQ-R001-009 | S01 | S02–S08 各自 UI；AC-R001-013、AC-R001-014 |
| REQ-R001-010 | S01 | S05 Runner、S07 安装权限；AC-R001-001、AC-R001-009、AC-R001-010、AC-R001-011、AC-R001-015 |
| REQ-R001-011 | S01 | S03 right pane；AC-R001-013、AC-R001-014 |
| REQ-R001-012 | S06 | S03 Note 存储、S08 Draft；AC-R001-008 |
| REQ-R001-013 | S02 | S04 Counter 验证；AC-R001-003、AC-R001-016 |
| REQ-R001-014 | S03 | S04 证据动作；AC-R001-004、AC-R001-005、AC-R001-016 |
| REQ-R001-015 | S04 | S03 参考入口、S06 分组；AC-R001-006、AC-R001-007、AC-R001-008 |
| REQ-R001-016 | S07 | 全部 13 Skill 的业务 owner；AC-R001-011、AC-R001-016 |
| REQ-R001-017 | S08 | S06 Draft；AC-R001-012 |
| REQ-R001-018 | S01 | 每个业务包完整 Provider/Consumer 与回放；AC-R001-015 |

AC-R001-013 的五张原型分别由 S01、S02/S04/S03、S03、S05、S07 交付，S01 汇总；AC-R001-014 每个包均必交；AC-R001-015 由 S01 汇总全部八包 accepted；AC-R001-016 由 S04 汇总医学评审，S02/S03/S07/S08 提交各自指标，不得用证据引擎通过代替其他 Skill 质量。

## 功能条目

| Matrix area | Feature | REQ | 主责行为 | Planned TEST | 可观察断言 |
|---|---|---|---|---|---|
| Workspace | 新建研究项目 | REQ-R001-001, REQ-R001-011 | SPEC-R001-S01-001 | TEST-R001-S01-006 | 创建/编辑后重载字段与绑定一致；切换不泄露旧项目状态 |
| Workspace | 项目基础信息 | REQ-R001-001, REQ-R001-011 | SPEC-R001-S01-001 | TEST-R001-S01-006 | 创建/编辑后重载字段与绑定一致；切换不泄露旧项目状态 |
| Workspace | 项目概览 | REQ-R001-001, REQ-R001-011 | SPEC-R001-S01-002 | TEST-R001-S01-007 | 创建/编辑后重载字段与绑定一致；切换不泄露旧项目状态 |
| Workspace | 项目切换 | REQ-R001-001, REQ-R001-011 | SPEC-R001-S01-001 | TEST-R001-S01-006 | 创建/编辑后重载字段与绑定一致；切换不泄露旧项目状态 |
| Workspace | Project Sessions | REQ-R001-001, REQ-R001-011 | SPEC-R001-S01-002 | TEST-R001-S01-007 | 创建/编辑后重载字段与绑定一致；切换不泄露旧项目状态 |
| Workspace | Papers | REQ-R001-001, REQ-R001-012 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 列表与所属服务记录一致，增删和跳转后计数同步 |
| Workspace | Evidence | REQ-R001-001, REQ-R001-012 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 列表与所属服务记录一致，增删和跳转后计数同步 |
| Workspace | Notes | REQ-R001-001, REQ-R001-012 | SPEC-R001-S06-002 | TEST-R001-S06-007 | 列表与所属服务记录一致，增删和跳转后计数同步 |
| Workspace | Datasets | REQ-R001-001, REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 列表与所属服务记录一致，增删和跳转后计数同步 |
| Workspace | Statistics Runs | REQ-R001-001, REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 列表与所属服务记录一致，增删和跳转后计数同步 |
| Workspace | Drafts | REQ-R001-012, REQ-R001-017 | SPEC-R001-S06-004 | TEST-R001-S06-009 | Draft 可保存重开，失效引用阻止完成状态 |
| Research | 自然语言检索 | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 | 输出该计划字段可编辑，确认前所有 Connector 调用为零 |
| Research | PICO/PECO 提取 | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 | 输出该计划字段可编辑，确认前所有 Connector 调用为零 |
| Research | Keyword Expansion | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 | 输出该计划字段可编辑，确认前所有 Connector 调用为零 |
| Research | MeSH 推荐 | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 | 输出该计划字段可编辑，确认前所有 Connector 调用为零 |
| Research | PubMed Query | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 | 输出该计划字段可编辑，确认前所有 Connector 调用为零 |
| Research | Query 编辑 | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 | 输出该计划字段可编辑，确认前所有 Connector 调用为零 |
| Research | PubMed Search | REQ-R001-003 | SPEC-R001-S02-002 | TEST-R001-S02-007 | 结果可追到响应，去重/分页身份稳定，失败项明确 |
| Research | Metadata Fetch | REQ-R001-003 | SPEC-R001-S02-002 | TEST-R001-S02-007 | 结果可追到响应，去重/分页身份稳定，失败项明确 |
| Research | 去重 | REQ-R001-003 | SPEC-R001-S02-002 | TEST-R001-S02-007 | 结果可追到响应，去重/分页身份稳定，失败项明确 |
| Research | 分页 | REQ-R001-003 | SPEC-R001-S02-002 | TEST-R001-S02-007 | 结果可追到响应，去重/分页身份稳定，失败项明确 |
| Research | AI Rerank | REQ-R001-003, REQ-R001-013 | SPEC-R001-S02-003 | TEST-R001-S02-008 | 按所选条件影响候选且保留 trace，Rerank 不引入新 Paper |
| Research | 年份筛选 | REQ-R001-003, REQ-R001-013 | SPEC-R001-S02-003 | TEST-R001-S02-008 | 按所选条件影响候选且保留 trace，Rerank 不引入新 Paper |
| Research | Study Type | REQ-R001-003, REQ-R001-013 | SPEC-R001-S02-003 | TEST-R001-S02-008 | 按所选条件影响候选且保留 trace，Rerank 不引入新 Paper |
| Research | Full Text Filter | REQ-R001-003, REQ-R001-013 | SPEC-R001-S02-003 | TEST-R001-S02-008 | 按所选条件影响候选且保留 trace，Rerank 不引入新 Paper |
| Research | Counter Search | REQ-R001-013 | SPEC-R001-S02-003 | TEST-R001-S02-008 | 独立确认 query/关系来源，结果不混入无来源主列表 |
| Research | Related Papers | REQ-R001-013 | SPEC-R001-S02-003 | TEST-R001-S02-008 | 独立确认 query/关系来源，结果不混入无来源主列表 |
| Reader | Abstract 阅读 | REQ-R001-004 | SPEC-R001-S03-001 | TEST-R001-S03-006 | 真实源/章节可读，缺源或解析失败不产生正文 |
| Reader | PDF 阅读 | REQ-R001-004 | SPEC-R001-S03-001 | TEST-R001-S03-006 | 真实源/章节可读，缺源或解析失败不产生正文 |
| Reader | PMC XML 阅读 | REQ-R001-004 | SPEC-R001-S03-001 | TEST-R001-S03-006 | 真实源/章节可读，缺源或解析失败不产生正文 |
| Reader | 论文目录 | REQ-R001-004 | SPEC-R001-S03-001 | TEST-R001-S03-006 | 真实源/章节可读，缺源或解析失败不产生正文 |
| Reader | 原文模式 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 所选模式或摘要范围得到对齐的派生内容，原文不变 |
| Reader | 翻译模式 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 所选模式或摘要范围得到对齐的派生内容，原文不变 |
| Reader | 双语对照 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 所选模式或摘要范围得到对齐的派生内容，原文不变 |
| Reader | 全文总结 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 所选模式或摘要范围得到对齐的派生内容，原文不变 |
| Reader | 章节总结 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 所选模式或摘要范围得到对齐的派生内容，原文不变 |
| Reader selection | 滑词翻译 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 医学术语解释 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 简单解释 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 问 AI | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 高亮 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 记笔记 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 保存 Evidence | REQ-R001-014 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 复制 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader selection | 引用 | REQ-R001-014 | SPEC-R001-S03-003 | TEST-R001-S03-008 | 选择该动作得到规定结果或取消无写入，anchor 可重开 |
| Reader | Reference Explorer | REQ-R001-004, REQ-R001-014, REQ-R001-015 | SPEC-R001-S03-004 | TEST-R001-S03-009 | 真实 reference/相关来源可打开；无标识保留 unresolved |
| Reader | Related Papers | REQ-R001-004, REQ-R001-014, REQ-R001-015 | SPEC-R001-S03-004 | TEST-R001-S03-009 | 真实 reference/相关来源可打开；无标识保留 unresolved |
| Reader | 复制引用 | REQ-R001-004, REQ-R001-014, REQ-R001-015 | SPEC-R001-S03-004 | TEST-R001-S03-009 | 真实 reference/相关来源可打开；无标识保留 unresolved |
| AI Reading | 一句话总结 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该摘要模式/字段且可定位，缺字段写未报告 |
| AI Reading | 3 分钟阅读 | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该摘要模式/字段且可定位，缺字段写未报告 |
| AI Reading | Research Question | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该摘要模式/字段且可定位，缺字段写未报告 |
| AI Reading | Study Design | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该摘要模式/字段且可定位，缺字段写未报告 |
| AI Reading | Population | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该摘要模式/字段且可定位，缺字段写未报告 |
| AI Reading | Sample Size | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该摘要模式/字段且可定位，缺字段写未报告 |
| AI Reading | Intervention/Exposure | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Comparator | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Outcome | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Methods | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Statistics | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Key Results | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Effect Size | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及原文 anchor，统计值不推算 |
| AI Reading | Conclusion | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及来源；支持/反对必须经过验证 |
| AI Reading | Limitations | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及来源；支持/反对必须经过验证 |
| AI Reading | Bias | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及来源；支持/反对必须经过验证 |
| AI Reading | My Project Relevance | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及来源；支持/反对必须经过验证 |
| AI Reading | Supporting Evidence | REQ-R001-004, REQ-R001-014 | SPEC-R001-S04-002 | TEST-R001-S04-007 | 输出该字段及来源；支持/反对必须经过验证 |
| AI Reading | Counter Evidence | REQ-R001-004, REQ-R001-014 | SPEC-R001-S04-002 | TEST-R001-S04-007 | 输出该字段及来源；支持/反对必须经过验证 |
| AI Reading | Worth Following | REQ-R001-004, REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 | 输出该字段及来源；支持/反对必须经过验证 |
| Evidence | Evidence Retrieval | REQ-R001-005 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 保存原文及该定位字段并精确高亮，错误区间拒绝 |
| Evidence | Original Text 保存 | REQ-R001-005 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 保存原文及该定位字段并精确高亮，错误区间拒绝 |
| Evidence | Paragraph Locator | REQ-R001-005 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 保存原文及该定位字段并精确高亮，错误区间拒绝 |
| Evidence | Page Locator | REQ-R001-005 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 保存原文及该定位字段并精确高亮，错误区间拒绝 |
| Evidence | Section Locator | REQ-R001-005 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 保存原文及该定位字段并精确高亮，错误区间拒绝 |
| Evidence | SUPPORT | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 该关系/来源状态独立可见，未经验证不支持 Claim |
| Evidence | AGAINST | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 该关系/来源状态独立可见，未经验证不支持 Claim |
| Evidence | UNCERTAIN | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 该关系/来源状态独立可见，未经验证不支持 Claim |
| Evidence | Fulltext Evidence | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 该关系/来源状态独立可见，未经验证不支持 Claim |
| Evidence | Abstract Evidence | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 该关系/来源状态独立可见，未经验证不支持 Claim |
| Evidence | Secondary Citation | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 该关系/来源状态独立可见，未经验证不支持 Claim |
| Evidence | Evidence Verify | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-001 | TEST-R001-S04-006 | 验证/映射/引用解析到同一原文，不接受伪造 ID |
| Evidence | Semantic Verify | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-002 | TEST-R001-S04-007 | 验证/映射/引用解析到同一原文，不接受伪造 ID |
| Evidence | Claim → Evidence | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-002 | TEST-R001-S04-007 | 验证/映射/引用解析到同一原文，不接受伪造 ID |
| Evidence | Evidence → Paper | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-004 | TEST-R001-S04-009 | 验证/映射/引用解析到同一原文，不接受伪造 ID |
| Evidence | Citation Serializer | REQ-R001-005, REQ-R001-006 | SPEC-R001-S04-002 | TEST-R001-S04-007 | 验证/映射/引用解析到同一原文，不接受伪造 ID |
| Evidence | Counter Evidence | REQ-R001-006, REQ-R001-015 | SPEC-R001-S04-004 | TEST-R001-S04-009 | 执行该表格/比较/追踪操作，失败不提升证据资格 |
| Evidence | Reference Chasing | REQ-R001-006, REQ-R001-015 | SPEC-R001-S04-004 | TEST-R001-S04-009 | 执行该表格/比较/追踪操作，失败不提升证据资格 |
| Evidence | Evidence Table | REQ-R001-006, REQ-R001-015 | SPEC-R001-S04-003 | TEST-R001-S04-008 | 执行该表格/比较/追踪操作，失败不提升证据资格 |
| Evidence | Evidence Compare | REQ-R001-006, REQ-R001-015 | SPEC-R001-S04-003 | TEST-R001-S04-008 | 执行该表格/比较/追踪操作，失败不提升证据资格 |
| Knowledge | Paper Library | REQ-R001-012 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 明确 scope/membership，收藏删除搜索与来源跳转可用 |
| Knowledge | Project Papers | REQ-R001-012 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 明确 scope/membership，收藏删除搜索与来源跳转可用 |
| Knowledge | My Papers | REQ-R001-012 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 明确 scope/membership，收藏删除搜索与来源跳转可用 |
| Knowledge | Uploaded Papers | REQ-R001-012 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 明确 scope/membership，收藏删除搜索与来源跳转可用 |
| Knowledge | Evidence Library | REQ-R001-012, REQ-R001-015 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 按 Claim/Paper/状态分组仍指向同一 Evidence |
| Knowledge | Evidence Group | REQ-R001-012, REQ-R001-015 | SPEC-R001-S06-001 | TEST-R001-S06-006 | 按 Claim/Paper/状态分组仍指向同一 Evidence |
| Knowledge | Notes | REQ-R001-012 | SPEC-R001-S06-002 | TEST-R001-S06-007 | 该 Note scope/Tag 增改删可重载，原文关系不变 |
| Knowledge | Paper Notes | REQ-R001-012 | SPEC-R001-S06-002 | TEST-R001-S06-007 | 该 Note scope/Tag 增改删可重载，原文关系不变 |
| Knowledge | Selection Notes | REQ-R001-012 | SPEC-R001-S06-002 | TEST-R001-S06-007 | 该 Note scope/Tag 增改删可重载，原文关系不变 |
| Knowledge | Tags | REQ-R001-012 | SPEC-R001-S06-002 | TEST-R001-S06-007 | 该 Note scope/Tag 增改删可重载，原文关系不变 |
| Knowledge | Search | REQ-R001-012 | SPEC-R001-S06-003 | TEST-R001-S06-008 | 查询仅命中授权 scope，RAG 无合格资料明确不足 |
| Knowledge | Project RAG | REQ-R001-012 | SPEC-R001-S06-004 | TEST-R001-S06-009 | 查询仅命中授权 scope，RAG 无合格资料明确不足 |
| Knowledge | RIS | REQ-R001-017 | SPEC-R001-S08-003 | TEST-R001-S08-008 | 导出该格式可解析、字段来自真实保存题录 |
| Knowledge | BibTeX | REQ-R001-017 | SPEC-R001-S08-003 | TEST-R001-S08-008 | 导出该格式可解析、字段来自真实保存题录 |
| Knowledge | Markdown Export | REQ-R001-017 | SPEC-R001-S08-003 | TEST-R001-S08-008 | 导出该格式可解析、字段来自真实保存题录 |
| Statistics data | CSV 上传 | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 导入/预览/修正对应行为可见且行不进模型 |
| Statistics data | XLSX 上传 | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 导入/预览/修正对应行为可见且行不进模型 |
| Statistics data | Dataset Preview | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 导入/预览/修正对应行为可见且行不进模型 |
| Statistics data | 类型推断 | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 导入/预览/修正对应行为可见且行不进模型 |
| Statistics data | Missing 分析 | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 导入/预览/修正对应行为可见且行不进模型 |
| Statistics data | 用户修正变量类型 | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 | 导入/预览/修正对应行为可见且行不进模型 |
| Statistics planning | 自然语言统计问题 | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该计划字段明确并可审阅，缺变量禁止审批 |
| Statistics planning | Outcome | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该计划字段明确并可审阅，缺变量禁止审批 |
| Statistics planning | Exposure | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该计划字段明确并可审阅，缺变量禁止审批 |
| Statistics planning | Covariates | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该计划字段明确并可审阅，缺变量禁止审批 |
| Statistics planning | 统计方法推荐 | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该计划字段明确并可审阅，缺变量禁止审批 |
| Statistics planning | Analysis Plan | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该计划字段明确并可审阅，缺变量禁止审批 |
| Statistics execution | Python Code | REQ-R001-007, REQ-R001-008, REQ-R001-010 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该执行步骤/日志绑定当前审批与 run，失败无结果 |
| Statistics execution | Code Preview | REQ-R001-007, REQ-R001-008, REQ-R001-010 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该执行步骤/日志绑定当前审批与 run，失败无结果 |
| Statistics execution | 用户确认 | REQ-R001-007, REQ-R001-008, REQ-R001-010 | SPEC-R001-S05-002 | TEST-R001-S05-007 | 该执行步骤/日志绑定当前审批与 run，失败无结果 |
| Statistics execution | Sandbox Run | REQ-R001-007, REQ-R001-008, REQ-R001-010 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该执行步骤/日志绑定当前审批与 run，失败无结果 |
| Statistics execution | stdout | REQ-R001-007, REQ-R001-008, REQ-R001-010 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该执行步骤/日志绑定当前审批与 run，失败无结果 |
| Statistics execution | stderr | REQ-R001-007, REQ-R001-008, REQ-R001-010 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该执行步骤/日志绑定当前审批与 run，失败无结果 |
| Statistics result | OR | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 该数值/解释回到成功 run，失败和不可估计不伪造 |
| Statistics result | RR | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 该数值/解释回到成功 run，失败和不可估计不伪造 |
| Statistics result | HR | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 该数值/解释回到成功 run，失败和不可估计不伪造 |
| Statistics result | CI | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 该数值/解释回到成功 run，失败和不可估计不伪造 |
| Statistics result | P | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 该数值/解释回到成功 run，失败和不可估计不伪造 |
| Statistics result | AI 解释 | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 该数值/解释回到成功 run，失败和不可估计不伪造 |
| Statistics chart | Histogram | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics chart | Box Plot | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics chart | Scatter | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics chart | Forest Plot | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics chart | ROC | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics chart | Correlation | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics chart | Kaplan-Meier | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 适用数据真实生成该图，PNG/SVG 可下载；不适用解释 |
| Statistics export | PNG | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 成功 run 导出该格式，hash/Project 身份可验证 |
| Statistics export | SVG | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 | 成功 run 导出该格式，hash/Project 身份可验证 |
| Statistics provenance | Dataset Hash | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该 provenance 字段可解析且与输入/执行记录一致 |
| Statistics provenance | Code Hash | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该 provenance 字段可解析且与输入/执行记录一致 |
| Statistics provenance | Runtime | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该 provenance 字段可解析且与输入/执行记录一致 |
| Statistics provenance | Package Version | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该 provenance 字段可解析且与输入/执行记录一致 |
| Statistics provenance | Execution Log | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 该 provenance 字段可解析且与输入/执行记录一致 |
| Skill categories | PubMed Deep Search | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Medical Translator | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Paper Summarizer | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Evidence Extractor | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | PONV Evidence Reviewer | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Critical Appraisal | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Logistic Regression | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Survival Analysis | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Meta Analysis | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Literature Review Writer | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Academic Translator | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Thoracic Paper Extractor | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill categories | Clinical Guideline Reader | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 按内置目录逐项执行输入/输出/权限与医学正负例 |
| Skill Center | Skill 广场 | REQ-R001-016 | SPEC-R001-S07-001 | TEST-R001-S07-006 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | 分类 | REQ-R001-016 | SPEC-R001-S07-001 | TEST-R001-S07-006 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Search | REQ-R001-016 | SPEC-R001-S07-001 | TEST-R001-S07-006 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Skill Detail | REQ-R001-016 | SPEC-R001-S07-001 | TEST-R001-S07-006 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Install | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Uninstall | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Enable/Disable | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Update | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | Installed | REQ-R001-016 | SPEC-R001-S07-001 | TEST-R001-S07-006 | 对应目录或安装操作真实变更状态并审计，拒绝保持旧版 |
| Skill Center | My Skills | REQ-R001-016 | SPEC-R001-S07-001 | TEST-R001-S07-006 | 草稿/测试/发布/安装转换可重载，不隐式激活 |
| Skill Center | Create Skill | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 草稿/测试/发布/安装转换可重载，不隐式激活 |
| Skill Center | Edit Skill | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 草稿/测试/发布/安装转换可重载，不隐式激活 |
| Skill Center | Test Skill | REQ-R001-016 | SPEC-R001-S07-003 | TEST-R001-S07-008 | 草稿/测试/发布/安装转换可重载，不隐式激活 |
| Skill Center | Publish | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 草稿/测试/发布/安装转换可重载，不隐式激活 |
| Skill Center | Install to Workspace | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 草稿/测试/发布/安装转换可重载，不隐式激活 |
| Skill Builder | Name | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该字段保存、校验和执行一致；非法值准确报字段错误 |
| Skill Builder | Description | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该字段保存、校验和执行一致；非法值准确报字段错误 |
| Skill Builder | Version | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该字段保存、校验和执行一致；非法值准确报字段错误 |
| Skill Builder | System Instructions | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该字段保存、校验和执行一致；非法值准确报字段错误 |
| Skill Builder | Trigger | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该字段保存、校验和执行一致；非法值准确报字段错误 |
| Skill Builder | Allowed Tools | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该字段保存、校验和执行一致；非法值准确报字段错误 |
| Skill Builder | Input Schema | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该配置校验并参与执行，权限/模型引用不可绕过 |
| Skill Builder | Output Schema | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该配置校验并参与执行，权限/模型引用不可绕过 |
| Skill Builder | Knowledge | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该配置校验并参与执行，权限/模型引用不可绕过 |
| Skill Builder | Examples | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该配置校验并参与执行，权限/模型引用不可绕过 |
| Skill Builder | Model | REQ-R001-016 | SPEC-R001-S07-002 | TEST-R001-S07-007 | 该配置校验并参与执行，权限/模型引用不可绕过 |
| Skill Builder | Test Input | REQ-R001-016 | SPEC-R001-S07-003 | TEST-R001-S07-008 | 该输入/预览/发布/安装只使用当前 revision 与真实结果 |
| Skill Builder | Preview | REQ-R001-016 | SPEC-R001-S07-003 | TEST-R001-S07-008 | 该输入/预览/发布/安装只使用当前 revision 与真实结果 |
| Skill Builder | Publish | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 该输入/预览/发布/安装只使用当前 revision 与真实结果 |
| Skill Builder | Install | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 | 该输入/预览/发布/安装只使用当前 revision 与真实结果 |
| Writing | Literature Review | REQ-R001-017 | SPEC-R001-S08-001 | TEST-R001-S08-006 | 写作/翻译/导出可追溯，缺失与编辑失效阻止完成 |
| Writing | Academic Translation | REQ-R001-017 | SPEC-R001-S08-002 | TEST-R001-S08-007 | 写作/翻译/导出可追溯，缺失与编辑失效阻止完成 |
| Writing | Citation Export | REQ-R001-017 | SPEC-R001-S08-003 | TEST-R001-S08-008 | 写作/翻译/导出可追溯，缺失与编辑失效阻止完成 |
| DSH Platform | Agent Runtime | REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-004 | TEST-R001-S01-009 | 真实 profile 完成注册/调用/审批/隔离/回放/释放，缺依赖失败 |
| DSH Platform | Tool System | REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-004 | TEST-R001-S01-009 | 真实 profile 完成注册/调用/审批/隔离/回放/释放，缺依赖失败 |
| DSH Platform | Permission/Approval | REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-004 | TEST-R001-S01-009 | 真实 profile 完成注册/调用/审批/隔离/回放/释放，缺依赖失败 |
| DSH Platform | Sandbox | REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S05-003 | TEST-R001-S05-008 | 真实 profile 完成注册/调用/审批/隔离/回放/释放，缺依赖失败 |
| DSH Platform | Session Context | REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-001 | TEST-R001-S01-006 | 真实 profile 完成注册/调用/审批/隔离/回放/释放，缺依赖失败 |
| DSH Platform | Plugin Architecture | REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-004 | TEST-R001-S01-009 | 真实 profile 完成注册/调用/审批/隔离/回放/释放，缺依赖失败 |

## 上层能力与平台映射

矩阵第 3 节的能力域由上述具体条目覆盖：Research→S02，Evidence→S04，Reader→S03，Knowledge→S01/S06，Statistics→S05，Skills→S07，Writing→S08。Citation Verification 同时检查位置和语义，不仅检查 Paper 是否存在。Skill Marketplace 指受信本地目录的完整浏览/安装流程，商业交易与未审查远程包仍不在范围。

矩阵第 16 节全部平台映射：Research Agent/Project Context/Approval→S01；PubMed→S02；PMC/Fulltext Resolver/Translation/Paper Summary→S03；Evidence Engine→S04；Statistics Plan/Execute/Permission→S05；Skill Marketplace/Install/Builder/Project-specific Skills/Model Selection→S07；File Upload→S03 与 S05；Observability→S01 的审计与各业务操作记录。模型选择必须解析有效部署模型，File Upload 的 PDF 与 CSV/XLSX 分别验证，不能仅上传成功就通过解析验收。

Project Datasets/Statistics Runs 的实际列表/详情/重新查看由 S05 提供；S01 负责入口和计数，不把其归给没有对应记录的 Knowledge。Reader Notes 实体由 S03 提供，S06 的 Notes 行验收其库管理。跨 Spec 调用与集成责任见 [共享接口](interfaces.md)。

## 矩阵原名对照

以下保留矩阵上层能力及复合行的原名，验收须展开为上表功能与对应 Test 的全部分项断言。论文问答明确包含整篇 Document scope，不仅选区问答。

| Matrix feature | REQ | 主责行为 | Planned TEST |
|---|---|---|---|
| 医学文献检索 | REQ-R001-003 | SPEC-R001-S02-002 | TEST-R001-S02-007 |
| Query Planning | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 |
| 文献筛选 / Rerank | REQ-R001-003 | SPEC-R001-S02-003 | TEST-R001-S02-008 |
| Claim Grounding | REQ-R001-006 | SPEC-R001-S04-002 | TEST-R001-S04-007 |
| 论文阅读 | REQ-R001-004 | SPEC-R001-S03-001 | TEST-R001-S03-006 |
| AI 论文总结 | REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 |
| 论文问答 | REQ-R001-014 | SPEC-R001-S03-002 | TEST-R001-S03-007 |
| 保存为 Evidence | REQ-R001-005 | SPEC-R001-S04-001 | TEST-R001-S04-006 |
| Project Workspace | REQ-R001-001 | SPEC-R001-S01-001 | TEST-R001-S01-006 |
| Research Notes | REQ-R001-012 | SPEC-R001-S03-003 | TEST-R001-S03-008 |
| Dataset Profiling | REQ-R001-007 | SPEC-R001-S05-001 | TEST-R001-S05-006 |
| Analysis Planning | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 |
| Code Generation | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 |
| Code Execution | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 |
| Statistical Interpretation | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 |
| Visualization | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 |
| Reproducibility | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 |
| Skill Management | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 |
| Skill Test | REQ-R001-016 | SPEC-R001-S07-003 | TEST-R001-S07-008 |
| Permission / Approval | REQ-R001-010 | SPEC-R001-S01-004 | TEST-R001-S01-009 |
| PICO / PECO 提取 | REQ-R001-002 | SPEC-R001-S02-001 | TEST-R001-S02-006 |
| Outcome 识别 | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 |
| Exposure 识别 | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 |
| Covariates 识别 | REQ-R001-007 | SPEC-R001-S05-002 | TEST-R001-S05-007 |
| stdout / stderr | REQ-R001-008 | SPEC-R001-S05-003 | TEST-R001-S05-008 |
| OR / RR / CI / P | REQ-R001-008 | SPEC-R001-S05-004 | TEST-R001-S05-009 |
| Enable / Disable | REQ-R001-016 | SPEC-R001-S07-004 | TEST-R001-S07-009 |
