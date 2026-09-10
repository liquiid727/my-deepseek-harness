# Med Research Workspace 当前开发计划

## 入口与权威顺序

当前交付入口是 [R001 GoalSpec Workspace](../../.requirements/requirements/R001-med-research-v1-1/prd.md)。原 V1.1 [PRD](../../plugins/med-research/docs/prd/med-research-workspace-ultimate-prd-v1.1.md) 与 [SPEC](../../plugins/med-research/docs/spec/med-research-workspace-ultimate-spec-v1.1.md) 保留为需求和技术来源；[能力矩阵](med-research-workspace-capability-feature-matrix-v1.0.md) 是长期路线图；`asset/` 中五张效果图是交互与视觉输入。

出现冲突时按以下顺序处理：先保持 V1.1 已批准范围，再由 R001 子 Spec 明确可交付行为与验收映射；矩阵新增能力进入独立 PRD；原型不能扩大产品范围，也不能替代错误、安全、可访问性和证据要求。

## 当前状态

医学业务实现位于 `plugins/med-research/`。Project、PubMed、Paper、Evidence、Dataset、Statistics、Artifact、四个客户端视图、bundle/profile 和 keyless E2E 已有不同程度的实现与历史测试。当前事实以 [HANDOFF](../../plugins/med-research/docs/HANDOFF.md) 和 [能力矩阵基线](../../plugins/med-research/docs/roadmap/capability-matrix-baseline.md) 为准。

R001 的五个子 Spec 已批准，Test Design 均为待人工批准的 draft，review 为 open，acceptance 为 blocked。既有实现和历史测试不会因为规格转换自动成为验收证据；必须按当前 Spec 哈希和 TEST ID 重新执行或规范化。

## 执行顺序

### S01 Project Workspace

先核对项目创建、持久化、切换、会话绑定、上下文和真实计数。复用既有实现，补齐当前 Test Design 所需证据，不重建同名包。

完成条件：S01 Test Design 获批；当前 revision 的单元、契约和浏览器证据进入 `evidence/index.yaml`；独立 review 无阻塞项；S01 acceptance 被 QA 接受。

### S02 Literature Discovery

核对查询草案、用户确认、PubMed 检索、分页/重试/部分失败、去重、项目论文列表与来源记录。真实 API 只在显式 E2E 使用，常规验证使用固定 fixture。

完成条件：查询未确认时不发送；成功、空结果、限流、超时、部分失败和去重均有当前证据；Research UI 展示真实状态；S02 通过 review 与 QA acceptance。

### S03 Paper Reading

核对全文获取、JATS/PDF 归一化、定位状态、原文/翻译/双语、选区动作、笔记和 Evidence handoff。右栏席位依赖未满足时保持 blocked，不建立替代前端或 URL 路由。

完成条件：原文保持真源；解析失败不伪造全文；locator 可回到准确段落；桌面和窄屏无重叠；S03 通过 review 与 QA acceptance。

### S04 Evidence And Claims

核对 Evidence 检索、保存、定位与支持状态、Claim 验证、citation serializer 和模型可达入口。优先裁决 Claim Gate 是新增工具还是接入答案管线。

完成条件：`NOT_FOUND` 不能成为 `VERIFIED`；Claim 不引用不存在的 Evidence；引用编号由后端生成；Research 到原文定位链可重放；S04 通过 review 与 QA acceptance。

### S05 Reproducible Statistics

核对 Dataset profile、Analysis Plan、审批、代码生成、隔离执行、结果/图表、Artifact 和 provenance。P0 图表必须接入真实分析结果，Runner 失败不得生成统计结论。

完成条件：未审批不执行；网络、越权读取、资源超限和恶意代码被拒；成功结果携带数据、代码和运行时来源；失败可重放；S05 通过 review 与 QA acceptance。

S01 是共享上下文基础。S02-S04 组成 Research 链，按顺序推进。S05 可在 S01 稳定后独立推进，但 R001 根 acceptance 只有在五个 required package 均接受后才能解除 blocked。

## UI 原型验收

| 素材 | 所属入口 | 必须验证的状态 |
|---|---|---|
| `asset/首页.png` | S01 | 无项目、有项目、切换、真实计数、空状态 |
| `asset/搜索研究.png` | S02/S04 | 查询确认、结果、支持/反对/不确定、部分失败 |
| `asset/论文阅读器.png` | S03/S04 | 原文/翻译/双语、定位、选区、笔记、Evidence |
| `asset/统计lab.png` | S05 | Dataset、待审批 Plan、成功/失败、结果、图表、provenance |
| `asset/skill工作台.png` | R002 | 仅作为后续 Skills PRD 的信息层级与交互参考 |

UI 继续使用 DSH 客户端插件扩展点和类型化 zh/en 字典，不新增独立 Web 应用、URL 路由或静态 mock 业务结果。每个可见状态必须来自真实服务或明确标注的受控测试运行。

## R002 Skills

[R002](../../.requirements/requirements/R002-med-research-skills/prd.md) 当前为 draft/blocked。Skill Center、Marketplace、Builder、发布、安装、升级和撤销在信任来源、权限与凭据、沙箱、人工复核、评测阈值及兼容策略获批前不得实现。

R002 批准后再用 `prd-to-spec` 按独立用户结果拆包，不把矩阵中的每一行直接转成技术任务。

## 每个子包的推进门禁

1. 人工批准当前 Test Design，并确认测试表面。
2. 对照 Spec 检查既有实现，记录偏差，不以旧结论代替当前执行。
3. 按 TEST ID 运行最小充分检查，把结果写入所属 `evidence/index.yaml`。
4. 对产品可见 UI 运行组件测试和真实浏览器桌面/窄屏验证；需要交付 GUI 改动时录制真实流程 GIF。
5. 运行独立 review，关闭或批准豁免阻塞 finding。
6. 由 QA 更新子包 acceptance；五个子包均 accepted 后再评估 R001 根 acceptance。

## 下一批建议

先处理 S01：人工复核其 Test Design，并把当前 Project 相关实现、测试和浏览器状态映射到 `TEST-R001-S01-001` 至 `TEST-R001-S01-005`。这个批次只做证据规范化和已批准行为的缺口修复，不并入 R002 或其他 roadmap 能力。
