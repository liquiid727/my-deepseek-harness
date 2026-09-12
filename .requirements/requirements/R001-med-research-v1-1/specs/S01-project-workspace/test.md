---
requirement: R001
spec_package: S01
test_spec_id: TEST-R001-S01
source_prd: ../../prd.md
source_spec: ./spec.md
source_spec_id: SPEC-R001-S01
source_spec_version: 2.1.0
source_spec_hash: 3d1fac01601985ad283ce24d7353e2ae28aec4445485bc230793b7c0ddbd201a
version: 2.0.0
status: review
owner: med-research-testing
qualityProfile: fullstack-flow
riskTier: P0
---

# Test Design — S01 Project Workspace and Workbench Shell

## 1. Purpose and Scope

验证 [Spec](spec.md) 的全部 V1 P0/P1 行为，含[逐项能力](../../coverage.md)、[共享接口](../../interfaces.md)、[UI 约束](../../ui-acceptance.md)和[内置 Skill](../../builtin-skills.md)。本文件只定义计划，未执行且未获人工测试设计批准；历史 evidence 不能视为本版本结果。

In scope: REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018；AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015。实现耦合单测覆盖数据/算法，独立 Service/Remote、profile、浏览器、Runner 与医学评审分别覆盖实际消费行为。代码实现、生产上线、真实患者数据和 R001 Non-Goals 不属于此文档操作范围。

## 2. Coverage Matrix

| Requirement | Spec behavior | Planned Test | Level / evidence / gate |
|---|---|---|---|
| REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-001 | TEST-R001-S01-006 | 独立 Service/Remote + 持久化；逐 feature 断言、响应/状态记录；blocking |
| REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-002 | TEST-R001-S01-007 | 独立 Service/Remote + 持久化；逐 feature 断言、响应/状态记录；blocking |
| REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-003 | TEST-R001-S01-008 | 独立 Service/Remote + 持久化；逐 feature 断言、响应/状态记录；blocking |
| REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018 | SPEC-R001-S01-004 | TEST-R001-S01-009 | 独立 Service/Remote + 持久化；逐 feature 断言、响应/状态记录；blocking |
| REQ-R001-009 | 全部 UI 行为 | TEST-R001-S01-004 | 真实浏览器截图/操作 trace/console；blocking |
| REQ-R001-018 | 全部注册与模型可见行为 | TEST-R001-S01-003, TEST-R001-S01-005 | profile/Session replay/disposal；blocking |

BR-R001-001..005、INV-R001-001..007、EDGE-R001-001..010 按责任适用：所有包承担范围/来源/回放/并发/窄屏，S01 承担无 Session/导入，S02/S04 承担 Connector partial，S03/S04/S06/S08 承担 anchor/Claim/Draft，S05 承担 Runner/行隐私，S07 承担 Skill 扩权。无该领域 API 的包不重复执行其负例，但 TEST-R001-S01-005 必须引用对应 owner 的集成结果。每项 AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015 都需当前绑定结果。

## 3. Test Environment and Data

- 数据集计划名称 R001-S01-contract-v1，包含下方每个命名输入与负例；实现测试资产时记录精确文件/hash。这些名称是待创建的验证数据，不声称现有 fixture 已覆盖。
- 公共文献样本使用有许可的 Abstract、PDF 与 PMC XML，保存真实 PMID/DOI/source response；录制网络只用于确定性负例，live Connector/模型是完整流程独立证据。
- 统计预览用 8 行合成数据；方法/图表用 seed=20260912、400 行合成数据，含 numeric/categorical/binary/time/event 和明确 missing。验证者用独立参考脚本冻结结果与数据 hash，数值绝对/相对容差均 1e-6；不直接复制产品结果作 expected。若平台数值误差需调整，先记录依据并人工批准设计版本。
- Node 使用仓库支持版本、实际 med-research profile、真实 service/storage 与构建产物。浏览器环境和三种 viewport 由 UI 约束固定。启动须经 dsh profile；执行记录必须写实际 launcher 命令、参数、配置 hash，不用凭空指定的 package bin。
- 每个 run 用独立临时目录、数据库、Project/Session/port；异步阶段用可观测事件屏障，不用固定 sleep。取消/测试失败也等待 Agent、Runner、网络请求与监听器释放；保留失败证据后清理本 run 所有资源。
- 医学案例与 Skill 语义数据由 [评估协议](../../evaluation.md)冻结；样本与阈值未批准时记录 BLOCKED，不能自动接受。密钥只由部署提供，日志脱敏；真实患者行禁止作为截图或 fixture。

