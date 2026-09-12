# Agent Note: Blank sessions expose plugin-owned workspace launches

Status: implemented

English | [中文](2026-09-11-blank-session-view-launch.zh.md)

## Problem

Session-scoped Conversation Views are hidden while a new Session is still blank. A plugin can register a complete view and still give the user no way to reach it before the first model turn.

## Decision

The Conversation Session renders a session-scoped `conversation.hero.actions` list during the blank Hero. The Med Research client registers one localized action that selects its Research View directly; selecting the view does not submit a model message. The existing header and view navigation remain unchanged for active conversations, and the plugin declares the new row locally so its standalone typecheck does not depend on an unpublished DSH package artifact.

## Alternatives considered

- Add a global sidebar or URL route: this would compete with the shell's existing workspace navigation and violate the plugin's Conversation View integration model.
- Show all four medical tabs in the blank Hero: this would expose downstream views before a Research project exists and imply completion of later workflow surfaces.
- Send a hidden starter prompt: this would create a model-visible turn and make opening a workspace depend on network and model availability.

## Consequences

A new-session user can enter the implemented Research workspace from the first screen, while the DSH shell remains target-neutral and other plugins can contribute their own localized launches. The four medical views remain registered for in-session navigation; only the Research entry is advertised by this S01 launch. Consumers pinned to the released DSH package continue to need a package release containing the new slot declaration.
