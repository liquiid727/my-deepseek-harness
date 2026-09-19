---
description: "Runtime-neutral Workbench session, agent, and event interfaces for readers choosing a shell contract or debugging which normalized events a Workbench shell can render."
kind: "package-reference"
---

# `@deepseek-ai/dsh-workbench-contract`

English | [中文](README.zh.md)

## Summary

`dsh-workbench-contract` declares the runtime-neutral Workbench contract: the session, agent, and lifecycle-event interfaces a Workbench shell renders, with no dependency on DSH UI or on Pi private events. Choose it when an embedded runtime must hand normalized events to a shell, or when a shell must stay swappable between runtimes. It carries types and normalization only: nothing here runs a model, and consumers decide which normalized events become model-visible messages. The event union is a minimal shared projection, so a runtime-specific payload still needs a normalized event before a shell can consume it.

## Table of Contents

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

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

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
