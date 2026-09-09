# @medresearch/dsh-bundle-medical

[English](README.md) | 中文

## 概述

Med Research Workspace 的 bundle 层（SPEC §4.1、§15.1）：纯数据补丁，插入 SQLite backend、隔离 Runner、8 个 host 插件与 `med-ui` 客户端行。patch 会整体替换匹配行的 config，因此每行重述自己的 config——本 bundle 有意不带 config，因为 `workspaceRoot`、NCBI 的 `tool`/`email`、`artifactRoot` 都是部署值，由 profile 的用户补丁层提供（缺必填字段时加载期 fail-loud）。

domain facility 用的是 base bundle 的 `storage-domain` 行，而不是本层再插一行：第二个 `dsh-storage-domain` 行只在自己的 fiber 作用域里提供 facility，兄弟 med 插件拿不到，会静默继续用 base 的 JSON medium。因此 profile 必须把 base 那行路由到本层注册的 SQLite backend。

## profile 必填配置

```yaml
- id: med-storage-sqlite
  config: { path: /path/to/med.sqlite }
- id: storage-domain
  config: { backend: sqlite }
- id: med-project
  name: '@medresearch/dsh-plugin-project'
  config: { workspaceRoot: /path/to/med-workspaces }
- id: med-literature
  name: '@medresearch/dsh-plugin-literature'
  config: { tool: <ncbi-tool-id>, email: <contact@example.com> }
- id: med-artifact
  name: '@medresearch/dsh-plugin-artifact'
  config: { artifactRoot: /path/to/med-artifacts }
- id: med-statistics
  config:
    artifactRoot: /path/to/med-artifacts
    allowlist: [pandas, numpy, scipy, statsmodels, matplotlib, openpyxl]
```

`allowlist` 是部署对生成代码的包策略（SPEC §36、PRD §34）：它只**允许**导入；runner 环境还必须实际安装这些包，否则 run 会在 import 处如实失败。

## 模型影响

无：bundle 只做组合。

## 已知限制与后续工作

- `dsh plugin --profile med-research add @medresearch/dsh-bundle-medical` 尚未实际执行；profile 安装属阶段 8 E2E。
