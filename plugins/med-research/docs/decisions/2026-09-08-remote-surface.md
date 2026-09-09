# 阶段 7 宿主 Remote 与客户端桥接

- 状态：已实施（宿主 Remote + 客户端数据层；React 席位与打包待实施）
- 日期：2026-09-08
- 依据：SPEC §30、§42、AGENTS.md §2.1.5、§2.7

## 问题

阶段 7 的客户端视图需要读宿主业务数据，但 DSH 客户端不能直接调用宿主服务。SPEC §30 要求走 Typert `@Remote`，并给出一份接口清单。实施前必须回答三件事：宿主方法如何暴露、客户端如何取得描述符、以及 §30 清单与实际服务接口不一致时以谁为准。

## 决定

### 1. 宿主方法用 `@Remote` + `typertRemote` 绑定，走 SRC 发现

每个 `med` 服务类加：

```ts
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

export class ProjectsService implements MedProjectsService {
  readonly typertRemote = bindTypertRemote(this, 'medProjects')

  @Remote
  async create(input: ProjectCreateInput): Promise<Project> { … }
}
```

Gateway 的 SRC 发现（`resolveSrcDescriptor`）从活服务的原型读取 `@Remote` 标记，因此**不需要**生成的 `typert.host.js` 即可被 `/api` 拦截器认领。参数名即 wire 字段名，所以方法签名参数名就是客户端契约。

### 2. 客户端先用 `ctx.connection.rpc.call`，不引入生成产物

`packages/plugin-medical-ui/src/client/remote.ts` 定义 `RemoteCaller`（只要求 `call(channel, endpoint, payload, signal)`）与 `createMedRemote(caller)`，把 `ctx.connection.rpc` 适配成按服务分组的强类型方法，并在 `{ok:false}` 时抛 `MedRemoteError`（保留宿主 code / message / details）。

SPEC §30 允许「快速起步阶段临时用 `ctx.connection.rpc.handle`，正式实现必须迁移到 `@Remote`」。本决定满足前半句：宿主方法已经是 `@Remote` contribution；客户端通过通用 RPC 通道调用同一批端点。迁移到 `ctx.remote.$mount` 只替换 `remote.ts` 的实现，视图与组件不动。

### 3. 命名空间 = 服务键，以服务接口为准

SPEC §30 的清单与本仓库已实现的服务接口有出入：

| §30 | 实际 | 处理 |
|---|---|---|
| `medResearch/planQuery\|search\|get\|papers` | 服务键是 `medLiterature`，方法为 `planQuery` / `search` / `getPaper` | 用 `medLiterature` 命名空间；不发明 `get` / `papers` |
| `medEvidence/retrieve\|verify\|listForClaim` | 服务另有 `save` | 暴露服务完整接口（含 `save`） |
| `medProjects/*` | 服务另有 `savePaper` | 暴露服务完整接口（含 `savePaper`） |
| `medArtifacts/export` | 返回 `Uint8Array` | 走精确 Fetch 路由（见下） |

阶段 1 交付的 `medical-contracts/src/services.ts` 是工具与 Web 共用的接口，工具已经按它实现；Remote 只是同一接口的第二个消费者。以它为准可避免两套方法名。

### 4. `medArtifacts/export` 走精确 Fetch 路由

SRC 模式的结果编解码是 `src-json`，`Uint8Array` 过 JSON 会变成普通对象而不是字节。因此字节走 Connection 的精确 Fetch 路由（`dsh-client-file-upload`、`session-log-export` 是同类先例），JSON Remote 只保留 `medArtifacts/get`：

- 路由常量 `MED_ARTIFACT_EXPORT_PATH = "/api/medArtifact.export"` 与各格式 MIME 放在 `medical-contracts`，宿主与客户端共用，避免路径漂移；
- `plugin-artifact` 在提供 `ctx.connection` 的组合里注册 `GET`/`HEAD` 路由，`artifactExportResponse` 是纯函数（400/404/409 + 字节 + content-type），单独可测；
- 客户端 `artifact-download.ts` 生成同源下载 URL，`artifact_export` 工具卡片渲染下载链接（工具本身仍返回 base64 供模型读取）。

验证：`plugin-artifact/tests/artifact.spec.ts`（路由响应）、`plugin-medical-ui/tests/{artifact-download,toolview.client}.spec.tsx`（URL 与卡片）、`medical-e2e/tests/composition.spec.ts`（真实组合里注册了该路由）。

## 放弃的方案

- **运行 Typert 生成器产出 `typert.host.js` / `typert.remote-client.js`**：需要给每个包补 `composite` 项目引用、`lib/types` 声明输出、`tsconfig.host.json` 聚合与 `./typert` / `./remote` 导出，等于把当前 source-plane 仓库改成声明发射仓库。SRC 模式已能提供同样的调用路径，先把 UI 打通；生成产物作为后续「严格 schema 校验」增强项。
- **手写 strict 描述符 + `ctx.remote.$mount`**：需要为每个方法手抄 zod schema 与 typeSymbol，和 `medical-contracts` 重复，且容易漂移。
- **客户端直接用 `ctx.remote.med*`**：那要求生成 `TypertRemoteMap` 声明合并；在采用生成器之前不可得。

## 需要的验证

- `packages/medical-e2e/tests/remote-surface.spec.ts`：7 个服务的命名空间绑定与 `@Remote` 方法集合。
- `packages/plugin-project/tests/remote.spec.ts`：真实 Typert Registry + Gateway 的 SRC 调用（create / list / get / overview，以及未发布端点的拒绝）。
- `packages/plugin-medical-ui/tests/remote.spec.ts`：端点名、命名参数、取消透传、错误解包。
- `packages/medical-e2e/tests/remote-roundtrip.spec.ts`：`createMedRemote` 经 Gateway 真实 `/api` 拦截器打到真实 `ProjectsService`，含业务失败的错误信封。
- `pnpm run typecheck` 与 `pnpm run test`。

## 已知限制

- 参数名即 wire 字段名，因此客户端契约依赖宿主源码参数名不变。生成产物落地后由 schema 固定。
- 客户端 `remote.ts` 的方法签名是手写的；与宿主 `Med*Service` 接口的一致性目前靠 `remote-surface` 测试与代码评审，尚未做双向类型校验。
