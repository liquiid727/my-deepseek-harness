# Capability seam roles

A capability seam is a Service Definition plus at least one Service Provider plus at least one Consumer ([glossary](../../../../docs/glossary.md#capability-seam)). An out-of-tree package fills a Provider or Consumer role; the harness owns the Definition.

## What an out-of-tree package may and may not own

| May | May not |
| --- | --- |
| Implement a published provider interface and register it into the harness registry | Declare `ctx.<key>`, add service methods, or extend the `Context` type map |
| Hook a published event or waterfall to observe or rewrite data | Replace a harness package or patch its source |
| Add its own tool, skill, or system-prompt section through the published registration points | Pick itself as the active provider, or hardcode a competing provider's id |
| Ship its own `Config` and settings section | Store secrets in the plugin's config file |

Registration is an effect: every contribution goes through `ctx.effect()` or `ctx.on()`, and the registry's `register()` returns the disposer that `apply` returns ([AGENTS.md](../../../../AGENTS.md)).

## Provider

A Provider implements the interface the Service Definition publishes and registers into the Definition's registry.

- Read the Definition package README and `src/index.ts` for the interface, the registry method, and the request/result types before writing code.
- Example: `@dsh-plugins/web-search-tavily` implements `WebSearchProvider` (`id`, `available()`, `search()`) and registers with `ctx.web.registerSearchProvider(...)` under `inject: ['web']`. It does not own `ctx.web`; adding it is purely additive.
- The provider reports only what it observed. Truncation, timeouts, and cancellation stay the seam's responsibility unless the interface assigns them to the provider.

## Consumer

A Consumer observes or rewrites data on a published extension point without owning the capability.

- Example: `@dsh-plugins/vision-bridge` hooks the `llm/stream` waterfall, rewrites image attachments into prompt text for a non-vision model, and adds a `describe_image` tool. It delegates with `next()` and short-circuits only when it actually substitutes data.
- A waterfall listener that returns without calling `next()` stops the chain for every later listener ([waterfall semantics](../../../../docs/cordis-primer.md#cordis-waterfall-semantics)). Call `next()` unless you are deliberately replacing the result.
- Keep the transform pure and shared: the same function should serve the Node path, the browser path, and the tests.

## Registry provider

A registry provider contributes entries into a harness-owned registry rather than implementing one interface.

- Example: `@dsh-plugins/skill-external-roots` registers a `SkillProvider` (`{ name, list(), get() }`) into `ctx.skills` through the `registerProvider` factory so skills from other agent tools appear in the catalog. See [docs/subsystems/skills.md](../../../../docs/subsystems/skills.md) for the provider contract, lookup options, and the cancellation signal.
- Provider names must be unique within a registry layer; a duplicate name is a configuration error, not a silent override.

## Finding the seam

1. Name the capability the plugin extends (search, skills, sessions, tools, model streaming).
2. Read that capability's Service Definition README and source for the registry method and the provider interface.
3. Read the shipped Consumer for the same capability to see how it consumes results and which fields it expects.
4. Decide the role. If the capability exposes no seam for what you need, that is a harness design discussion; do not patch the checkout.

## Anti-patterns

- **Fork-and-patch.** Changing shipped `cordis.patch.yml` files, deleting competing providers, or editing client settings cards to force a new provider. Use the profile patch layer instead ([patch-layer-install.md](patch-layer-install.md)).
- **Service invention.** Adding a new `ctx.*` service from an out-of-tree package. Consumers of that service would not exist in other deployments.
- **Hidden selection.** Choosing a provider through priority, environment sniffing, or a fallback chain. Selection is an explicit `Config` value.
