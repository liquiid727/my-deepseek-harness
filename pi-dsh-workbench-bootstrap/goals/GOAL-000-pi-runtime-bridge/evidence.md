# EVIDENCE — GOAL-000 Pi Runtime Bridge

> 本文件由实现 Agent 持续更新。
> 只记录真实执行结果，不允许预测或伪造。

## Status

`IN PROGRESS — audit/baseline and bridge implementation complete; P0 provider/UI acceptance pending`

---

## Baseline Audit

### Repository

- repo root: `/Users/mac_liquiid/Desktop/code/my-deepseek-harness`
- branch: `master` at `origin/master`; the goal bootstrap directory and its zip were untracked before this work.
- package manager: pnpm (`packageManager: pnpm@11.7.0`).
- runtime versions: Node `v26.5.0`; pnpm `11.7.0`.
- monorepo: pnpm workspaces: `vendor/*`, `packages/*/*`, `native/landlock-run`, `apps/*`, and `website` (238 workspace projects).
- primary web app: `apps/web`, a Vite/React entry that mounts `@deepseek-ai/dsh-client-web`.
- primary host/server: `apps/cli/src/bin.ts` → `profile-boot.ts` → Cordis `web` profile. `packages/bundle/web-app/cordis.patch.yml` composes the HTTP server, API proxy, client transport, and UI plugins.
- test framework: Vitest `4.1.8`; browser-level tests live in `apps/web/tests`.

### Current Architecture

- UI entry: `apps/web/src/main.ts` creates `AppWebEntry` from `@deepseek-ai/dsh-client-web`.
- conversation UI: `@deepseek-ai/dsh-client-ui-conversation` renders session-derived conversation nodes; the client runtime owns the per-session state.
- message send path: the composer calls `Session.prompt()` in `packages/client/runtime/src/client/sessions/session.ts`, which calls `api.sessions.prompt` over the Connection RPC. The host API proxy validates `session.prompt`, creates a durable DSH user message, then calls the DSH Agent's `followup()` or `steer()`.
- streaming path: host `session/event` broadcasts raw durable session events through the API proxy's mux stream. The browser opens WebSocket downlinks at `/api/events.mux` and `/api/events.host`; it projects `assistant/chunk` and final messages into the conversation view.
- session store: DSH `ctx.sessions` is the live append-only store. The Web profile composes session persistence/projection services; its storage domain is JSON under the DSH home, and cold sessions resume through the API remotes resolver.
- tool call path: DSH Agent Loop emits durable `tool/call` and `tool/result` events. API proxy forwards them with host-derived render intent; `@deepseek-ai/dsh-client-ui-tool` renders the lifecycle.
- artifact path: the current Web UI's deliverables feature derives produced files from successful DSH tool render intents plus tool locations. It is not a standalone artifact runtime.
- model selection: `agent-default-model` selects a DSH LLM route/model; the client invokes the session model API. `@deepseek-ai/dsh-llm-pi-ai` is an installed `@earendil-works/pi-ai` model-provider adapter, not a Pi Agent Runtime.
- DSH host/runtime entry: `dsh web` starts the Cordis profile; `@deepseek-ai/dsh-host-apiproxy` dispatches `session.prompt` to a DSH `Agent`, whose work is driven by `@deepseek-ai/dsh-agent-loop`.
- Cordis/plugin usage: Cordis composes the entire host and browser application as a layered plugin tree. The Web patch retains shared host services and mounts per-session agent presets.

### Shell / Runtime Boundary

#### Current Shell

- `apps/web`, the client runtime, the connection transport, `ui-conversation`, `ui-tool`, layout/theme/sidebar, and the Web host/static server are reusable Shell candidates.

#### Current Runtime

- DSH session log, agent registry/agent loop, DSH tool registry/execution, LLM seam, and session lifecycle currently form one DSH runtime. The UI protocol depends on DSH durable session events and API proxy request types.

#### Coupled / Needs Bridge

- `session.prompt` both records DSH user messages and directly invokes the DSH Agent; it is the narrowest verified ingress for a bridge.
- The outgoing mux protocol is raw DSH `SessionEvent`; Pi events need translation to either a new client protocol or compatible DSH event projection.
- Session resume is DSH-persistence/Agent-resume based. A Pi mapping must be persisted beside or within existing session metadata without silently creating a second session.
- Tool UI and deliverables currently depend on DSH tool event data and presentation metadata.

---

## Baseline

### Install

```bash
pnpm install --frozen-lockfile
```

Result (baseline before implementation):

```text
exit 0. `Scope: all 238 workspace projects`; lockfile was already current. pnpm warned only that Linux-specific native packages are unsupported on this Darwin/arm64 host.
```

### Dev

```bash
DSH_HOME=$(mktemp -d) pnpm dsh web --port 3180
```

Result:

