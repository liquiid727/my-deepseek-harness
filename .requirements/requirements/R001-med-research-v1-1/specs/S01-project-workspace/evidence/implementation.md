# Implementation Evidence - S01 Project Workspace

- Entry: PRD R001
- Spec: SPEC-R001-S01 / 1.0.0 / 69daeb672981809873e7d047cae2bc05460e611a5dda500ba9b91308de1f4591
- Status: implemented; acceptance remains owned by review.md and acceptance.md
- Tested revision: `2c2fa8b998da49a0899cef3e97768d635cdd997f` plus the uncommitted S01 worktree changes

## Delivered behavior

- `ProjectsService.create` validates the complete input before allocating project state, writes `project.json`, registers the workspace, stores the record, binds the session through the existing project tools, and appends the create audit row.
- `ProjectsService.update` validates the resulting project before storage or file mutation; `overview` returns persisted counts for questions, papers, evidence, datasets, analyses, and charts.
- `medProjects.getMode` / `setMode` validate session mode, persist the last selection through `mode.change` audit rows, and apply the corresponding actual tool-name allowlist through the live agent's `ctx.tools.restrict()` scope. Agent creation restores the latest audited mode and disposal releases the restriction.
- The Research Home view is session-scoped, lists real projects, creates a project through Remote, loads overview counters, exposes Papers/Evidence/Statistics capability entries, and covers loading, empty, success, failure, and retry states. The session-header action reads and changes Agent Mode through the typed Remote client with localized labels.
- The blank-session Hero now exposes a localized “Open research workspace” action. It selects the Research Home before any model message, so an installed Med Research plugin has a visible S01 starting point instead of relying on hidden post-message view tabs.
- English and Chinese dictionaries, Remote consumers, plugin composition, and the project/e2e service surface were updated together. The mode decision is recorded in `plugins/med-research/docs/decisions/2026-09-11-project-workspace-mode.md`.

## Focused checks

- `pnpm --dir plugins/med-research typecheck` — PASS (`tsconfig.json` and `tsconfig.client.json`).
- `pnpm --dir plugins/med-research test` — PASS: 48 files, 265 passed, 1 skipped, 266 total.
- `pnpm --dir plugins/med-research build:client` — PASS: client bundle emitted.
- `pnpm --dir plugins/med-research verify:client` — PASS: `client bundle ok`.
- `pnpm run verify-translation-pairing plugins/med-research/packages/medical-contracts/README.md plugins/med-research/packages/plugin-medical-ui/README.md plugins/med-research/packages/plugin-project/README.md` — PASS: all three touched README pairs are consistent.

The coupled tests cover project input rejection without writes, service persistence and overview counts, mode allowlist/replacement/audit restoration, Remote method calls, Home states, session scoping, mode-action interaction, and browser plugin slot disposal.

## Not run / residual risk

- The required real-profile browser journey, desktop/narrow screenshots, console trace, and live model/session snapshot were not run in this implementation turn; no browser evidence is claimed here.
- A clean profile browser run rendered the localized blank-session Hero, transitioned to Research Home, created `S01 Browser Verification`, and showed zeroed overview counts. The same flow was inspected at desktop 1492x748 and narrow 390x844. The earlier reused-process attempt remains recorded as blocked; the clean rerun is the current pass.
- `pnpm run test:docs` — FAIL at repository scope on pre-existing unrelated README/frontmatter and locale-link violations (`packages/workbench/**`, `plugins/med-research/README.md`, `python/AGENTS.zh.md`); the touched README pairs pass the scoped pairing check above.
- Current implementation rerun on 2026-09-12: `pnpm --dir plugins/med-research typecheck` PASS; `pnpm --dir plugins/med-research test` PASS (48 files, 265 passed, 1 skipped); `pnpm --dir plugins/med-research build:client` PASS; `pnpm --dir plugins/med-research verify:client` PASS.
- Fresh-profile browser attempt on 2026-09-12 used `dsh --profile med-research --port 3100` and the printed token URL. The blank-session Hero rendered the localized `打开研究工作区` action and retained the composer; activating it reached the Research Home shell but opened the first-run API Key dialog before Project creation or layout clearance could be exercised. Screenshot artifact: `/var/folders/fl/g6qx65fs3z793ldbtl78csgm0000gn/T/ego-browser-shot-75678-1.png`. Result: launch-path observed; full real-profile flow BLOCKED by missing credentials.
- Follow-up without credentials dismissed the dialog via `稍后配置`; the shell remained usable for UI inspection. Root Hero launch did not activate the requested view, so `ui-conversation` now schedules a post-binding view restoration after `startSession()`. Typecheck and the package test suite passed after this fix. Full browser layout evidence remains pending.
- No S02-S05 or R002 behavior was added. The existing right-pane dependency limitation and focus-driven paper view remain unchanged.
- The repository had unrelated dirty files before this task; they were left untouched. `review.md` and `acceptance.md` were not modified.
