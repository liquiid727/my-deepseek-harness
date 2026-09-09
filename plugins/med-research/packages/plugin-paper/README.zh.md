# @medresearch/dsh-plugin-paper

[English](README.md) | 中文

## 概述

论文阅读与文档解析。提供 `ctx.medPapers`，注册 `paper_get` / `paper_get_document` / `paper_resolve_fulltext` / `paper_search_content`。把 JATS/PMC XML 解析为章节与段落，按需把摘要解析为 `ABSTRACT_ONLY` 文档，并把每段的归一化文本作为 offset 基准持久化（SPEC §10、§22.3）。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxSearchResults` | `50` | `paper_search_content` 返回的段落上限 |

## 模型影响

- `paper_get_document` 返回带 `parseStatus`（`READY` / `PARTIAL` / `FAILED` / `ABSTRACT_ONLY`）的文档。
- `paper_search_content` 返回带 id 的匹配段落，使证据片段能引用真实段落。
- `paper_resolve_fulltext` 返回解析结果；`status: unavailable` 是真实结果，不是错误。

## 已知限制与后续工作

- PDF 文本提取使用 `pdfjs-dist`；某页渲染失败会把文档标记为 `PARTIAL`，不会静默丢文本。
- `paper_search_content` 是线性子串扫描，不是 FTS（SPEC §23 的索引延后）。
- 只解析 JATS/PMC XML 与摘要；表格、图、参考文献列表不提取。
