# `@deepseek-ai/dsh-workbench-contract`

English | [中文](README.zh.md)

Runtime-neutral session, agent, and event interfaces for a Workbench shell. The package deliberately has no dependency on DSH UI or Pi private events.

## Model Experience

### Contract events

#### What the model sees

This package defines `WorkbenchEvent` values that a model-driven Workbench shell can render; it does not run a model. Consumers decide which normalized events become model-visible messages.

#### Token effect

Zero direct token effect.

#### KV Cache effect

No direct cache effect.

## Known Limitations and Deferred Work

- The event union is a minimal shared projection. A runtime-specific payload needs a normalized event before a Workbench shell can consume it.
