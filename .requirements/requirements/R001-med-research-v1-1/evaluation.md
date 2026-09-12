# R001 医学评估协议

本协议随 [PRD](prd.md) 2.1.0 批准。Spec 的设计批准不表示模型质量通过；没有医学评审批准的数据集、检索阈值和当前运行结果，AC-R001-016 与最终 QA 保持 blocked。

## 数据集与评审

Medical Reviewer 由产品负责人指定具医学背景且独立于实现与生成模型的人员；正式评估前在拥有 Spec 的 evidence 中登记姓名/角色、审批日期、数据版本与 hash。产品负责人批准样本覆盖和用途；模型自评分不能代替这两个决定。

冻结清单必须包含：研究问题、可接受 query/相关 Paper 标注、真实来源快照及许可、原文 anchors、目标 Claim、SUPPORT/AGAINST/UNCERTAIN 标签、二手引用标签、预期不足场景，以及 13 个 Skill 的输入和输出评分规则。分层覆盖 PONV、队列/RCT/综述、Abstract/PDF/PMC、中英文、冲突与无证据。样本规模由 reviewer 在运行前按分层与置信度说明理由，不能看结果后删失败样本。

数据集和阈值变更产生新版本并使受影响结果 stale；训练/提示调试集不得与最终留出集混用。歧义标签由另一位医学评审复核，保留两次标注与裁决。缺 reviewer 是执行验收阻塞，不是允许模型自行补齐的默认值。

## 指标定义

| 指标 | 计算 | 阻塞条件 |
|---|---|---|
| Source Integrity | 无 Connector/上传来源的 Paper 标识或书目字段数量 | 必须为 0 |
| Recall@20 | 每问题 Top 20 中相关唯一 Paper 数 / 该问题标注相关 Paper 总数；对有相关项问题取宏平均 | reviewer 在正式运行前冻结下限 |
| Precision@20 | 每问题 Top 20 中相关唯一 Paper 数 / 20，不足 20 的位置计不相关；有相关项问题宏平均 | reviewer 在正式运行前冻结下限 |
| Counter Evidence Miss Rate | 有标注反证但最终结果未呈现任何合格反证的问题数 / 有标注反证的问题数 | reviewer 在正式运行前冻结上限 |
| Evidence relocatability | 应可定位的真实 span 中返回正确 Document/anchor 的数量 / 全部应可定位 span | ≥98%；另报不可定位负例误接受数，必须为 0 |
| Relation Accuracy | 与裁决 relation 相同的候选数 / 全部已标注候选数 | ≥0.85；超时/无输出计错误 |
| Claim Support Precision | reviewer 判定被引用证据确实支持的已输出医学事实数 / 全部已输出医学事实数 | ≥0.85 |
| Unsupported Claim Rate | 无合格 Evidence 或与 reviewer 支持判断不符的已输出医学事实数 / 全部已输出医学事实数 | 0；与 precision 同时报告 |
| Provenance coverage | 全部字段可解析到成功 run 的统计产出数 / 全部已发布统计产出数 | 100% |

无标注相关项的问题不进入 Recall/Precision 分母，单列不足回答准确率并要求不得发明来源。空输出不令 precision/unsupported 指标自动通过：分母为零记 not-applicable，正例应产出却全部拒答则对应任务失败；只有负例的 run 不能接受。其余失败/取消不从分母删除。Counter 集无反证问题时指标不可评估并阻塞该能力验收。

13 个 Skill 逐个报告任务完成、输入遵循、字段完整性、事实与引用正确性、越权次数及所属业务指标；全部必交字段和安全门槛必须通过，不能用跨 Skill 平均数掩盖缺失。Critical Appraisal/PONV/Thoracic/Guideline 的医学判断由 reviewer 按冻结字段 rubric 验收，输出研究用途判断，不生成个体诊疗建议。

## 执行与证据

PR smoke 使用冻结集合中每种改变行为的正例、负例、权限拒绝和不足例；证据列出精确 case ID 及选择理由。完整包/发布验收运行整个冻结集合，记录失败与未运行项。检索降级必须保留词法结果并显示原因，降级本身不豁免质量门槛。

Research 性能从用户确认 query 至 ANSWER_READY 计时，包括重试；声明 profile、硬件、网络、模型、并发与候选上限，最多 20 篇最终论文。冻结性能集合后报告逐次耗时、nearest-rank P50/P95 和失败率；要求 P50 ≤90s、P95 ≤240s，失败不作为零耗时样本。

上线观察协议为按声明且获准的脱敏样本复用相同指标；任何伪造来源、无审批执行、跨 Project 暴露或行级数据模型暴露阻断相关能力并交还用户。其他质量偏差触发重新评审数据/模型版本，不允许自动降低阈值。此文仅定义验收，不授权本轮上线或采集用户数据。
