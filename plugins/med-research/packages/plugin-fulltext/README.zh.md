# @medresearch/dsh-plugin-fulltext

[English](README.md) | 中文

## 概述

Med Research Workspace 的全文解析层。提供 `ctx.medFulltext`；`paper_resolve_fulltext` 是模型可见的调用方。V1 依据论文 PMCID 解析机器可读渠道，失败时回退为 `abstract_only` 或 `unavailable`；绝不声称未检查过的渠道可用。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `europePmcBaseUrl` | `https://www.ebi.ac.uk/europepmc/webservices/rest` | Europe PMC REST 基址 |
| `timeoutMs` | `30000` | 请求超时 |

## 模型影响

本身不注册工具，返回 `FulltextResolution`；`unavailable` 是真实结果，绝不渲染为错误。

## 已知限制与后续工作

- 只检查 Europe PMC `fullTextXML` 渠道；NCBI PMC OA 包、Unpaywall、OpenAlex 与出版社渠道属 P1（SPEC §21）。
- 暂不返回 license 元数据；解析层会在来源提供时记录。
- 每次调用一次 GET，未做缓存。