## 4. Affected Observable Surfaces

| Surface | Consumer | Evidence |
|---|---|---|
| API / storage | 下方明确列出的公开操作及真实 Provider | response、前后 state、ID/version/audit 对照 |
| UI | med-research profile 中对应 view/action | 三视口截图、焦点/布局断言、trace/console |
| Model / Session | 实际 Agent/Tool pipeline 与不可变内容引用 | 版本化 keyless session replay、逐输入重建比对 |
| Security / lifecycle | 真实工具权限与任务释放 | 拒绝时零调用/零非法写、资源清理记录 |
| Build / delivery | Loader 装载的真实 profile 包 | module export 与 client 注册 smoke、缺依赖负例 |

以上均为 blocking；源码单测不代替构建装载，静态组件截图不代替真实服务流程。涉及 SessionEventMap 时同时计划 TypeScript/Python SDK 预期输出，记录受影响项；无事件变化时说明不适用理由。

## 5. Test Scenarios

### TEST-R001-S01-001 Primary outcome

Given 下方正例输入与独立 Project，When 通过 medProjects.create/update/get/sessions 完成该业务并重载，Then 用户可见结果与各 owned record 的 ID/version/来源一致；不能只检查模型声称成功。覆盖本包全部 REQ/AC 的主流程，由 006 起的精确行为用例提供分项断言。

### TEST-R001-S01-002 Failure honesty

Given 下方每项负例（PONV-A、Thoracic-B 两个独立 workspace，PICO 文本与一个 Session；A 含 2 Paper memberships、1 Evidence、1 Dataset、2 runs（成功/失败各一）、1 chart；B 为空；无 Session 的 profile 与两个已保存会话；各 Mode 的允许/禁止工具，含 Dataset 与 Draft 的完整备份），When 调用对应公开操作，Then 返回 Spec 声明错误/partial，成功记录保留、非法写为零。每个负例单列输入、实际 code、前后状态，不把一次通用失败代表所有失败分支。

### TEST-R001-S01-003 Invariant, retry, and isolation

Given 相同 requestId 的重复输入/不同输入、相同 expectedVersion 的并发写、Project 切换和取消屏障，When 调用本包写操作与跨 Project 伪造请求，Then 相同请求复用、异输入 REQUEST_CONFLICT、落后写 VERSION_CONFLICT、越权 SCOPE_DENIED；没有双终态或旧 Project 回包污染。随后释放贡献并重装，数量不累积；逐个重建模型输入，不含 Dataset 行/密钥。

### TEST-R001-S01-004 Asset-aligned browser UI

Given [UI 验收](../../ui-acceptance.md)规定的真实数据与本包页面，When 执行对应截图场景及所有 loading/empty/partial/failure/窄屏/键盘/zh-en 操作，Then 每个规定区域、控件、密度、来源状态与焦点断言分别通过。S06/S08 按共享 list/editor 约束验收；跨包 Research 截图允许引用同一集成 run，但不能省去本包断言。

### TEST-R001-S01-005 Supported-profile release scenario

Given 构建后的全部 required contributions 与获准模型/Connector/Runner，When 从用户入口完成本包主流程并在新进程重开，Then 真实终态、持久数据与 keyless Session 回放一致；scope/平台缺依赖时明确失败。按 [医学评估](../../evaluation.md)提供 live 模型/来源及 reviewer 结果，缺凭据/数据/依赖记录 BLOCKED 或 NOT_RUN，不能用 self-skip 视为验收通过。

