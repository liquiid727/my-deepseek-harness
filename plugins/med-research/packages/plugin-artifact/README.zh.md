# @medresearch/dsh-plugin-artifact

[English](README.md) | 中文

## 概述

与 AnalysisRun 关联的产物（SPEC §38、Gate 5）。提供 `ctx.medArtifacts`，注册 `artifact_get` / `artifact_export`。`register` 拒绝任何未成功的 run，并把产出文件复制到持久目录，因此每个图或表都带 `analysisRunId`、dataset hash 与 code hash。在 Web 组合里还会注册带鉴权的 `GET /api/medArtifact.export` 路由，因为产物字节无法走 JSON Remote 信封。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `artifactRoot` | 必填 | 产物文件复制到的持久目录 |

## 模型影响

`artifact_get` 返回产物记录；`artifact_export` 返回该产物自身格式的 base64 与大小。失败的 run 不会被伪造出结果。

## 已知限制与后续工作

- 导出只返回已存格式的字节；SVG→PNG 之类的即时转换未实现。
- 图表注册只接受 `image/png` 和 `image/svg+xml`，与 PRD 的图表导出契约一致；不支持的图表 MIME 类型以 `FIGURE_FORMAT_UNSUPPORTED` 失败。
- 下载路由只在提供 `ctx.connection` 的组合（Web）里注册；其他应用通过 `artifact_export` 工具取字节。
