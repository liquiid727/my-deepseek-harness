---
name: mydsh-plugin-repo-standard
description: Use when building, reviewing, or maintaining an out-of-tree DeepSeek Harness plugin repository — separate npm packages that add capability-seam providers or consumers to dsh without modifying the harness checkout. Covers seam role selection, package layout and export form, Config/settings/credential rules, security rules for credentialed requests, the test matrix, README and development-record obligations, and installation plus verification through the profile patch layer.
---

# Out-of-tree DSH plugin standard

An out-of-tree plugin repository ships one or more npm packages that a `dsh` profile installs with `dsh plugin --profile <name> add <package>`. The harness checkout stays read-only: behavior arrives through the package plus the profile's user patch layer. This skill owns the standards such a repository must meet; [mydsh-plugin-developer](../mydsh-plugin-developer/SKILL.md) owns the 0-to-1 authoring workflow (scaffold, dual-end build, browser tool views, worked examples).

Distilled from `Yoahoug/dsh-plugins` (`AGENTS.md` and `docs/`, commit `5a2598b8`) and checked against this repository's [AGENTS.md](../../../AGENTS.md), [packages/AGENTS.md](../../../packages/AGENTS.md), [docs/architecture.md](../../../docs/architecture.md), and [docs/cordis-primer.md](../../../docs/cordis-primer.md).

## Non-negotiables

1. **The harness checkout stays clean.** Never edit harness source, shipped `cordis.patch.yml` files, lockfiles, or client settings cards to make a plugin work. A `git pull --rebase` must always succeed without conflicts.
2. **Write a Provider or a Consumer, never a Service Definition.** An out-of-tree plugin registers into a service the harness already owns (`ctx.web.registerSearchProvider`, `ctx.skills.registerProvider`) or hooks an existing event. It does not declare `ctx.<key>`, add service methods, or extend `Context` types.
3. **Activation is configuration, not code.** The plugin never self-activates and never picks a default competitor. Which provider is live is pinned by a `Config` field such as `searchProvider`, and the profile patch layer selects it.
4. **No hidden defaults.** Every deployment-varying choice is a validated `Config` field; defaults are applied by an explicit resolve step in `apply`, never by a `?? default` buried in a request path.
5. **Evidence per surface.** A change is done when each affected surface has its own evidence: unit tests for pure mapping, a real server for redirect rejection, a settings round-trip for settings, an e2e run for the live API, and a composed-config dump for the patch layer.

## 1. Pick the seam role

Read the harness capability the plugin extends, then decide which role it plays. Details and worked examples: [references/capability-seam-roles.md](references/capability-seam-roles.md).

| Role | What the package does | Example |
| --- | --- | --- |
| Service Provider | Implements an interface the harness defines and registers it into the harness registry | Tavily search provider for `ctx.web` |
| Consumer | Observes or rewrites an existing event or tool result without owning the capability | Image-to-text bridge on the `llm/stream` waterfall |

A plugin may play both roles across different capabilities, but each role stays inside the interface the harness publishes. If the capability you need has no seam, that is a harness design question, not a reason to patch the checkout.

## 2. Package layout and export form

Layout, file responsibilities, and the invariant divergence between this repository and out-of-tree repositories: [references/package-and-config-standard.md](references/package-and-config-standard.md).

- `src/index.ts` exports the plugin as named exports only — `name`, `inject`, `Config`, `apply` — with **no default export**; a mixed namespace makes the loader drop the function plugin.
- Reach optional services with `ctx.get(name)`, not the `ctx.<name>` property proxy.
- `src/types.ts` holds wire types with no runtime code; pure mapping functions live in their own module so Node, browser, and tests share one implementation.
- Depend on published `@deepseek-ai/*` npm packages through `peerDependencies`. Never use `workspace:^`, which is a harness-monorepo-internal protocol.

## 3. Config, settings, credentials

- `Config` fields are optional; `apply` resolves them explicitly and fails loud on an invalid value at the earliest resolvable point.
- Mark secret fields `z.string().role('secret')` and credential references `z.string().role('credential-ref')` so the settings layer masks them.
- Resolve credentials through the credentials service with an environment-variable fallback (`apiKeyEnv` first). A literal key is a last resort and never lands in a config file.
- A missing credential must name the reference it could not resolve, for example `no API key for "TAVILY_API_KEY"`.
- Register a settings section through the settings capability and project the current section into options per operation, so an edit takes effect without re-registering the provider. See [docs/cookbook/adding-a-settings-card.md](../../../docs/cookbook/adding-a-settings-card.md).