### TEST-R001-S01-006 Project create/update/bind

Covers: SPEC-R001-S01-001；REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018；AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015。关联 [coverage](../../coverage.md) 中指向此 TEST 的每一行。

Category / level: 独立 Service/Remote 集成与负例；Owner: med-research-testing；Gate: blocking。

Given: PONV-A、Thoracic-B 两个独立 workspace，PICO 文本与一个 Session。

When: 通过 medProjects.create/update/get/sessions，创建、编辑、切换、重载；并发提交同 expectedVersion；归档有活动 run 的 Project。

Then: 字段/Session Context 一致；一次写成功另一次 VERSION_CONFLICT；PROJECT_BUSY 不归档；取消完成后归档/恢复同 ID。

Required evidence: 分项输入/输出断言、服务响应、操作与审计 ID、前后持久状态；UI 行为同时引用 TEST-R001-S01-004，医学判断引用冻结评审结果。每个 coverage feature 单列 PASS/FAIL/BLOCKED/NOT_RUN；无执行结果不得填 PASS。

### TEST-R001-S01-007 Roster and overview

Covers: SPEC-R001-S01-002；REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018；AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015。关联 [coverage](../../coverage.md) 中指向此 TEST 的每一行。

Category / level: 独立 Service/Remote 集成与负例；Owner: med-research-testing；Gate: blocking。

Given: A 含 2 Paper memberships、1 Evidence、1 Dataset、2 runs（成功/失败各一）、1 chart；B 为空。

When: 通过 medProjects.list/overview 与五个概览入口，搜索选择 A、点击五项计数；注入 Evidence 计数失败后重试。

Then: 返回 2/1/1/2/1；历史显示两个 run 状态；失败域 unknown 而非 0；B 的计数均 0。

Required evidence: 分项输入/输出断言、服务响应、操作与审计 ID、前后持久状态；UI 行为同时引用 TEST-R001-S01-004，医学判断引用冻结评审结果。每个 coverage feature 单列 PASS/FAIL/BLOCKED/NOT_RUN；无执行结果不得填 PASS。

### TEST-R001-S01-008 Navigation and session recovery

Covers: SPEC-R001-S01-003；REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018；AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015。关联 [coverage](../../coverage.md) 中指向此 TEST 的每一行。

Category / level: 独立 Service/Remote 集成与负例；Owner: med-research-testing；Gate: blocking。

Given: 无 Session 的 profile 与两个已保存会话。

When: 通过 sidebar.primary.action、conversation.view，点击五个主导航、创建 Session、输入问题后切换/重载、打开/关闭右栏。

Then: 目标 view 与 Project/Session 匹配，输入/选择恢复，无双主输入；移除医学贡献后宿主正常，完整 profile 缺 required contribution 明确失败。

Required evidence: 分项输入/输出断言、服务响应、操作与审计 ID、前后持久状态；UI 行为同时引用 TEST-R001-S01-004，医学判断引用冻结评审结果。每个 coverage feature 单列 PASS/FAIL/BLOCKED/NOT_RUN；无执行结果不得填 PASS。

### TEST-R001-S01-009 Mode/audit/backup

Covers: SPEC-R001-S01-004；REQ-R001-001, REQ-R001-009, REQ-R001-010, REQ-R001-011, REQ-R001-018；AC-R001-001, AC-R001-013, AC-R001-014, AC-R001-015。关联 [coverage](../../coverage.md) 中指向此 TEST 的每一行。

Category / level: 独立 Service/Remote 集成与负例；Owner: med-research-testing；Gate: blocking。

Given: 各 Mode 的允许/禁止工具，含 Dataset 与 Draft 的完整备份。

When: 通过 medProjects.setMode、medExport/medImport、真实 Tool registry，尝试 mode 禁止调用、切换失败、导入损坏 hash/越界路径/未知域版本/同 ID 备份。

