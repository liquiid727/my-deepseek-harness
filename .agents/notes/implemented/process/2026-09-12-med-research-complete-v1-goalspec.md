# Agent Note: Complete V1 GoalSpec ownership for Med Research

Status: implemented

English | [中文](2026-09-12-med-research-complete-v1-goalspec.zh.md)

## Problem

The Med Research capability matrix, five product prototypes, the R001 Requirement Workspace, and the implementation entry points assigned different scope and acceptance meaning to the same V1. The earlier five-package Workspace treated several P0/P1 capabilities as roadmap work and accepted an unspecified “prototype hierarchy” as its UI contract. An implementation could therefore satisfy the written Specs while omitting Knowledge, Skills, Writing, Evidence Table, advanced Reader behavior, and the visible workbench structure.

## Decision

R001 version 2.0 owns every P0 and P1 item in the capability matrix. P0 is an intermediate usable milestone; R001 is accepted only after P1 and all eight required Spec Packages are accepted. S01 through S05 retain their permanent identities and business areas, while S06 owns Knowledge, S07 owns Skills, and S08 owns evidence-based Writing. Existing Test Designs and evidence remain stored but are stale until they bind the 2.0 Specs.

Each matrix item maps to a Requirement, a child Spec behavior, and an acceptance criterion. The five product prototypes are blocking design inputs. Their owning Specs define the DSH mapping, regions, information order, primary actions, density, typography, semantic colors, icons, scrolling, fixed elements, state variants, and responsive behavior. Acceptance compares screenshots from one real profile run with the prototypes at the source viewport and verifies desktop and narrow adaptations; component-presence assertions and static business mocks are insufficient.

R002 keeps its permanent Requirement ID but provides no implementation authority for V1 Skills. R001 S07 owns the approved Skills outcome. The Workspace remains a spec-only GoalSpec projection: DSH still owns builds, runtime composition, application launch, tests, and documentation checks; child acceptance and root acceptance remain the only QA decisions.

## Alternatives considered

**Keep the five-package V1.1 scope and improve only S01 CSS.** This would leave the product matrix without implementation authority and would repeat the same contract-to-product mismatch for the other four prototypes.

**Create a new Requirement for the complete product.** This would preserve the narrow R001 but create two competing definitions of the same Med Research V1. Keeping the permanent R001 identity and incrementing its version preserves traceability without parallel product truth.

**Treat P1 as non-blocking roadmap work.** This would contradict the approved complete-V1 scope and allow final acceptance while Skills, Knowledge, Writing, and advanced research behavior remain absent.

**Use pixel-difference thresholds for prototype acceptance.** Host fonts and browser rendering make such thresholds brittle. A recorded side-by-side review of specified visual properties makes design deviations blocking without treating platform antialiasing as product failure.

## Consequences

The Requirement Workspace becomes larger and delivery is dependency-ordered, but every requested capability has one current owner. Existing implementation evidence can inform planning but cannot accept changed contracts. Maintainers must regenerate Test Designs after Spec approval and must record real-profile visual evidence for every user-visible package. Team collaboration, marketplace commerce, multi-tenant authorization, and unreviewed remote Skill packages remain outside V1.
