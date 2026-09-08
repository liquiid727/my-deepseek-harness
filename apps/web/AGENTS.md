# AGENTS.md — Web frontend application

`apps/web` is the Vite entry package for the browser application. It assembles the client shell and emits the static files served by `dsh web`.

- Keep browser behavior in `packages/client` and host/server behavior in `packages/host`; this directory owns Vite entry configuration and frontend packaging.
- Changes affecting rendered or assembled UI require `pnpm run test:gui` and the replay web checks described by [the client rules](../../packages/client/AGENTS.md).
- Do not import Node-only runtime modules into the browser bundle. Update the explicit browser stubs or package exports when a dependency boundary changes.
- `dist/` is build output and is never hand-edited or committed.
