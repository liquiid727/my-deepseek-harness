# @medresearch/dsh-plugin-medical-ui

English | [中文](README.zh.md)

## Summary

Med Research client UI. It ships the view state machines (SPEC §43–§45), the zh/en dictionaries (AGENTS.md §2.7), the typed Remote data layer (SPEC §30), and the browser registrations: a blank-session Research launch action, four `conversation.view` views, a session-header Agent Mode action, keyed `tool.call.toolview` cards, and a `settings.section` page.

## Scope

- `src/state/research.ts` — Research view states and transitions; any stage falls to `ERROR_PARTIAL`.
- `src/state/statistics.ts` — Statistics states; `WAITING_APPROVAL` blocks execution.
- `src/state/evidence.ts` — derives the SPEC §44 display state from stored evidence.
- `src/i18n/{en,zh}.ts` — flat dotted dictionaries; `zh` must match the `en` key set exactly.
- `src/client/remote.ts` — `createMedRemote(caller)` turns `ctx.connection.rpc` into typed per-service calls and raises `MedRemoteError` on the host error envelope. Views depend on this interface, never on the wire.
- `src/client/views.tsx` — the four views; each reads through `createMedRemote` and shows its state machine's dictionary label. The Papers view decodes a citation focus and highlights the cited span.
- `src/client/focus.ts` — the Papers-view focus identity (`paperId|documentId|paragraphId|start|end`) the Evidence view encodes and the Papers view decodes.
- `src/client/artifact-download.ts` — the authenticated download URL for an exported artifact (SPEC §30).
- `src/client/tool-names.ts` — the `med` Tool name list (SPEC §6), shared by the card registrations and the host composition test.
- `src/client/toolview.tsx` — one card for every `med` Tool name.
- `src/client/settings.tsx` — the settings page; deployment configuration is stated, never read back.
- `src/client/index.tsx` — the plugin entry: dictionaries, view/card/settings registrations, each owned by `ctx.effect`.
- `src/client/hero-action.tsx` — the blank-session entry point that opens the S01 project workspace without a model turn.
- `src/client/mode-action.tsx` — the localized session-header selector that reads and changes the active Agent Mode through `medProjects` Remote methods.

## Build

The browser half is bundled by this package's own tsdown config (DSH publishes no client preset):

```sh
pnpm run build:client    # packages/plugin-medical-ui/lib/client.js
pnpm run verify:client   # rebuild + check the module-loader artifact contract
```

The host half stays source-plane (`main: src/index.ts`) and is loaded by the harness through tsx.

## Model Experience

Nothing: the client half registers no tool, prompt, or session event.

## Known Limitations and Deferred Work

- **Right-pane seats are not implemented**: `@deepseek-ai/dsh-client-ui-sidebar-right` and its `dsh-client-ui-dockkit` dependency are not published to npm, so an out-of-tree client plugin cannot declare `sidebar.right.pane.tab`. Citations open the Papers view through the `med-papers` focus contract instead; see `docs/decisions/2026-09-08-citation-focus.md`.
- **Views are focus-driven, not list-driven**: the published Remote surface has no list reads for project papers, per-project evidence, datasets, analysis runs, or document paragraphs. Reading a whole paper therefore needs a paragraph-list method; locating one cited span does not. The Home view lists projects and reads the persisted project overview counters.
- **`shell.overlay` is not contributed**: no long-running client task reports progress yet.
- The client surface calls generated-free SRC endpoints through `ctx.connection.rpc`; moving to generated `ctx.remote` descriptors is deferred with the Typert artifact build.
- Browser-visible verification of the citation highlight is deferred to a real Research-chain run; the component test covers the focus encoding, highlight, and scroll.
