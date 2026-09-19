---
description: "Opt-in DSH projection of normalized Workbench runtime events for readers migrating the session stream or debugging the Pi runtime path behind `DSH_PI_RUNTIME`."
kind: "package-reference"
---

# `@deepseek-ai/dsh-workbench-bridge`

English | [中文](README.zh.md)

## Summary

`dsh-workbench-bridge` projects normalized Workbench runtime events into the existing append-only DSH session log, so the current mux and conversation/tool UI stay in place while the runtime behind them is migrated. Choose it when a Host must run the Pi runtime without replacing the DSH session surfaces; enable it with `DSH_PI_RUNTIME=1` and keep it off otherwise. Prompts are then processed by Pi and rendered through the existing DSH `conversation` and tool surfaces. The bridge preserves the existing DSH event prefix, so it neither adds system prompt text nor invalidates caches, and it is a POC rather than a shipped runtime path.

## Table of Contents

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Model Experience

### DSH projection

#### What the model sees

When enabled, prompts are processed by Pi and rendered through the existing DSH `conversation` and tool surfaces.

#### Token effect

Pi controls request token accounting; the bridge adds no system prompt text.

#### KV Cache effect

The bridge preserves the existing DSH event prefix and does not add cache-invalidating content.

## Known Limitations and Deferred Work

- The Pi path is an opt-in POC enabled through `DSH_PI_RUNTIME=1`. The bridge accepts text prompts and projects message and terminal tool events; `thinking.delta` and `tool.update` do not reach the DSH log.
- `mappingPath` must name a persistent writable JSON file when a Host restart must preserve a DSH-to-Pi session mapping.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
