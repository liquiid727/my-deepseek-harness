# S01 — Real model-chain smoke (current build)

Binds: Spec 2.1.3 / `d345dc9f36a876e36a6f9ba144863acb970094cd56fb9ad2f764a92a4f7107a6`;
Test Design 2.0.1 / `79af3b71ef5c7f5e18b3c62e63882a3f4dc56b9c6a53e99afdf918d324c5ca4a`;
contract bundle `6703ad878703a2a02f7ae73a07d64b087cfc4c34f8c8222a80d813ce8ee4f428`;
revision `62ca9fac796ef751a4b84dc949791e8e83e14494` (the consolidated commit of the
working tree this run executed against; content-identical to the pre-commit state).

## What ran

The med-research profile was reinstalled from current source and verified fresh
(`build:client` + `install-local-profile.mjs --force`); the installed
`dsh-plugin-medical-ui/lib/client.js` is byte-identical to the source build
(133783 bytes). The profile was then served at `http://127.0.0.1:3100/` and
driven with ego-browser.

- Command: `ego-browser` against `http://127.0.0.1:3100/`; one message submitted
  through the Session Chat composer, model `deepseek-v4.1-flash` (provider `ali`).
- Environment: Node v25.6.0; pnpm 11.7.0; macOS arm64; Chromium viewport 1492x748.
- Result: **PASS** — a real model round-trip completed with tool dispatch.

## Assertions

- Composer advertised `deepseek-v4.1-flash`; the reply streamed to completion with
  metrics `1 轮 · 3 步 | LLM 15.6s · 工具调用 0s | 首 token 平均 1.7s · 74 tok/s |
  缓存命中 66% | 输入 31.3K tok · 输出 770 tok` and `2 次工具调用`.
- The agent called the med-research context tools `project_get_context` and
  `project_get`; both returned (the session was unbound → `PROJECT_NOT_BOUND`).
- Grounding behavior held with a live model: the answer explicitly declined to
  present the content as project Evidence because no project/Evidence was bound,
  and offered `literature_plan_query` for a confirmable PubMed plan instead of
  fabricating a source.

## Answer (excerpt)

> 当前会话没有绑定任何项目（`project_get_context` 返回 `PROJECT_NOT_BOUND`），也没有
> 可检索的项目文献库，所以下面这条是通用医学术语知识，不是项目内 Evidence；若要作为可
> 引用的研究结论，需要先建立/绑定项目再检索验证。
>
> 一句话：PONV（postoperative nausea and vomiting，术后恶心呕吐）是麻醉和手术后…最常见的
> 不良反应之一。
>
> 结局类别：…患者报告的主观症状类结局（patient-reported outcome, PRO）…通常是"恶心＋呕吐
> （＋干呕）"的复合终点…不属于死亡、心梗、再入院等硬临床终点。

Screenshot: `./screenshots/model-chain-smoke-20260917.png`. The same chat answer is
also captured responsively at the three locked viewports:
`./screenshots/model-chain-chat-1672x941-20260917.png`,
`./screenshots/model-chain-chat-1440x900-20260917.png`,
`./screenshots/model-chain-chat-390x844-20260917.png`.

## Limitations

- Single-turn smoke: it proves the model chain and the no-fabrication guardrail on
  the current build; it does **not** exercise the PubMed retrieval → ANSWER_READY
  pipeline, a bound-project Evidence flow, or the five-prototype browser matrix.
- The `MISSING_CREDENTIAL`-blocked run `S01-home-composer-20260913` is superseded
  for the model-chain assertion only; full S01 QA remains open.
