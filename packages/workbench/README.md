---
description: "The Workbench package group: what the packages under packages/workbench/ own, for readers choosing or navigating the family."
kind: "package-group"
---

# Workbench

English | [中文](README.zh.md)

The Workbench group contains the runtime-neutral contract, embedded Pi runtime adapter, and DSH compatibility bridge used by the Pi Runtime Bridge proof of concept.

## Packages

- [`workbench-contract/`](workbench-contract/README.md) — session, agent, and lifecycle-event interfaces independent of DSH and Pi.
- [`pi-adapter/`](pi-adapter/README.md) — Pi `AgentSession` creation, resume, event normalization, and mapping persistence.
- [`dsh-bridge/`](dsh-bridge/README.md) — opt-in Host ingress and projection into the existing DSH session event stream.

## Known Limitations and Deferred Work

The bridge is a POC. Real-provider acceptance, richer model selection, and complete tool registration remain deployment work recorded in GOAL-000 evidence.
