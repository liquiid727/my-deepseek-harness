# `@deepseek-ai/dsh-workbench-bridge`

English | [中文](README.zh.md)

Projects normalized Workbench runtime events into the existing append-only DSH session log so the current mux and conversation/tool UI can remain in place during migration.

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
