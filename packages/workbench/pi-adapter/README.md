# `@deepseek-ai/dsh-pi-adapter`

English | [中文](README.zh.md)

Adapts Pi `AgentSession` events and durable session files to the Workbench contract. DSH-specific projection belongs in `dsh-bridge`.

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
