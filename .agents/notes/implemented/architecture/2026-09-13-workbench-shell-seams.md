# Agent Note: Workbench shell seams — sidebar primary actions and root-level View activation

Status: implemented

English | [中文](2026-09-13-workbench-shell-seams.zh.md)

## Problem

Out-of-tree workbench plugins need two things the shell did not expose. The sidebar had no additive region for plugin-owned primary navigation, and a root-scoped surface had no way to activate a registered Conversation View on the current Session — view selection lived only inside session-scoped slot entries, so a sidebar entry could launch sessions but never switch views on an existing one.

## Decision

The sidebar shell declares one additive `sidebar.primary.action` list slot between New Session and the workspace region. The owner shares only the column state (`wide`); entries register with their own `id`/`order`/`label` and own their navigation behavior. While entries are live the shell renders them as a distinct 56px icon rail left of the workspace browsing region — the prototype's two groups inside the host column; the rail tracks the strip reactively, so with no entries it never mounts and the geometry is unchanged. Collapsed, the icon rows stack above the region's own rail column.

`UiConversation` gains `openView(view, { sessionId?, focus? })`: it resolves the current (or given) Session, activates the registered View on the session assembly, and writes the selection plus focus request through the shared per-Session Conversation store. The store handle is wrapped by `sharePerScopeStore`, so the slot framework and direct service callers observe one instance per scope key instead of two live stores that only share persistence. A blank Session whose active View is a registered feature View presents that View instead of the centered hero: the View owns the surface and the composer docks, so View content is never covered by hero chrome. The shell reads the selection through a new `viewSelection` hook on the Conversation inject; without a Session `openView` refuses and the caller keeps its launch flow.

Docking is the default placement. Views can place the same resident composer inside their content through the [View composer outlet](2026-09-13-view-composer-outlet.md); that decision owns placement and post-admission callbacks.

Cross-plugin navigation is by service name (`uiConversation`, `uiWorkspace`) resolved through the client `inject` list; plugins that need these seams must declare them there, since services outside the declared inject list are not guaranteed to resolve.

## Alternatives considered

**Owner-provided navigation callbacks on the sidebar slot.** They would couple the shell to Conversation semantics and grow owner props with every navigation target; the spec keeps owner props at `wide` only.

**Reaching the View store through the framework's private instance cache.** Instance uniqueness per key is the caller's responsibility by contract; wrapping the handle makes sharing explicit and works for both readers.

**Suppressing the hero by live-store polling or persisted-preference reads.** The inject hook reuses the same observable the session body consumes, so the hero decision is reactive and single-sourced.

## Consequences

Workbench plugins register primary navigation entries (icon rail with the active-View pill highlight, driven by the public `viewSelection` reader), switch Views on live Sessions, and blank sessions presenting feature Views dock the composer so View content scrolls fully into view. Sidebar geometry with no entries, New Session, the workspace browser, settings, and chat's default-View behavior are unchanged. The composer chain, hero launch slots, and existing view roster keep their contracts; `workbench.topbar` was retired as unused rather than kept as an empty reserved band.
