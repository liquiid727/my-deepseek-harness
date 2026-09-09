# @medresearch/dsh-bundle-medical

English | [中文](README.zh.md)

## Summary

The Med Research Workspace bundle layer (SPEC §4.1, §15.1): a data-only patch that inserts the SQLite backend, the isolated runner, the eight host plugins, and the `med-ui` client row. A patch replaces a matched row's whole config, so every row restates its own config — and this bundle deliberately ships no config, because `workspaceRoot`, the NCBI `tool`/`email`, and `artifactRoot` are deployment values supplied by the profile's user patch layer (a missing required field fails loud at load).

The domain facility is the base bundle's `storage-domain` row, not a second row here: a second `dsh-storage-domain` row provides its facility inside its own fiber scope, so sibling med plugins would silently keep the base JSON medium. The profile must therefore route the base row to the SQLite backend this bundle registers.

## Required profile config

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

`allowlist` is the deployment's package policy for generated analysis code (SPEC §36, PRD §34). It permits imports; the runner environment must also have the packages installed, otherwise the run fails loudly at import time.

## Model Experience

Nothing directly; the bundle only composes plugins.

## Known Limitations and Deferred Work

- `dsh plugin --profile med-research add @medresearch/dsh-bundle-medical` is not yet exercised; the profile install is a phase-8 E2E step.
