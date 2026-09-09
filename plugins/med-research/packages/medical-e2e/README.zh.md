# @medresearch/dsh-medical-e2e

[English](README.md) | 中文

## 概述

基于真实服务的 keyless 端到端链路。`tests/research-chain.spec.ts` 跑通：问题 → 录制回放 PubMed → 真实 JATS → 定位证据 → 通过校验的 Claim → 后端 `[1]` 引用。

## 已知限制与后续工作

Statistics 链与浏览器可见的 UI 链尚未覆盖。
