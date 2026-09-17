# @medresearch/dsh-plugin-project

English | [中文](README.zh.md)

## Summary

Project lifecycle for the Med Research Workspace. Provides `ctx.medProjects`, registers `project_create` / `project_get` / `project_get_context` / `project_save_paper`, and — where a human-command registry is composed — the `/med-export` and `/med-import` backup commands (SPEC §15.2). Creating a project writes `<workspace>/.medresearch/project.json`, registers the directory as a DSH workspace, stores the project record, and binds the session to it (SPEC §41); the model sees project context only through tool results (SPEC §41). The service also exposes session-scoped Agent Mode selection and applies the corresponding tool allowlist to the live agent. Projects can be archived (read-only, kept in the roster's archive bin, rejected with `PROJECT_BUSY` while an analysis run is executing) and restored under the same identity; `selectProject` binds a session from the Web client and audits the switch; `overview` counts the five persisted domains (papers, evidence, datasets, analysis runs, published figure artifacts) one domain at a time, so a failing domain read reports `status: 'unavailable'` instead of zero, and `update` rejects a stale `expectedVersion` token with `PROJECT_VERSION_CONFLICT` and no partial write.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `workspaceRoot` | required | Absolute parent directory for project workspaces |

`workspaceRoot` has no universally correct value, so it is required and fails loud when absent.

## Patch snippet

```yaml
- name: '@medresearch/dsh-plugin-project'
  config:
    workspaceRoot: /path/to/med-workspaces
```

## Human commands

Where `@deepseek-ai/dsh-commands` is composed (the interactive Web profile), the plugin registers the backup path SPEC §15.2 requires:

| Command | Input | Behaviour |
|---|---|---|
| `/med-export <path>` | backup file path | Writes every declared domain and table to one JSON bundle (`medresearch.export`, envelope version 1). |
| `/med-import <path>` | backup file path | Validates the whole bundle — envelope, domain versions, table names, every record — then writes it. A bundle rejected in validation leaves storage untouched. |

Both write through `ctx.fs`, so the file policy applies. The path is the entire trimmed input, so a path containing spaces is one argument. Neither command reaches the model; the command registry logs `command/run` / `command/done`.

## Model Experience

- `project_create` returns the stored `Project` as JSON and binds it as the session's current project (SPEC §41).
- `project_get` returns the project, or `{ ok: false, error: { code: "PROJECT_NOT_FOUND" } }`.
- `project_get_context` returns the project and overview counters. An explicit `projectId` selects and binds it, appending a `project.select` audit row; omitting it, passing an empty string, or passing whitespace reuses the session's bound project, and with neither the result is `{ ok: false, error: { code: "PROJECT_NOT_BOUND" } }`.
- `project_save_paper` takes a server-produced `paperId`; it never accepts PMID/DOI metadata from the model.
- `medProjects.getMode` and `medProjects.setMode` read and change the session's `research`, `paper`, or `statistics` mode. A change is appended to `med_audit_logs` and, when the live agent registry is present, installs the mode's `ctx.tools.restrict()` allowlist.
- No project context is injected into a request except through these tool results.

## Known Limitations and Deferred Work

- `delete` removes only the record; the workspace directory and its registration stay. Destructive project deletion needs the approval policy layer (SPEC §40).
- The session→project binding lives in `med_session_project`; only `project_create` and an explicit `project_get_context` write it. The client can change Agent Mode through the session-header action, while project selection remains tool-driven (SPEC §41).
- `update` rewrites `project.json` but not the workspace title.
- Creating a project is not atomic: a failure after the file write can leave a directory and workspace registration without a record.
- `/med-import` puts every record the bundle carries; it does not merge or skip an existing key. A storage failure during the write phase can leave a partially imported store, because DSH domains offer no cross-domain transaction.
