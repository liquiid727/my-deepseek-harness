---
description: "Product design system for DSH web interfaces: visual principles, semantic color roles, type, geometry, responsive behavior, accessibility, and reusable-component policy."
kind: "reference"
---

# DSH product design system

English | [中文](design-system.zh.md)

This reference defines how a DSH product should look and behave. [`web-styling.md`](web-styling.md) owns the implementation rules; the live values are the `--dsw-*` variables in [`ui-theme`](../packages/client/ui-theme/README.md), and reusable controls live in [`ui-primitives`](../packages/client/ui-primitives/README.md#component-catalog).

## Product character

DSH interfaces use clinical clarity and evidence traceability: dense information remains scan-friendly, important states have explicit text, and source relationships stay visually stronger than decoration. Blue identifies navigation, focus, selection, links, and primary actions; green, orange, and red communicate success, attention, and failure. Feature brands may add a narrowly scoped domain color, but never replace the product interaction colors.

## Color roles

The light palette uses a cool canvas (`#F7FAFF`), white surfaces, ink (`#17233D`), secondary text (`#5D6B85`), and a blue-grey line (`#E1E9F4`). Accent blue is `#287CF0`; text-bearing primary actions use the darker `#216BD0` with `#195BB4` on hover, and low-emphasis selection uses `#EAF3FF`.

The dark palette uses canvas `#0F1115`, surfaces `#151517` and `#232324`, primary text `#F9FAFB`, secondary text `#CFD3D6`, and 12% white separators. Accent blue is `#75ADFA`; low-emphasis selection uses `#183E7A`. `--dsw-alias-label-on-accent` always supplies the foreground placed on an accent fill.

Components consume semantic aliases such as `accent-primary`, `accent-strong`, `focus-ring`, `label-primary`, and the `state-*-label` roles. They do not consume raw palette values or define light/dark branches.

## Typography, spacing, and shape

Product UI uses the platform system sans stack. Long-form paper reading uses `--dsw-font-reader-body`, a 17px/1.65 serif role. Spacing follows the 4, 8, 12, 16, 24, and 32px rhythm without a spacing-token layer. Corners use 8px for controls, 12px for compact surfaces, 16px for prominent cards, and a full pill only for capsule controls. Flat surfaces use a border; elevated surfaces use one of the two product elevation levels, not both.

## Components

Feature packages compose controls from `ui-primitives`. `Button` provides 28, 36, and 44px heights; primary page actions use 44px. `Input` provides 32 and 40px heights. `Field` owns the label, supporting text, error relationship, and control ARIA attributes while the caller owns every localized string. `TabList` owns controlled selection and roving keyboard focus while callers own panels and their content.

Page shells, tables, cards, and domain visualizations remain feature-owned until two independent packages need the same behavior. Shared components contain no product copy and no Cordis dependency.

## Responsive and accessible behavior

At 1000px and wider, workbench products may show multiple columns. From 700px through 999px, secondary regions move to a drawer. Below 700px, content becomes a single column and major regions switch through tabs. Content must remain usable at 200% zoom without horizontal page scrolling.

Every interactive element has a visible keyboard focus indicator, a localized accessible name, and a minimum 44px target for primary actions. Tab lists support Left/Right and Up/Down arrows plus Home and End. Status never relies on color alone. Motion respects `prefers-reduced-motion`; removing motion must not remove state information.

## Reference assets

Files under `asset/` are design references, not runtime dependencies. A feature may reproduce their hierarchy and relationships only with real application state; incomplete Reader, Statistics, or Skills behavior renders an honest empty, disabled, or unavailable state rather than sample data.
