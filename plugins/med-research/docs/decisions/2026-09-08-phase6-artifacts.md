# 决策：阶段 6 —— 产物与 AnalysisRun 的强关联

- 状态：已实施（阶段 6）
- 日期：2026-09-08
- 依据：SPEC §38、Gate 5；AGENTS.md §2.5

## 决定

`ArtifactService.register` 只接受 `status = succeeded` 的 AnalysisRun；注册时把产出文件复制到持久 `artifactRoot`，并写入该 run 的 `analysisRunId`、`datasetHash`、`codeHash`。非成功 run 或缺失 run 一律 fail-loud，因此 Gate 5（每个数字与图都能追到成功的 AnalysisRun）在数据层不可绕过。

`statistics_execute` 的输入新增可选 `outputDir`：runner 在删除临时目录前把产出复制到该目录，`outputs[].path` 指向持久路径。这解决了「runner 返回的路径在清理后失效」的问题。

## 当前状态

- `plugin-statistics` 在 execute 成功后通过持久 `outputDir` 调用 `medArtifacts.register`；统计链 E2E 已断言 artifact、provenance 与导出均存在。
- 导出只支持已存格式，不做格式转换；PNG/SVG figure 必须满足扩展名与 MIME 的精确配对。
