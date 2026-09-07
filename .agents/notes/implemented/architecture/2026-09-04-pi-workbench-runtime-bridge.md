# Agent Note: Pi Workbench runtime bridge

Status: implemented

English | [中文](2026-09-04-pi-workbench-runtime-bridge.zh.md)

## Problem

The existing Web shell addresses a DSH Agent and consumes DSH session events, while the Pi AgentSession runtime exposes a different private event stream and durable session identity.

## Decision

The Workbench contract owns a small runtime-neutral session/event vocabulary. `dsh-pi-adapter` translates Pi events and stores Workbench-to-Pi session-file mappings. `dsh-workbench-bridge` projects those events into the existing DSH append-only session log. The Host API selects this path only when `DSH_PI_RUNTIME=1`; the default remains the DSH Agent path during the POC.

## Alternatives considered

- **Replace the browser protocol with Pi events** — this would couple every existing conversation and tool renderer to Pi private payloads.
- **Run Pi as a separate RPC process** — the embedded SDK keeps one Host lifecycle and avoids a second wire protocol for the initial bridge.
- **Keep mappings only in memory** — a JSON mapping file is required so a Host restart cannot create a second Pi session for the same Workbench session.

## Consequences

The current mux, conversation UI, and tool UI remain reusable because the bridge writes their existing DSH events. Pi model/tool credentials and richer Pi event variants remain deployment concerns; real-provider acceptance requires a configured API key and is not claimed by keyless unit tests.
