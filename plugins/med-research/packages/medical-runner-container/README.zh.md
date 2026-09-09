# @medresearch/dsh-medical-runner-container

[English](README.md) | 中文

## 概述

Med Research Workspace 的阶段 5 组件。提供 `ctx.medRunner`（`StatisticsRunner` 缝），底层是受限子进程：无网络、数据集只读、独立可写输出目录、CPU/内存/超时限额、包白名单、无宿主密钥（SPEC §36）。设计与隔离决策见 `docs/decisions/2026-09-08-phase5-statistics.md`；封禁模块策略见 `docs/decisions/2026-09-09-runner-urllib-parse-allowance.md`（允许 `urllib.parse` 以便 `pathlib` 可用，`urllib.request` 仍封禁）。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `pythonPath` | `python3` | 执行分析代码的解释器 |
| `isolationLevel` | `restricted-process` | 本 provider 声明的隔离等级 |

`isolationLevel: "container"` 在加载期 fail-loud：本 provider 无法满足它，接受这个标签等于静默降级部署声明的隔离。需要该等级时请组合容器 provider。

## 模型影响

只注册 `src/index.ts` 中记录的工具；结果为机器可读 JSON 信封或领域记录。

## 已知限制与后续工作

- 生产级容器/bwrap provider 尚未实现；`restricted-process` 是 macOS / 无容器环境的回退，并如实标注。
- 其余缺口（XLSX 解析、真实统计 fixture）见阶段 5 决策记录与根 README。
