# Gate 5：统计执行的产物注册不能靠 apply 期解析

- 状态：已实施
- 日期：2026-09-09
- 依据：SPEC §38、PRD §35 Gate 5、packages/AGENTS.md「注册即 effect / 一个资源一个 owner」

## 问题

真实 Statistics 链跑通后核对数据库：run 成功、`resultJson` 正确，但 `artifactIds: []`，`u_med_analysis_med_artifacts` 为 0 行。即 Gate 5（每个统计数字/图必须关联成功的 AnalysisRun）在真实组合里静默失效。

原因：`plugin-statistics` 在 `apply` 时用 `ctx.get('medArtifacts')` 解析注册器，而插件是并发 apply 的；当统计插件先于 artifact 插件激活时，`ctx.get('medArtifacts')` 返回 `undefined`，服务构造里就没有 `artifacts`，`execute` 便跳过了注册。单元测试显式传入注册器，因此掩盖了这一点。

## 决定

1. `plugin-statistics` 的 `inject` 增加 `'medArtifacts'`：注册器成为**声明的依赖**，Cordis 保证 artifact 插件先激活，apply 期解析不再有竞态。
2. `artifactRoot` 由可选改为**必填** `Config` 字段：没有它，runner 没有输出目录，产物根本不会产生，Gate 5 无从满足；缺字段现在在加载期 fail-loud，而不是执行期静默跳过。
3. 组合测试补上「plan → generateCode → execute → 断言 run.artifactIds 与 artifact 记录」，把这条真实组合路径钉住。

## 验证

真实 profile（`--port 3099`，真实模型，审批由浏览器点「允许一次」）：

```
修复前 run 408f591e: status=succeeded resultJson={n:8,rates:{drug_a:0.5,drug_b:0.25}} artifactIds=[]
修复后 run 9f37221e: status=succeeded resultJson={n:8,rates:{drug_a:0.5,drug_b:0.25}}
                     artifactIds=["bed9c7f3-5c3d-408e-97a8-dd055768546c"]
artifact 记录: type=file mimeType=application/octet-stream
               storageKey=…/.med-run/artifacts/bed9c7f3-….txt
               analysisRunId=9f37221e-…
磁盘: .med-run/artifacts/<runId>/summary.txt 与 <artifactId>.txt 均存在
```

单元/组合侧：`medical-e2e/tests/composition.spec.ts` 在真实 Loader 组合下执行同一段 Python（stdlib `csv`/`json`/`os`），断言 `artifactIds` 长度为 1 且 `medArtifacts.get(id).analysisRunId === run.id`。

## 已知限制

- 组合测试依赖本机 `python3`（既有 runner 测试同样依赖）。
- 产物类型按扩展名映射（`.png`/`.svg` → figure，其余 → file）；本次产物是 `.txt`，记为 `file`，符合 SPEC §38。
