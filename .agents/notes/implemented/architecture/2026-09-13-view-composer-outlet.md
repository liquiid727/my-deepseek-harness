# Agent Note: View placement of the resident composer

Status: implemented

English | [中文](2026-09-13-view-composer-outlet.zh.md)

## Problem

A workbench View needs its primary message input inside its hero. A second editor sharing only plain draft text cannot preserve the host's attachment staging, reference nodes, command handling, or send state. Remounting the host editor at a different React destination also discards editor-local state.

## Decision

`conversation.view` receives `mountComposer`: a View supplies an empty element's unique DOM id, localized placeholder, and an accepted-message callback. The host owns one stable portal container and moves it between that element and the shell dock. Only an id and callbacks cross client plugin domains; the View never receives host React nodes or editor internals. The registration is Session-scoped and released with the View or Session. Identity-guarded disposal cannot remove a newer registration.

The portal container stops native interaction-event bubbling after its owning React dispatch. A View can contain an independent React root; allowing the same event into that root can dispatch toolbar actions twice. Browser verification and a nested-root regression cover this isolation.

Ordinary submission captures the registration and invokes its callback after admission only if the same Session, View, and registration remain current. A failed send uses the existing draft-restoration flow. Commands do not trigger navigation. Pending interactions place the composer chain in the shell dock so approval and question takeovers remain reachable.

The [workbench navigation decision](2026-09-13-workbench-shell-seams.md) continues to own primary actions and View selection. Its docked placement is the default for Views without an outlet.

## Alternatives considered

A second textarea would duplicate input behavior and lose structured draft state. Rendering another InputBar into the View would remount Lexical and split host ownership. Passing a React element through owner props would couple separate client domains to one framework instance.

## Consequences

Workbench plugins control placement and post-admission navigation while the host retains input behavior, attachment lifetime, and temporary takeovers. Placement is transient UI state and creates no Session event. A deployed View using this callback requires the matching host client interface and build.
