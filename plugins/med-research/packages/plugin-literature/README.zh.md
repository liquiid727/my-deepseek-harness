# @medresearch/dsh-plugin-literature

[English](README.md) | 中文

## 概述

Med Research Workspace 的 PubMed 发现层。提供 `ctx.medLiterature`，注册 `literature_plan_query` / `literature_search_pubmed` / `literature_get_paper`，并拥有 NCBI E-utilities 连接器：请求组装、限流、退避重试、分页、query-hash 缓存、XML/JSON 解析与论文去重。PMID 与 DOI 一律来自 PubMed 响应，模型不提供这些标识。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `tool` | 必填 | NCBI 工具标识 |
| `email` | 必填 | NCBI 联系邮箱 |
| `apiKeyEnv` | — | 存放 NCBI API key 的环境变量名 |
| `requestsPerSecond` | 派生：有 key 为 10，无 key 为 3 | 持续请求速率 |
| `maxRetries` | `2` | 首次失败后的重试次数 |
| `backoffBaseMs` | `1000` | 指数退避基数 |
| `timeoutMs` | `30000` | 单请求超时 |
| `retmax` | `20` | ESearch 页大小 |
| `efetchBatchSize` | `200` | EFetch 批大小 |
| `cacheTtlMs` | `3600000` | query-hash 缓存时长；`0` 关闭 |
| `defaultMaxResults` | `20` | 工具未给 `maxResults` 时的上限 |

`apiKeyEnv` 已设置但环境变量缺失会 fail-loud（`no API key for "…"`），不会静默降级为无认证速率。

## 模型影响

- `literature_plan_query` 返回已存储的 `ResearchQuery`，不发任何网络请求，因此用户确认前不会有请求到达 PubMed（FR-2）。
- `literature_search_pubmed` 返回 `{ ok, result: { query, papers, totalCount, warnings, partialReason? } }`；连接器失败返回 `{ ok: false, error: { code, retryable } }`，绝不返回空列表冒充成功。
- `literature_get_paper` 返回已存储论文或 `PAPER_NOT_FOUND`。
- 所有结果都是 JSON 文本块；论文携带连接器赋予的 `pmid`/`doi`。

## 已知限制与后续工作

- QueryPlan 由 Agent 产出，插件不调用 LLM（见 `docs/decisions/2026-09-08-phase2-literature-and-project.md`）。
- API key 仅从环境变量读取，尚未接入 credentials 服务。
- 缓存是进程内内存，不跨宿主进程共享。
- Europe PMC、Unpaywall、OpenAlex 解析器属 P1（SPEC §21），此处未实现。
- 每次检索都会持久化论文，尚无保留策略。