## 4. Security rules for credentialed requests

- Any request carrying a credential uses `redirect: 'error'`; following a cross-origin redirect would forward the credential.
- Classify failures with the codes the host seam defines (for the web seam, `WEB_PROVIDER_ERROR` for provider failure and `WEB_ABORTED` for cancellation) instead of inventing new ones.
- Do not mount a capability that lacks SSRF protection by default; ship it disabled and let the deployment opt in.
- Prove the redirect rule against a real HTTP server; a mocked fetch cannot observe it.

## 5. Tests

Test the behavior at the surface it ships on. The matrix, plus what each row must prove, is in [references/test-and-doc-standard.md](references/test-and-doc-standard.md).

| Surface | Required evidence |
| --- | --- |
| Pure mapping and request shaping | Unit tests covering valid input, malformed input, and empty results |
| Credential resolution | Unit tests for the env fallback, the service path, and the missing-credential message |
| Redirect refusal | A real local HTTP server that answers with a cross-origin `Location` |
| Settings | Section read/write plus a registration that disposes cleanly |
| Live provider | An e2e test that self-skips when the API key is absent |
| Patch layer | A composed-config dump showing the plugin's row and the selected provider |

A behavior change updates its tests in the same change. Tests describe behavior, not correctness.

## 6. Docs and development records

- Write the development record under `docs/` before implementing, and keep it current with what shipped: the investigation, the seam, the deployment patch, and the verified result.
- Register every plugin in the repository's root `README.md` table (capability, role, one-line description, doc link). An unregistered plugin is incomplete.
- Each package README is bilingual (`README.md`, `README.zh.md`, `README.i18n.yaml`) and carries a Config table, a paste-ready patch snippet, a **Model Experience** section (model, token, and KV-cache effect), and a **Known Limitations and Deferred Work** section.
- Record non-obvious constraints — a reused settings namespace, a required deployment precondition — in the README rather than only in a commit message.

## 7. Install and verify

Profile, bundle, and patch-layer mechanics, patch semantics, and the verification sequence: [references/patch-layer-install.md](references/patch-layer-install.md).

```sh
dsh plugin --profile web add file:/abs/path/to/packages/<name>   # or the published package name
# edit ~/.dsh/profiles/web/cordis.patch.yml: select the provider and insert the plugin row
dsh --profile web --dump-config                                  # confirm the composed tree
dsh --profile web "exercise the new capability"                   # end-to-end run
```

A user patch replaces the matched row's whole `config` instead of merging, so restate the fields you keep. The profile file applies after every bundle layer; the home-level `$DSH_HOME/cordis.patch.yml` outranks the profile file. A patch naming a missing entry warns on stderr; an empty or comments-only file fails boot, so disable the layer with `[]`. Live-reload profiles apply a valid edit without a restart and keep the last good tree after a rejected one.

## Pre-commit checklist

- Harness checkout unchanged (`git status` clean in the harness repository).
- Named exports only; `Config` validated; defaults resolved explicitly.
- Credential path uses the credentials service with a named env fallback; no secret in a config file.
- `redirect: 'error'` on credentialed requests, proven by a real-server test.
- Unit, settings, redirect, and e2e tests present and passing; e2e self-skips without a key.
- Bilingual README with Model Experience, Known Limitations and Deferred Work, Config table, and patch snippet.
- `docs/` development record written and current; root README plugin table updated.
- `dsh --profile <name> --dump-config` shows the plugin row and the selected provider.

## References

- [references/capability-seam-roles.md](references/capability-seam-roles.md) — the three roles, what an out-of-tree package may own, and worked examples.
- [references/package-and-config-standard.md](references/package-and-config-standard.md) — package layout, export form, Config/settings/credentials, dependency rules.
- [references/test-and-doc-standard.md](references/test-and-doc-standard.md) — test matrix, README contract, development-record obligation.
- [references/patch-layer-install.md](references/patch-layer-install.md) — profile composition, patch semantics, install and verification steps.
- [mydsh-plugin-developer](../mydsh-plugin-developer/SKILL.md) — authoring workflow and runnable examples.
- [mydsh-development-practices](../mydsh-development-practices/SKILL.md) — evidence, decision records, and honest reporting for non-trivial changes.