Then: 禁止工具零执行；失败恢复旧限制；坏导入零持久写；合法独立目标恢复各域和引用，日志不含行或密钥。

Required evidence: 分项输入/输出断言、服务响应、操作与审计 ID、前后持久状态；UI 行为同时引用 TEST-R001-S01-004，医学判断引用冻结评审结果。每个 coverage feature 单列 PASS/FAIL/BLOCKED/NOT_RUN；无执行结果不得填 PASS。

## 6. Required Coverage and Regression

回归范围为本包全部行为与共享接口消费者；每次输入/版本/权限变更覆盖重试、取消、并发、外部失败与原状态保留。Source/API 验证、独立 profile/持久化验证、UI/模型评估分层执行，不复用同一内部实现作为预期 oracle。性能由 S02 完整 Research 集成计时，本包引入同步 UI 阻塞或未释放任务同样失败。

非平凡产品/模型可见实现必须交付 keyless recorded-session snapshot；UI-only expected output 属于拥有者本地，不占顶层 Session fixture。图形演示随后续 GUI PR 的真实 server/model flow 记录；本次只写计划，不生成伪运行证据。

## 7. Evidence, Gates, and Flaky Policy

每条结果登记 evidence/index.yaml，携带 TEST/SPEC IDs、Spec/Test version/hash、PRD 及规范附件 hash、源代码 commit 和 dirty-tree fingerprint、命令/runner、环境/配置/依赖版本、时间、断言、实际状态、artifact 与 correlation IDs。同一集成 run 可供多个 TEST 引用，必须逐项映射；任一相关输入/代码/配置变化使受影响证据 stale。

| Stage | Owner / checks | Invalidated by / result |
|---|---|---|
| 实现 PR | 实现者执行受影响单测、类型与公开消费 smoke；QA 执行改变行为的正负例 | 相关 source/config/Spec 变化；阻塞 |
| 包验证 / merge | med-research-testing 独立执行 001–009（S08 至 008）及需要的模型/安全/性能案例 | 当前绑定或环境不符；阻塞 |
| 完整 V1 验收 | 产品/医学 reviewer 汇总八包、五原型、13 Skill、全部冻结 Gold Set | 缺 required 结果/人工审批；blocked，禁止 promotion |

每次失败保留原 attempt；重试通过不抹掉 flaky。产品缺陷回到实现，测试缺陷依据 Spec 修正，环境失败只阻塞依赖该环境的检查；未分类 flaky 不能通过 required gate。完整证据不足不能用通过总数掩盖。

## 8. Agent Eval Plan

S01 的 Mode/Project Context 是确定性策略与重建检查，不做医学自评分；006/009 与 Session replay 必须证明 100% 模型可见输入可重建和禁止调用为零。

AI 生成的本设计与案例需人工评审 coverage、assertions、risk、数据、隔离与 gate 后才能 status=approved；当前 status=review。线上观察仅作为未来执行协议，实际采样需获准脱敏数据，不授权本轮访问生产数据。

## 9. Exit Criteria

- [ ] 测试设计已获人工批准并绑定当前 Spec 与附件。
- [ ] 每条 P0/P1 功能及 applicable REQ/AC/BR/INV/EDGE 有当前结果。
- [ ] 所有 blocking 行为、安全、profile、UI 与医学门槛通过。
- [ ] 无未解释的 flaky、失败或旧版本证据复用。
- [ ] 独立 Review 与 QA 完成；本设计不自行作 accepted 决定。

## Normative Source Binding

本设计除 Spec hash 外同时绑定[规范文件清单](../../contract-manifest.yaml)，bundle SHA-256 为 a9a491f65eb02d94a111241db410934e7a25aa5388ac4ea2e0df502a317716c6。清单任一文件变化使受影响用例 stale；必须重新评审并更新绑定，不能只比 spec.md 判断证据可复用。
