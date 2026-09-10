# Med Research Workspace — 范围基线 V1.0

**状态**：当前开发基线
**适用文档**：V1.1 PRD、V1.1 SPEC 和 `0909/med-research-workspace-capability-feature-matrix-v1.0.md`

## 文档角色

V1.1 PRD 和 SPEC 是当前实现契约。能力矩阵是完整长期路线图，描述能力边界、候选优先级和目标工作面；矩阵不会自动扩大 V1.1 的实现范围。

新的能力只有在进入独立 PRD 或经批准的 PRD 变更后，才能生成 Spec 并获得实现授权。现有阶段计划负责把已批准的 PRD/SPEC 转换为可验证的阶段交付，不替代需求契约。

## 当前实现范围

首个端到端目标是 Research vertical slice：

```text
Project → Query Plan → PubMed → Paper → Evidence → Claim → Citation
```

V1.1 已批准的最小 Statistics chain 仍保留，但在 Research vertical slice 稳定前不进入并行实现：

```text
Dataset → Analysis Plan → Python → Isolated Runner → Result / Chart / Provenance
```

UI 只能使用 DSH 客户端插件扩展点：`conversation.view`、右侧栏 tabs、`tool.call.toolview`、`settings.section` 和 `shell.overlay`。效果图是交互和视觉验收参考，不授权独立前端、URL 路由或静态假页面。

## 矩阵状态规则

| 状态 | 含义 | 可否直接实现 |
|---|---|---:|
| `approved-v1.1` | 已被 V1.1 PRD/SPEC 覆盖 | 可以，按当前阶段计划执行 |
| `roadmap` | 矩阵中的长期能力，尚无当前实现契约 | 不可以，先进入 PRD |
| `conflict` | 矩阵与 V1.1 的优先级或交付定义不一致 | 不可以，先记录决策 |
| `blocked` | 依赖或基础设施尚未满足 | 不可以，先完成阻塞项 |

## 差异记录

| 矩阵能力 | 当前状态 | 处理方式 |
|---|---|---|
| Project、PubMed Research、Paper、Evidence、Claim、Citation | `approved-v1.1` | 按阶段 1–4 执行 |
| Dataset、Analysis Plan、Python、隔离 Runner、Provenance | `approved-v1.1` | Research 链稳定后执行阶段 5 |
| Evidence Table、Counter Search、Reference Chasing、Related Papers | `conflict` / `roadmap` | 进入后续 PRD，不能按矩阵 P0 直接开工 |
| Skill Marketplace、Skill Builder、安装/发布/升级 | `roadmap` | 先保留内置 Skill 接入边界，后续单独 PRD |
| PMC、Europe PMC、OpenAlex、R、Draft、团队协作 | `roadmap` | 按 V1.1 P1/P2 规划，单独评审 |
| 五张 UI 效果图 | `approved-v1.1` 的验收参考 | 随真实服务能力接入，不先实现静态页面 |

## 当前实现事实

医学业务实现位于 `plugins/med-research/`，阶段 1–6 已有包、测试与决策记录，阶段 7–8 为部分完成。后续状态以该插件仓库的 [能力矩阵基线](../../plugins/med-research/docs/roadmap/capability-matrix-baseline.md) 和 `docs/HANDOFF.md` 为准；不得按本目录旧扫描结论重建同名包。

## 阶段 0 基线证据

`packages/workbench/dsh-bridge/src/index.ts` 中的 `CallId` 类型修复已经存在于当前工作区用户改动中。以下聚焦测试已于 2026-09-10 运行并通过：

```text
node_modules/.bin/vitest run packages/workbench/workbench-contract/tests/events.spec.ts packages/workbench/pi-adapter/tests/adapter.spec.ts packages/workbench/dsh-bridge/tests/bridge.spec.ts
```

结果：3 个测试文件、17 个测试全部通过。

`pnpm-lock.yaml` 仍有两个 `fd-slicer@1.1.0` 顶层键。这是独立的依赖修复问题，本基线不修改 lockfile，也不把依赖门禁标记为已解决。

## 后续入口

阶段 1 已于当前 checkout 复验通过。继续工作前满足以下条件：

- Bridge 聚焦测试保持通过。
- 读取 `plugins/med-research/docs/HANDOFF.md` 与 `.todo/0909-implement` 的当前缺口。
- 对缺少产品契约的矩阵能力先建立后续 PRD，不直接实现。
- 对 V1.1 已批准但部分完成的能力，先补足 Spec 中缺失的公共接口和验收定义。
