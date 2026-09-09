# @medresearch/dsh-medical-adapter-dsh

[English](README.md) | 中文

## 概述

记录本仓库依赖的 DSH 已发布包、版本与具名导出，并对照实际安装结果校验。DSH 升级前先跑 `runCompatibilityCheck()`（SPEC §65.2、AGENTS.md §2.1 #2）；不匹配会 fail-loud，而不是之后以运行时错误暴露。

## 模型影响

无：本适配层不注册任何模型表面。

## 已知限制与后续工作

- 只校验版本与导出是否存在，不校验行为；行为兼容仍依赖阶段 8 的 keyless E2E。
- `DSH_DEPENDENCIES` 必须与根 README 的版本表一起更新。
