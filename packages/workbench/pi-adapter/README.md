---
description: "Pi `AgentSession` and durable session-file adapter for readers embedding the Pi runtime or debugging event normalization and session mapping persistence."
kind: "package-reference"
---

# `@deepseek-ai/dsh-pi-adapter`

English | [中文](README.zh.md)

## Summary

`dsh-pi-adapter` adapts Pi `AgentSession` events and durable session files to the Workbench contract, so a Workbench shell consumes one normalized event stream instead of Pi private payloads. Choose it when the Pi runtime is embedded and its streaming, tool, session, and error lifecycle facts must reach a shell; DSH-specific projection belongs in `dsh-bridge`, never here. Pi remains the model runtime, so token and cache behavior still come from the configured Pi model. The adapter covers only the listed `AgentSession` event variants, and its default mapping store is process-local.

## Table of Contents

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Model Experience

### Pi runtime session

#### What the model sees

Pi remains the model runtime; this adapter exposes `AgentSession` streaming, tool, session, and error lifecycle facts without exposing Pi private payloads.

#### Token effect

Determined by the configured Pi model and conversation history.

#### KV Cache effect

Pi owns provider request caching; this adapter adds no prefix content.

## Known Limitations and Deferred Work

- The adapter supports only the listed Pi `AgentSession` event variants. Pi-specific event fields do not cross into the Workbench contract.
- The default mapping store is process-local. Embedders that need sessions to survive a restart provide `JsonWorkbenchSessionMappingStore` or another durable store.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
