# Agent Note: Product design system and shared form-navigation controls

Status: implemented

English | [中文](2026-09-13-product-design-system.zh.md)

## Problem

The web styling rules define how CSS is owned but do not define a product visual language. Feature plugins can follow CSS Modules and token-only colors while still choosing unrelated canvases, action colors, status contrast, control heights, and responsive behavior. Form labels and tab keyboard behavior were also repeated in feature packages because the shared component package did not own those interaction patterns.

## Decision

[`docs/design-system.md`](../../../../docs/design-system.md) owns the product visual language. DSH uses a cool clinical canvas, blue interaction hierarchy, explicit semantic state labels, a restrained radius and elevation scale, and a reader-specific serif role. The light and dark values live in `ui-theme`; feature packages consume semantic aliases and can register only narrowly scoped domain tokens through `ThemeRuntime.overrideTokens`.

`accent-primary` identifies focus, selection rails, and non-text emphasis. Text-bearing primary actions use `accent-strong` with `label-on-accent`, and hover uses `accent-hover`. This split keeps the recognizable product blue while meeting text contrast requirements. `state-success-label`, `state-warn-label`, and `state-error-label` are the text roles; brighter state colors remain available for non-text marks.

`ui-primitives` owns two additional interaction patterns. `Field` associates caller-owned localized labels, descriptions, errors, and actions with a caller-rendered control. `TabList<T>` owns controlled selection, roving `tabIndex`, disabled-item skipping, and Arrow/Home/End activation while the caller owns panel lifecycle and content. `Button` includes a 44px primary-action size, and `Input` includes 32px dense and 40px standard form sizes plus an `aria-invalid` presentation.

The Med Research plugin consumes the shared primitives through the browser module table. Its compiled styles carry loader ownership tags, so unload and HMR remove them with the plugin. The plugin registers statistics purple as a domain token; navigation, focus, primary actions, Evidence states, surfaces, and text use DSH semantic aliases. Files under `asset/` remain references and never enter the browser bundle.

## Relationship to existing decisions

The [web styling system](../process/2026-07-19-web-styling-system.md) remains active because it owns CSS Modules, token ownership, theme isolation, and spacing policy. The [shared client control primitives](2026-09-05-shared-client-control-primitives.md) remains active because it owns the reuse criterion and the distinction between shared controls and feature layouts. This note adds the product language and the form/tab interaction contracts; it does not supersede either rationale.

## Alternatives considered

**Adopt Material UI, Tailwind, or Storybook as the design system.** Rejected because each would add a second styling or component authority beside the existing token sheets, CSS Modules build path, and component catalog. The product needs a coherent language and reusable contracts, not a parallel runtime framework.

**Expose page shells, cards, tables, and workbench layouts from `ui-primitives`.** Rejected because those structures still have one domain owner and encode feature information architecture. They remain local until two independent packages need the same behavior.

**Keep one blue token for decoration, focus, and button fill.** Rejected because the reference accent does not provide sufficient contrast with white text at ordinary sizes. Separate accent and action roles retain the visual identity without weakening readable actions.

**Bundle the reference PNG files or populate unfinished views with their sample content.** Rejected because screenshots are not product data. Runtime views render only persisted or Remote state and show localized unavailable states for incomplete capabilities.

## Consequences

Feature authors have one visual reference, one semantic palette, and shared accessible field and tab behavior. The visible palette changes across every DSH profile that loads `ui-theme`, so regressions are assessed at the product level rather than treated as plugin-local. Feature-specific page composition remains deliberately local, and domain colors require explicit theme registration. Automated tests pin token presence, removed ambiguous aliases, ARIA relationships, keyboard behavior, and the Med Research bundle's style ownership; browser screenshots remain the evidence for pixel-level appearance.
