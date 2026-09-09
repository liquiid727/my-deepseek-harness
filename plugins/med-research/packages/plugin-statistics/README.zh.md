# @medresearch/dsh-plugin-statistics

[English](README.md) | 中文

## 概述

Med Research Workspace 的阶段 5 组件。持久化分析计划、生成代码，并通过隔离 runner 执行已审批的 run。设计与隔离决策见 `docs/decisions/2026-09-08-phase5-statistics.md`。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `timeoutMs` | `120000` | 单次执行的墙钟上限 |
| `cpuSeconds` | `60` | 传给 runner 的 CPU 秒上限 |
| `memoryMb` | `1024` | 地址空间上限 |
| `maxOutputBytes` | `200000` | 捕获的 stdout+stderr 上限 |
| `allowlist` | `[]` | 生成代码可导入的第三方包 |
| `artifactRoot` | 必填 | 产物注册前，run 产出复制到的持久目录 |

`allowlist` 是 fail-closed 的：标准库始终可导入，其余包必须在此列出。runner 环境还必须实际安装这些包；缺包时 run 会在 import 处如实失败。PRD §34 给出的 V1 集合是 `pandas`、`numpy`、`scipy`、`statsmodels`、`matplotlib`、`openpyxl`。

## 模型影响

只注册 `src/index.ts` 中记录的工具；结果为机器可读 JSON 信封或领域记录。

规划失败与其他 Med 工具一样返回值信封 `{ ok: false, error }`：未知数据集返回
`DATASET_NOT_FOUND`；代码生成或执行时找不到 run，或 run 状态不满足要求，返回
`STATISTICS_PLAN_INVALID`。两者都不可重试，并在 `error.details` 保留诊断 id；未知异常仍按真实注册表失败外显。

## 已知限制与后续工作

- 插件提供无依赖 SVG 模板，覆盖 P0 的 Histogram、Box Plot、Bar Chart、Scatter；调用方必须通过与 run 关联的 artifact 路径持久化 SVG。
- 其余缺口（容器 provider、真实统计 fixture）见阶段 5 决策记录与根 README。
