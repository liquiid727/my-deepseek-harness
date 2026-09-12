# Guardrail Matrix

English | [中文](guardrail-matrix.zh.md)

## Summary

This matrix assigns each guardrail to the lifecycle context where it provides useful feedback and to the context that must block delivery. "Conditional" means the check runs when the repository has that surface or when the change scope activates it.

## Table of Contents

- [Matrix](#matrix)
- [Policy](#policy)
- [Language profiles](#language-profiles)
- [Evidence contract](#evidence-contract)

## Matrix

| Guardrail | Local | Pre-commit | Pre-push | CI / PR | Blocking |
| --- | --- | --- | --- | --- | --- |
| Format | Editor and changed files | Yes, safe repair | Optional | Yes, whole scope | Commit and CI |
| Lint | Changed files | Yes, fast rules | Optional | Yes, full rules | Commit and CI |
| Typecheck | Editor or focused package | No | Yes | Yes, clean checkout | Push and CI |
| Unit test | Focused tests | No | Conditional | Yes | CI; push when fast and stable |
| Integration test | Focused when cheap | No | Conditional | Yes | CI |
| Architecture | Targeted graph query | Conditional | Conditional | Yes, full graph | CI; earlier when deterministic |
| API contract | Local schema generation | No | Conditional | Yes, schema and consumers | CI |
| DB migration | Local dry run | No | Conditional | Yes, forward and supported rollback | CI |
| Spec consistency | Changed spec and delta | Conditional | Conditional | Yes, complete traceability | CI |
| Docs consistency | Changed docs | Yes when staged | Conditional | Yes, links and structure | Commit and CI |
| i18n | Changed pair | Yes, staged record | No | Yes, full corpus | Commit and CI |
| Secret scan | Changed files if fast | No | No | Yes | CI |
| Dependency | Manifest and lockfile | No | Conditional | Yes, policy and vulnerability scan | CI |
| Generated files | Source-owned outputs | Yes, safe regeneration | No | Yes, deterministic freshness | Commit and CI |
| License | Local manifest query | No | No | Yes | CI and release |
| Security | Focused tests | No | No | Yes, complete scan | CI and release |

## Policy

Checks under one second should normally run in the editor or pre-commit. Checks from one to five seconds may run in pre-commit when they are deterministic and scoped to changed files. Checks from five to thirty seconds usually belong in pre-push or a focused local command. Checks above thirty seconds, networked checks, large integration suites, E2E, security scans, dependency scans, and release builds belong in CI unless a project has measured a reliable local variant.

The matrix is a policy artifact, not a copy of a specific Lefthook file. A hook may select a subset of the pre-commit column, and CI may split one column across several jobs. The guardrail identifier and result schema must remain stable across those adapters.

Blocking is evaluated per lifecycle. A non-blocking observational check still reports its status and cannot be used as evidence that a blocking check passed. A missing environment must produce either an explicit self-skip with policy permission or a loud failure; silent skip is prohibited for required checks.

## Language profiles

| Profile | Format | Lint and static analysis | Typecheck | Tests | Security and dependency |
| --- | --- | --- | --- | --- | --- |
| Go | `gofmt` | `go vet`, `golangci-lint` | Go compiler and package build | `go test` | `govulncheck` and repository scans |
| Python | Ruff format or Black | Ruff | `mypy` or `pyright` | `pytest` | `pip-audit` or approved scanner |
| TypeScript / React | Prettier | ESLint or Oxlint | `tsc` | Vitest and browser tests | Approved npm scanner and secret scan |

Tools are replaceable implementations. The core standard is the category, scope, evidence, and blocking policy.

## Evidence contract

Every guardrail result should include its identifier, revision, scope, command, tool versions, status, duration, and diagnostic locations. CI additionally records the operating system, runtime versions, dependency installation mode, and artifact identity when applicable.

The merge gate consumes only blocking results. Release gates consume the exact artifact checks required by the release profile. Agent completion reports consume the same result identifiers and must distinguish passed, failed, skipped, not-applicable, and not-run.
