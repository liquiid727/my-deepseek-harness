# Agent Note: Project-local GoalSpec workspaces for Med Research

Status: implemented

English | [中文](2026-09-10-med-research-goalspec-workspaces.zh.md)

## Problem

The Med Research plugin has a monolithic V1.1 PRD and Spec, a broader capability matrix, and five UI prototypes. Without a stable requirement workspace, maintainers can confuse accepted V1.1 behavior with roadmap proposals, treat a prototype as an implementation contract, or claim delivery without current verification evidence and QA acceptance.

## Decision

The repository stores Med Research product delivery records under `.requirements/requirements`, resolved by `.specos/manifest.yaml`. R001 normalizes the approved V1.1 scope into five outcome-owned child Spec Packages. R002 separately owns Skills discovery because Skill authoring, publication, installation, permissions, versioning, sandboxing, and evaluation require product and security decisions outside V1.1.

The original `.todo` PRD and Spec, capability matrix, and files in `asset/` remain source inputs. The root PRD owns product intent and acceptance criteria; child Specs own deliverable behavior; Test Designs plan independent verification; evidence indexes record executions; review files record findings; only acceptance files declare QA decisions. A UI prototype governs information hierarchy and visual intent but does not override behavior, accessibility, failure, security, or evidence requirements.

The workspace uses the SpecOS `spec-only` project type because the existing DeepSeek Harness repository remains the owner of builds, runtime composition, application launch, tests, and documentation gates. AI-authored Test Designs remain draft until human approval. Empty evidence indexes, open reviews, and blocked acceptance files prevent the planning conversion from being reported as delivered functionality.

## Alternatives considered

**Keep the monolithic PRD and Spec as the only delivery record.** This preserves fewer files but cannot give independently deliverable outcomes separate lifecycle, verification, review, and acceptance records.

**Turn capability-matrix rows or screenshots directly into implementation tasks.** This is rejected because those inputs do not define public interfaces, error behavior, trust decisions, compatibility, or acceptance evidence.

**Include the Skills workspace in R001.** This is rejected because Skills require separate security, lifecycle, compatibility, and evaluation approval.

**Initialize a second full-stack application workflow.** This is rejected because DeepSeek Harness already owns the application and package architecture. A second runtime workflow would create competing launch and validation rules.

## Consequences

Maintainers resolve implementation work through R001 or R002 and preserve stable Requirement, Spec, Test, Review, and Acceptance IDs. Existing code and tests may be reused only after current executions are normalized against the owning Test IDs and exact Spec revision. The additional records require maintenance, but they make scope changes, blocked decisions, residual risk, and delivery claims explicit.

No implementation Issue is required merely to split an approved Spec Package. A precise bug, regression, or local change may create an Issue that identifies its primary Spec and current Test binding.

## Verification

The SpecOS manifest check and all five R001 child selectors pass. YAML parsing, Spec hash bindings, Requirement-to-Spec-to-Test traceability, placeholder scanning, and whitespace checks cover the generated workspace. Repository documentation checks remain independently responsible for Markdown, links, bilingual pairing, and Agent Note rules.