```text
The source Host started and printed `dsh web: http://127.0.0.1:3180`. An ego-browser Chromium session loaded the page at that URL and rendered the Chinese Web shell, including New Session, workspace selection, settings, and a disabled composer awaiting workspace selection. The process was stopped with SIGINT after this verification (exit 130 is intentional shutdown).

The documented source command is `pnpm dsh web` after `pnpm run build`; the temporary port and temporary DSH home prevent interference with local user state.
```

### Build

```bash
pnpm run build
```

Result:

```text
exit 0. Host libraries, client libraries, and `apps/web` Vite build completed. Vite emitted its existing chunk-size advisory for chunks over 500 kB; it did not fail the build.
```

### Typecheck

```bash
pnpm run typecheck
```

Result:

```text
exit 0. The command rebuilt the Host libraries and completed `tsc -b tsconfig.client.json`. Build timing advisories from tsdown were emitted but no type errors.
```

### Tests

```bash
pnpm run test
```

Result:

```text
exit 1. Vitest ran 816 files / 13,616 tests: 807 files and 13,506 tests passed; 8 files and 109 tests were skipped. `scripts/oxlint-contract.spec.ts > checks preserved TypeGraph syntax without type-aware analysis` timed out at its 5,000 ms limit (the runner reported 5,133 ms). The run also emitted known noisy test diagnostics including React error-boundary stacks and `MaxListenersExceededWarning` messages.
```

### Pre-existing Failures

- The baseline `pnpm run test` recorded one `oxlint-contract.spec.ts` timeout; after implementation and generated-catalog fixes, a fresh full run passed (see Regression).
- `DEEPSEEK_API_KEY` was absent in the process environment. A real provider-backed baseline chat cannot be honestly exercised without credentials; the UI boot result above does not prove an existing chat completion.
- The Vite chunk-size and tsdown plugin-timing messages are warnings, not failures.

---

## Implementation Evidence

### Workbench Contract

Files:

- `packages/workbench/workbench-contract/src/index.ts` defines runtime-neutral sessions, agent operations, lifecycle events, and a cross-process event guard. It imports neither DSH UI nor Pi.

Summary:

- `packages/workbench/workbench-contract/tests/events.spec.ts`: 2 tests pass, including rejection of a Pi-private event payload.

Tests:

- `pnpm exec vitest run packages/workbench/workbench-contract/tests/events.spec.ts`: 1 file / 2 tests passed.
- Isolation audit: the contract source imports only `@deepseek-ai/dsh-brand`; Pi-private event types occur only in `pi-adapter`, and no Workbench contract source imports DSH UI packages.

---

### Pi Adapter

Files:

- `packages/workbench/pi-adapter/src/index.ts` uses the embedded `@mariozechner/pi-coding-agent` SDK, Pi `AgentSession`, and `SessionManager`. `JsonWorkbenchSessionMappingStore` persists the Pi session-file path and `MemoryWorkbenchSessionMappingStore` serves tests.

Pi API actually used:

- `createAgentSession`, `AgentSession.subscribe/prompt/abort`, `AgentSession.sessionManager.getSessionFile`, and `SessionManager.create/open` from `@mariozechner/pi-coding-agent@0.73.1`.

Event mapping:

```text
Pi event -> Workbench event
agent_start -> turn.start
message_start/update/end (assistant) -> message.start/delta/end
tool_execution_start/update/end -> tool.start/update/end
agent_end -> turn.end
```

Tests:

- `packages/workbench/pi-adapter/tests/adapter.spec.ts`: 5 tests pass, including event order, prompt/abort forwarding, restart mapping, and JSON mapping persistence.

---

### DSH Bridge

Files:

- `packages/workbench/dsh-bridge/src/index.ts` maps Workbench events into existing DSH session `turn/*`, `step/*`, `assistant/*`, and `tool/*` events. `PiDshBridgeService` is an opt-in Cordis service; `api-proxy` dispatches to it when `DSH_PI_RUNTIME=1`.

Compatibility retained:

- Existing mux, DSH Session persistence, and UI render-intent paths remain in place. Legacy DSH Agent is the default when the flag is unset.

Legacy runtime still active:

- `packages/workbench/dsh-bridge/tests/bridge.spec.ts`: 4 tests pass, including durable event projection, two prompts routed through one Pi mapping, and runtime-error projection.

---

## POC Evidence

### POC-01 Prompt

Status: `NOT RUN — blocked by missing DEEPSEEK_API_KEY`

Evidence:

- No real-provider POC was run. Environment check: `DEEPSEEK_API_KEY` is unset; running this test would not be a valid Pi-provider result.

---

### POC-02 Streaming

Status: `NOT RUN — blocked by missing DEEPSEEK_API_KEY`

Observed delta count:

- The adapter and bridge unit path emits multiple deltas, but no real Pi response was available. This is not counted as P0 pass.

Evidence:

- No provider request was made because `DEEPSEEK_API_KEY` is unset.

---

### POC-03 Tool Call

Status: `NOT RUN — blocked by missing DEEPSEEK_API_KEY`

Tool:

- No real Pi tool was executed. Unit projection covers lifecycle ordering only.

Lifecycle:

```text
No real-provider lifecycle observed; the unit path covers start/update/end ordering.
```

Evidence:

- No Pi tool was executed in the assembled UI.

---

### POC-04 Session Resume

Status: `NOT RUN — blocked by missing DEEPSEEK_API_KEY`

Mapping strategy:

- The file-backed mapping path is unit-tested; a real restart with a Pi session could not be performed without provider credentials.

Evidence:

- No real restart was run; the mapping store and adapter reopen tests passed.

---

### POC-05 Abort / Error

Status: `NOT RUN — controlled bridge error path not yet exercised in assembled Web UI`

Evidence:

- `WorkbenchDshBridge` has an explicit runtime-error projection, but no assembled UI abort/error POC was run.

---

## Regression

### Build

Status:

- PASS: `pnpm run build` after implementation; Host libraries, Workbench packages, and the Web Vite bundle completed.

### Typecheck

Status:

- PASS: `pnpm run typecheck` after implementation; Host and Client aggregates completed and tsdown built `@deepseek-ai/dsh-workbench-bridge`.

### Unit Tests

Status:

- PASS: focused bridge/adapter/contract run, 3 files / 10 tests.

### Integration / E2E

Status:

- PASS: a fresh `pnpm run test` after the implementation fixes ran 819 files / 13,626 tests: 811 files passed, 8 skipped; 13,517 tests passed, 109 skipped. The run exited 0. React error-boundary diagnostics remain expected test output.

### Manual UI

Status:

- Baseline Web boot was manually verified in ego-browser. A source launch with `DSH_PI_RUNTIME=1` also served `http://127.0.0.1:3181` successfully with no `piBridge` registration error; Pi-enabled chat was not run without a provider key.

Command:

```bash
DSH_HOME=$(mktemp -d) DSH_PI_RUNTIME=1 pnpm dsh web --port 3181
```

Result: the source host printed `dsh web: http://127.0.0.1:3181`; an HTTP GET returned the Web shell, and the process was then stopped intentionally.

### Hygiene

Status:

- FAIL (pre-existing repository residue): `pnpm run hygiene` stopped at `rescope-vendor:check` with 26 pre-rescope-name tokens in existing docs/extensions/remotes files. It did not report a Workbench source failure before stopping.

Additional gates:

- PASS: `pnpm run verify-cordis-catalog` (93 generated files/regions current).
- PASS: `pnpm run verify-cordis-config` (122 config files).
- PASS: `pnpm run verify-export-jsdoc`, `verify-package-invariants`, `verify-package-readme-model-experience`, `verify-translation-pairing`, Agent Note format/classification, and documentation budgets.
- PASS: `git diff --check`.

---

## Screenshots / Artifacts

- Baseline screenshot was captured in ego-browser task space 4 while `dsh web` served port 3180. No Pi-enabled screenshot was captured because no provider key was available.

---

## Commits

- No commit was created in this execution.

---

## Changed Files

- `packages/workbench/README*`, `packages/workbench/workbench-contract/**`, `packages/workbench/pi-adapter/**`, `packages/workbench/dsh-bridge/**`, the root package-group README pair, Host API opt-in wiring, Web bundle composition, `tsconfig.base.json`, `tsconfig.host.json`, `THIRD_PARTY_NOTICES.md`, and the implementation Agent Note.
- `scripts/gen-cordis-catalog.ts`, `packages/host/apiproxy/tsconfig.json`, and generated Cordis catalog regions were updated so the new `ctx.piBridge` service is represented by repository catalog gates.

---

## Temporary Compatibility

- `DSH_PI_RUNTIME` is an explicit opt-in. Unset preserves the legacy DSH Agent; set to `1` routes followup and queue prompts to Pi.

---

## Remaining Legacy DSH Dependencies

- Browser connection, mux frames, DSH session persistence/projection, render-intent metadata, and API schemas remain DSH-owned during this bridge Goal. The DSH Agent remains the default runtime.

---

## Known Issues

- Real-provider P0 evidence is blocked until `DEEPSEEK_API_KEY` and a configured Pi model/tool environment are supplied.
- Full repository tests pass after the catalog and typing fixes; hygiene still reports the pre-existing vendor-rescope residue.
- The final focused Workbench run passed 3 files / 10 tests after the Cordis service registration fix.

---

## Final Acceptance

```text
P0-01 Baseline          [x]
P0-02 Pi Prompt         [ ]
P0-03 Streaming         [ ]
P0-04 Tool Call         [ ]
P0-05 Session Resume    [ ]
P0-06 Abort/Error       [ ]
P0-07 Isolation         [x]
P0-08 Regression        [x]
```

---

## Final Status

`NOT DONE`
