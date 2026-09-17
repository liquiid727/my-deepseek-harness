# Implementation Evidence - S01 Project Workspace

- Entry: PRD R001
- Spec: SPEC-R001-S01 / current implementation checkpoint 2.1.3 / d345dc9f36a876e36a6f9ba144863acb970094cd56fb9ad2f764a92a4f7107a6
- Status: implemented against the current checkpoint; earlier 2.1.0 notes below are historical, and acceptance remains owned by review.md and acceptance.md
- Tested revision: current dirty worktree on branch `medical-workspace` (see git status below); no new commit was created

## Delivered behavior (rebuild per Spec 2.1.0, not the 1.0 evidence)

### SPEC-R001-S01-001 Persist and bind Project

- `ProjectsService` rejects duplicate normalized project names before any write (`PROJECT_DUPLICATE`), validates the whole input first, writes `project.json`, registers the workspace, stores the record, and appends the create audit row.
- `update` accepts an `expectedVersion` token (the caller's `updatedAt`); a stale token fails with `PROJECT_VERSION_CONFLICT` and no partial write. Archived projects reject mutations with `PROJECT_BUSY`.
- `archive` flips the record to read-only, keeps sessions/sources/run history, audits `project.archive`, and refuses while an analysis run is `running` (`PROJECT_BUSY`); `restore` reactivates the same identity and audits `project.restore`.
- New Remote methods on the `medProjects` namespace: `archive`, `restore`, `sessions`, `sessionProject`, `selectProject` (binds the session from the Web client and appends a `project.select` audit row). Project/session ids stay branded; the UI selection is the persisted binding, not client state.

### SPEC-R001-S01-002 Roster, sessions, and overview

- `overview` returns the five Spec domains — Papers, Evidence, Datasets, Analyses (all runs), Charts (published figure artifacts) — counted one domain at a time with an `updatedAt` timestamp. A failing domain read returns `{ status: 'unavailable' }`; the client renders unknown plus a retry for that domain and never collapses unknown to zero. An empty project renders zeros.
- The S01 home view (`med-home`, UI-HOME) renders: current-project strip (binding + status + archive/restore), hero, the single primary input (bound to the host composer draft), five quick entries, the five persisted counters, three capability cards, the local inspiration catalog (fills the input only, batch rotation), and project search / create / roster / archive bin with restore. Loading, empty, success, partial, and failure share one layout skeleton; failure keeps the create form and input.

### SPEC-R001-S01-003 Workbench shell navigation

- Generic DSH seams (no medical coupling): ui-sidebar declares the additive `sidebar.primary.action` list slot (owner shares `wide` only; entries own `id`/`order`/`label` and their navigation). While the strip has live entries the sidebar shell renders them as a distinct 56px icon rail LEFT OF the workspace browsing region (the prototype's two groups inside the host column, tracked reactively so an empty strip keeps the geometry unchanged); collapsed, the icon rows stack above the region's own rail column. ui-conversation exposes `UiConversation.openView(view, { sessionId?, focus? })` over a shared per-scope store instance (`sharePerScopeStore`) plus a public `viewSelection(sessionId)` reader; a blank session with an active feature View presents the View instead of the centered hero, so the composer docks and View content is never obscured.
- Med registers the brand seats (`sidebar.brand.mark`/`sidebar.brand.name`) and five primary-nav entries styled per the prototype (transparent rows, blue pill on the active entry's icon driven by the live View selection, hover/focus wash, disabled Skills with its localized reason): 首页 → `med-home`, 研究 → `med-research`, 文献库 → `med-papers`, 统计 → `med-statistics`, 技能 → disabled (S07 not in this deployment).
- The former monolithic Research view is now S02-only (query plan, PubMed search, save). Without a session project binding it renders a localized pointer to the home; it adopts the research question from the view-request focus, preserving user input.
- The early home implementation shared a draft across two input surfaces and sent the question to the Research view. This behavior is superseded by the [single resident composer verification](home-composer.md): one host editor in the hero, ordinary admission opens the current Session Chat. Earlier test and screenshot records below retain their original scope.

### SPEC-R001-S01-004 Mode, audit, recovery

- `medProjects.getMode`/`setMode`, the session-header mode action, real `ctx.tools.restrict()` allowlists, audit rows, and failure rollback are unchanged from the prior turn and still covered by tests.
- Backup/restore stays at the existing `/med-export` `/med-import` command seam; no new backup UI was added this turn (see Not run).

## Focused checks (commands actually run)

- `pnpm --dir plugins/med-research run typecheck` — PASS (host + client programs).
- `pnpm --dir plugins/med-research run test` — PASS: 48 files, 283 passed, 1 skipped, 0 failures. Coupled coverage added/updated: duplicate create, version conflict, archive/restore/busy, per-domain unavailable overview, sessions/select audit (plugin-project); home loading/empty/partial/failure states, project create+select, roster search, inspiration fills input only, Enter sends to research, S02 split guidance, nav entries wide/rail + disabled Skills (plugin-medical-ui).
- `pnpm --dir plugins/med-research run build:client` / `verify:client` — PASS (`client bundle ok`; runtime externals remain react/react-jsx-runtime only).
- `pnpm exec tsc -p packages/client/ui-layout|ui-sidebar|ui-conversation/tsconfig.json --noEmit` and root `tsc -p tsconfig.client.json --noEmit` — PASS.
- `pnpm exec vitest run ui-sidebar/tests ui-conversation/tests ui-layout/tests` — PASS (sidebar strip wide/rail + disposal, snapshots updated; conversation store sharing, `openView` seam positive/refusal, 470 conversation+layout tests).
- `pnpm run verify-translation-pairing --write .agents/notes/implemented/architecture/2026-09-13-workbench-shell-seams.md` — PASS (new bilingual Agent Note pair).

## Real-profile browser verification (UI-HOME)

- Launch: `pnpm dsh --profile med-research --port 3101` from the checkout (real profile, real services, sqlite storage at `plugins/med-research/.med-run/med.sqlite`). Worktree DSH client packages (ui-layout, ui-conversation, ui-sidebar) were built by `pnpm run dev:web` and their `lib/` synced into the profile `node_modules`, mirroring the existing med-ui sync flow; the same sync delivered the rebuilt `@medresearch` host packages and client bundle. Token URL: `http://127.0.0.1:3101/?token=…` (token exchanged for the session cookie).
- Scenario run in the browser (1672×941, DPR 1): created two projects through the home form (术后恶心研究, 住院时长队列); seeded the first through real Remote services — PubMed search + `medProjects/savePaper` (1 paper membership), `medDatasets/upload` (1 dataset), `medStatistics/plan` (1 planned run); switched to it; filled the research question. Overview counters in the UI equal the service (`1/0/1/1/0`).
- Keyboard: Enter in the primary input sends to the research view with the question preserved as focus; the five nav entries switch views on the live session (verified per view id); Skills is aria-disabled with its reason. Archive → archive bin → restore closes the loop in the UI.
- Locales: the settings language switch flips the whole shell (brand, nav, home, tiles, cards) between zh and en without re-registration; screenshots taken in both.
- 200% zoom: emulated via document zoom (IAB exposes no browser zoom); layout scales without breakage — recorded as a proxy, not native browser zoom.
- Reduced motion: verified at the stylesheet level (`@media (prefers-reduced-motion: reduce)` disables transitions/transform); runtime emulation was not available in the harness.
- Console: zero errors captured during the final interaction pass.
- Screenshots: `evidence/screenshots/` — `home-1672x941-final.png` (icon rail + active highlight + workspace list side by side), `home-1672x941-bottom.png` (composer clearance at scroll end), `home-1440x900.png`, `home-390x844-rail.png` (collapsed icon rail, no horizontal overflow), `home-1672x941-zoom200.png`, `home-1672x941-en.png`, `blank-session-rail.png`, `settings-language.png`. A mid-session stale-bundle pass (pre-rebuild dist mixed with post-revert ui-layout) produced clipped-sidebar captures; the tree was rebuilt from current source (`pnpm run dev:web`, 0 errors) and the final captures above are from that clean state.

## Not run / blocked / residual risk

- Evidence and Charts for the seeded project were not written: `medEvidence.save` requires a stored document/paragraph chain whose full-text ingest path is host-internal (not on the Remote surface), and a published chart requires an executed Runner run. Both remain 0 in the UI; the service-backed path is blocked, not mocked.
- The 390×844 host drawer behavior relies on the host sidebar auto-collapse (verified as the icon rail); a dedicated drawer overlay is host geometry, unchanged by S01.
- Independent QA/medical review, keyless session replay, and Gold Set evaluation remain outside this implementation turn (see test.md / acceptance.md; decision stays blocked there).
- Unrelated dirty files present before this task were left untouched; review.md and acceptance.md were not modified.

---

## 2026-09-14 delta (supersedes the navigation and Skills statements above)

The 2026-09-13 records above describe a five-view deployment whose Skills entry was disabled. Both statements are now stale: S07 is implemented in this worktree, so the entry navigates, and three further views are registered. The earlier screenshots were captured **before** this delta and therefore no longer represent the current build; they are retained as history, not as current evidence.

### Navigation and view surface

- Registered conversation views are now eight: `med-home`, `med-research`, `med-papers`, `med-evidence`, `med-statistics`, `med-knowledge`, `med-skills`, `med-writing`.
- All five `sidebar.primary.action` entries navigate; the Skills entry is no longer `aria-disabled`, and `nav.skillsUnavailable` is no longer rendered.
- The two client tests that pinned the old five-view/disabled-Skills surface were updated to the current contract, with the reason recorded in the test bodies.

### Shared contribution seams added this round

- S03 provides `medReaderActions` and declares the six required Reader action ids; S04 contributes `reader.save-evidence`, `reader.reference-chase`, `reader.open-source`, `reader.copy-citation`; S03 contributes `reader.save-note`, `reader.translate-selection`.
- S06 provides `medDraftEditorActions` and declares the four required Draft-editor ids; S08 contributes `draft.generate`, `draft.translate`, `draft.validate`, `draft.export`.
- The real composition asserts both registries report `missing() === []`, so a profile that loses a required contribution fails the check instead of rendering a dead control.

### Checks executed in this delta

```
cd plugins/med-research
pnpm exec vitest run
  → Test Files 59 passed (59) / Tests 424 passed | 1 skipped (425)
pnpm run typecheck
  → tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit (exit 0)
pnpm run verify:client
  → client bundle ok (131386 bytes; externals react, react/jsx-runtime,
    react-dom, react-dom/client, @deepseek-ai/cordis,
    @deepseek-ai/dsh-client-ui-primitives)
node scripts/install-local-profile.mjs --print-only --json
  → composed profile lists all 20 @medresearch packages plus the three bundles
    (dsh-base, dsh-web-app, dsh-bundle-medical); writes nothing to the harness home
```

### Still not re-verified

- Browser evidence for the eight-view surface, the enabled Skills entry, the Reader/Evidence/Knowledge/Writing views, and the two new registries at 1672×941 / 1440×900 / 390×844. The delta is component- and composition-verified only.
- `pnpm dsh --profile med-research` was not re-run in this delta: `DEEPSEEK_API_KEY` is absent from the environment and from a root `.env`, so a real profile task cannot complete. The profile composition was validated in `--print-only` mode instead.

## 2026-09-17 implementation checkpoint (Spec 2.1.3)

This checkpoint is bound to Spec SHA-256 `d345dc9f36a876e36a6f9ba144863acb970094cd56fb9ad2f764a92a4f7107a6`, Test Design SHA-256 `79af3b71ef5c7f5e18b3c62e63882a3f4dc56b9c6a53e99afdf918d324c5ca4a`, and contract bundle SHA-256 `6703ad878703a2a02f7ae73a07d64b087cfc4c34f8c8222a80d813ce8ee4f428`.

### Changed files

- `plugins/med-research/packages/plugin-project/src/tools.ts`: explicit `project_get_context(projectId)` now uses the audited `selectProject` seam, so its session rebind records `project.select` as required by SPEC-R001-S01-001.
- `plugins/med-research/packages/plugin-project/tests/tools.spec.ts`: asserts the explicit context-selection audit sequence.
- `packages/client/ui-primitives/src/TabList.module.css`: uses the repository's 0.5px neutral hairline for the new tab-list divider.

### Coupled tests and checks

- Project service/Remote/tool tests: 5 files, 34 passed.
- Medical UI tests: 4 files, 31 passed.
- Plugin suite excluding `packages/medical-e2e/tests/composition.spec.ts`: 58 files, 420 passed, 1 skipped.
- `pnpm run typecheck`: PASS.
- `pnpm run verify:client`: PASS; bundle verification reported 131453 bytes with the expected runtime externals.
- TabList and neutral-border gate: 2 files, 11 passed.
- Shared client package TypeScript checks for ui-sidebar, ui-conversation, ui-primitives, and ui-theme: PASS.

### Limitations and residual risks

- The first 2026-09-17 full-suite attempt could not collect the composition test because the installed `fs-ext` binary targeted NODE_MODULE_VERSION 127. Running `pnpm rebuild fs-ext` rebuilt it for Node v25.6.0 / NODE_MODULE_VERSION 141; the subsequent full suite passed, so the local environment blocker is resolved. Fresh installs must still run native dependency install scripts.
- The full shared client test command was not accepted as green: the pre-existing design-platform test still omits `--dsw-specific-input-major`, and the lazy grammar test timed out under the current concurrent run. These failures are outside the three changed behavior assertions above and remain for review.
- No new browser run, keyless session replay, independent QA, medical review, Gold Set evaluation, or backup/import end-to-end run was performed. Existing browser records and the acceptance decision remain unchanged.

### Native dependency remediation

- `pnpm rebuild fs-ext` — PASS; `fs-ext@2.1.1` compiled with node-gyp for Node v25.6.0 on macOS arm64.
- `pnpm exec vitest run packages/medical-e2e/tests/composition.spec.ts` — PASS: 1 file, 7 tests.
- `pnpm exec vitest run packages/medical-e2e/tests/install-profile.spec.ts packages/medical-e2e/tests/remote-roundtrip.spec.ts` — PASS: 2 files, 5 tests.
- `pnpm exec vitest run packages/session/session-persistence-jsonl/tests/lease.spec.ts` — PASS: 1 file, 19 tests.
- `pnpm exec vitest run` — PASS: 59 files, 427 passed, 1 skipped, 428 total.

### Deviations and intentionally untouched surfaces

- No deviation from Spec 2.1.3 was identified in the implemented project-context path.
- `review.md`, `acceptance.md`, S02-S08 records, unrelated dirty source changes, and release/commit state were intentionally untouched.
