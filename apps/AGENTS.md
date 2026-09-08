# AGENTS.md — Applications

The `apps/` tree contains runnable product entry points assembled from `packages/`. Keep reusable runtime behavior in a package; an app owns composition, launch configuration, packaging, and end-to-end coverage.

- App dependencies must be declared in the app manifest. Do not rely on another workspace package's transitive dependency or on a source-only path.
- Changes to assembled behavior use the app's real boot path and the smallest relevant snapshot or end-to-end test. Unit tests alone do not prove composition.
- Built output is disposable. Do not commit `lib/`, `dist/`, source maps, or TypeScript build metadata unless a directory explicitly documents a checked-in fixture.
- Read [the package rules](../packages/AGENTS.md) before changing a package consumed by an app.
