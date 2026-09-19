# Inspector opens replace a real right-sidebar tab

## Problem

The medical home view opened the inspector with `replaceTab: true`. The public
`sidebarRight.openTab` API accepts a `TabId` for this field; the boolean form is
only normalized by the per-tab action helper. Passing the boolean through the
service caused the dock layout to look up a tab named `true`, so the
conversation view crashed and the main work area rendered blank.

## Decision

Read the active right-sidebar tab and pass its `id` as `replaceTab`. When no
tab is active, omit the replacement and let the sidebar choose its default
pane. Keep the replacement in the existing `openInspector` flow so the host
guide is replaced without changing navigation or panel ownership.

## Verification

The browser plugin test invokes the registered home-view injection and asserts
that the inspector request uses the active tab ID. The focused test and plugin
typecheck are the acceptance checks for this fix.
