---
name: requirement-package
description: Use when starting, decomposing, verifying, reviewing, or accepting a GoalSpec v2 Requirement Workspace in this repository
---

# Skill — Requirement Package Workflow

This file maps the local layout to the installed GoalSpec skills. It does not
replace their instructions.

## Required Routing

- Use `prd` for a broad product requirement and root PRD acceptance criteria.
- Use `prd-to-spec` to create independently deliverable child Spec Packages.
- Use `spec-to-test` to derive a draft verification design from each approved Spec.
- Use `to-issues` only for a precise bug, regression, or local change. A child Spec
  does not require an implementation Issue merely because it exists.
- Use `review-it` for implementation review and `feature-verify` for QA acceptance.
- Use `loop-it` only after the relevant execution entries are approved.

## Local Rules

The root PRD owns product intent and acceptance criteria. Each child directory
owns one independently deliverable Spec, draft or approved Test Design, review
record, evidence index, and QA decision. UI images are design inputs; they do not
override behavior, accessibility, failure, security, or evidence requirements.

Only `acceptance.md` may declare a package or requirement accepted. Empty evidence,
an open review, or a draft Test Design keeps acceptance blocked.
