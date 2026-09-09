# Package and config standard

## Layout

```
packages/<name>/
├── src/index.ts        plugin entry: named exports name / inject / Config / apply, settings section registration
├── src/provider.ts     the capability implementation
├── src/types.ts        wire types only, no runtime code
├── src/invariant.ts    runtime invariant companion, or absent with a README reason
├── tests/              unit, real-HTTP, settings, and e2e specs
├── README.md           English
├── README.zh.md        Chinese
├── README.i18n.yaml    bilingual pairing record
├── tsconfig.json       extends the repository base config, rootDir src, outDir lib
└── package.json        @scope/<name>, exports including ./src/*
```

A shared pure module (for example `src/fragment.ts` or `src/transform.ts`) holds the mapping between wire data and presentation data so Node, browser, and tests run the same code.

## Export form

- Named exports only: `name`, `inject`, `Config`, `apply`. **No default export.** A mixed default plus namespace makes the loader drop the function plugin's namespace.
- Declare dependencies on harness services in `inject`; reach optional ones with `ctx.get(name)` rather than the `ctx.<name>` property proxy.
- `apply(ctx, config)` returns the disposer from the registration it made, so disposal removes the contribution.

## Config

- Every field is optional. `apply` resolves the effective options once, explicitly, and passes the resolved value to the provider.
- Deployment-varying values are `Config` fields, never constants in the request path. A hidden `?? default` inside a request is a defect.
- Validate at the earliest resolvable point and fail loud with the offending key named. Never silently skip a missing referent.
- Secret fields: `z.string().role('secret')`. Credential references: `z.string().role('credential-ref')`. The settings layer uses these roles to mask and redact values.

## Settings

- Register a settings section through the settings capability so the deployment can edit options without restarting the process.
- Project the current section into options per operation through a source thunk: an edit changes what the next request reads, with no provider re-registration.
- Snapshot the options once per operation. Reading the live section several times mid-request can mix two configurations.
- See [docs/cookbook/adding-a-settings-card.md](../../../../docs/cookbook/adding-a-settings-card.md) for the registration and card flow.

## Credentials

- Resolve through the credentials service with an environment-variable fallback: an `apiKeyEnv` field naming the variable, then the credentials service, then a literal key as last resort.
- A literal key never belongs in a config file committed to the repository.
- A missing credential names what was missing: `no API key for "TAVILY_API_KEY"`.

## Dependencies

- `peerDependencies` reference published harness packages (`@deepseek-ai/dsh-web`, `@deepseek-ai/dsh-credentials`, …) on the current released line, plus `@deepseek-ai/cordis`.
- Never use `workspace:^` or a relative link to a harness package: those are harness-monorepo-internal protocols that do not resolve outside the checkout.
- Keep the dependency set minimal; the plugin runs inside a host that already provides the capability packages it peers on.

## Invariants

The two repositories differ, and the host repository's rule wins:

- In this repository, publish `./invariant` only when independent observations of an owned relationship can diverge; otherwise omit the source and wiring and give the package-specific README reason ([packages/AGENTS.md](../../../../packages/AGENTS.md)).
- The out-of-tree `dsh-plugins` convention keeps the companion in every package and registers the manifest name, allowing a package-specific `No runtime invariant:` reason when no relationship is owned.

Either way, an empty installer or a check of service presence, plugin metadata, or fixed examples is not an invariant.
