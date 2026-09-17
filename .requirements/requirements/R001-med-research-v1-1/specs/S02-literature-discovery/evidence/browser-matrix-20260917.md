# S02 — Real-profile browser evidence (current build)

Revision: `62ca9fac796ef751a4b84dc949791e8e83e14494` (clean tree). Profile
`~/.dsh/profiles/med-research` reinstalled from source and served at
`http://127.0.0.1:3100/`; model `deepseek-v4.1-flash`; browser ego-browser
Chromium, viewport 1672×941, deviceScaleFactor 1, locale zh.

Per-spec hash binding (spec/test/contract bundle) is not recorded here: the specos
hashing tool is not installed in this workspace and the contract-bundle derivation
used by S01 cannot be reproduced for S02 from the manifest. This artifact therefore
follows S02's existing `artifacts:` convention rather than the run-binding schema.

## What the run proved (the retrieval pipeline is live)

Driving the Home `PubMed 检索` quick-entry opened the `研究` (S02 QueryPlan) tab, which
rendered a real plan editor: `检索计划 未确认`, `主 PubMed 检索式` / `宽 PubMed 检索式`
inputs, a research-question input, and `确认并检索`. Submitting a real PONV RCT query
(`postoperative nausea and vomiting[tiab] AND randomized controlled trial[pt]`)
advanced the plan `未确认 → 已确认` and dispatched the retrieval step. The failure
surface rendered correctly with `部分成功——有步骤失败`, `编辑检索式`, and a per-step `重试`.

Screenshot: `./screenshots/ui-research-partial-20260917.png`.

## Blocker on the success path (environment, not product code)

The retrieval step failed with:

> URL hostname "eutils.ncbi.nlm.nih.gov" resolves to a non-public IP address

On the host, `eutils.ncbi.nlm.nih.gov` resolves to `198.18.0.23` — within
`198.18.0.0/15`, the sandbox's DNS-interception/proxy range (curl reaches it and
returns HTTP 200 *through* the proxy). The product's SSRF guard classifies that range
as non-public and refuses the call, which is the guard behaving correctly. A genuine
public egress path (real NCBI resolves to public `165.112.x`) would pass the guard.

Consequence: the UI-RESEARCH **success path** — result cards, three-class counts,
Evidence selection, and `ANSWER_READY` — cannot be evidenced from this run environment
until PubMed retrieval egresses through public DNS.

## Matrix state coverage achieved by this run

`ui-acceptance.md` UI-RESEARCH requires extra captures for `plan edit / searching /
empty / partial / 失败`. This run legitimately captures the **partial / failure**
state (confirmed plan + failed retrieval step + retry affordance). `plan edit` (the
`编辑检索式` path) and `searching` are exercised by the same flow up to the network
boundary. The populated `empty`/success results remain blocked on egress.

## Limitations

- No real Evidence cards, counts, or ANSWER_READY were produced (network-blocked).
- No same-run prototype-vs-actual comparison for the success layout (nothing to compare).
- Host-side SSRF range behavior should be re-checked when running with real egress.
