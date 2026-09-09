# Patch-layer install and verification

## Layers

```
harness bundles          shipped cordis.patch.yml per bundle, applied first
profile patch            $DSH_HOME/profiles/<name>/cordis.patch.yml
home patch               $DSH_HOME/cordis.patch.yml, outranks the profile file
```

A profile lives at `$DSH_HOME/profiles/<name>` and combines installable bundles, its own `cordis.patch.yml`, and a `patchReload: live | startup` policy. `dsh plugin` creates custom profiles; a missing bundle or one without a patch declaration fails startup loudly ([app-boot profiles](../../../../packages/boot/app-boot/README.md#profiles)).

## Patch semantics

- An id-targeted patch **replaces the whole `config` of the matched row**; it does not deep-merge. Restate every field you keep.
- `insert` adds new rows. Inserted plugin names may be package specifiers, absolute paths, or file URLs; patch-relative `./` and `../` paths are converted to file URLs inside `insert` rows and nested groups.
- A patch naming an entry that does not exist prints a stderr warning and boot continues.
- An empty or comments-only patch file fails boot. Disable the layer with `[]`.
- `!!js` expressions are allowed in `config` values and in an entry's `disabled`.
- On a live-reload profile, editing a user patch file recomposes without a restart; a rejected edit leaves the last good app running.

## Install

```sh
# published package
dsh plugin --profile web add @scope/<name>
# local checkout, before publishing
dsh plugin --profile web add file:/abs/path/to/packages/<name>
```

Then edit `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
# select the provider the seam reads
- id: web
  config:
    searchProvider: tavily
# optionally stop loading the shipped provider
- id: web-search-deepseek
  disabled: true
# insert the out-of-tree provider
- insert:
    - id: web-search-tavily
      name: '@scope/web-search-tavily'
      config:
        apiKeyEnv: TAVILY_API_KEY
```

## Verify

```sh
dsh --profile web --dump-config              # composed tree; check the row and the selected provider
dsh --profile web --dump-default-config      # bundle layer only, for comparison
dsh --profile web "exercise the capability"  # end-to-end run
```

- Confirm the harness checkout is still clean: `git status` in the harness repository.
- Confirm `git pull --rebase` succeeds without conflicts.
- For a `file:` dependency, remember pnpm copies the directory: after rebuilding, re-run the add or the project's sync script, because the installed copy does not track source edits.
- A live-reload profile applies a patch edit without restarting; verify the composed tree again after the edit.

## Settings-card namespace caveat

Client settings cards and the settings proxy whitelist are keyed by settings namespace, and shipped cards hardcode the namespace of the provider they were written for. An out-of-tree provider with a new namespace therefore renders no card. Options:

| Option | Cost |
| --- | --- |
| Reuse the shipped provider's settings namespace | The card works with zero harness changes; the namespace name no longer matches the package, so record it in the README |
| Propose generalizing the card or whitelist upstream | Correct long term, but needs upstream review |
| Accept no card | Configuration is edited through `cordis.patch.yml` or environment variables only |

Do not edit the client card or the proxy whitelist to force a card; that reintroduces the harness conflict the out-of-tree layout exists to avoid.
