# Agent Note: Additive workbench navigation for product plugins

Status: proposed

English | [中文](2026-09-12-additive-workbench-navigation.zh.md)

## Problem

The DSH sidebar owns one collapsible column and exposes brand, Workspace, footer, and Settings slots. A product plugin can add conversation views but cannot place primary product navigation beside the Workspace browser without replacing a single-owner slot. Med Research needs stable Home, Research, Library, Statistics, and Skills navigation while preserving the DSH shell, Session composer, Workspace browser, Settings, and other client extensions. Its Paper Reader also needs the existing right-pane client types to be consumable from an out-of-tree package.

## Proposal

The sidebar package declares a root-scoped additive `sidebar.primary.action` list slot and renders it between the New Session control and the Workspace browser. Each entry registers `id`, `order`, and localized `label`; the owner passes only `wide`, so the sidebar keeps geometry and the registrant owns its button, active state, and navigation action. With no entries, the existing sidebar tree and geometry are unchanged.

The right-pane package exposes its client SlotMap merge and registrant types through a published or profile-consumable client export. This changes no dispatch key or pane lifecycle. Med Research consumes both public faces, uses existing brand slots and theme tokens, and continues to register session content through `conversation.view` and `sidebar.right.pane.tab`. It does not register into `root`, `sidebar`, or `sidebar.workspaces`.

## Alternatives considered

**Replace the root or sidebar occupant.** This can reproduce an application shell quickly but removes descendant slots and prevents other DSH features from composing.

**Put all navigation in conversation tabs.** This preserves current APIs but cannot represent global product areas or the supplied workbench hierarchy, and it makes Project navigation compete with task content.

**Add Med Research-specific controls directly to the sidebar package.** This couples the general DSH shell to one product and prevents other bundles from using the same extension.

## Acceptance criteria

- The slot type, runtime catalog, sidebar rendering, lifecycle disposal, ordering, localized labels, expanded/collapsed rendering, keyboard behavior, and no-entry compatibility have focused tests.
- The right-pane client export is usable by an out-of-tree TypeScript client package and its built profile.
- A real Med Research profile shows all five navigation entries, preserves Workspace and Session selection, opens the correct session-scoped view, and does not shadow existing shell descendants.
- `docs/architecture.md`, the sidebar/right-pane package documentation, generated client catalogs, and affected bilingual documents describe the shipped extension.

## Risks

Primary actions increase sidebar vertical pressure and can crowd the Workspace browser. The implementation must constrain the navigation region and preserve browser scrolling at narrow heights. A product entry can become stale when no Session is active, so the registrant must render an actionable create/select-Session state instead of dispatching to a missing conversation owner.
