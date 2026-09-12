# Repository Guardrails Standard

English | [中文](repository-guardrails.zh.md)

## Summary

Repository Guardrails are executable rules that give the same answer for a human developer, an AI coding agent, a local hook, and CI. Lefthook is only one adapter. The standard command is the source of execution truth.

## Table of Contents

- [Operating model](#operating-model)
- [Guardrail principles](#guardrail-principles)
- [Rule layers](#rule-layers)
- [Command architecture](#command-architecture)
- [Profiles](#profiles)
- [Evidence and blocking](#evidence-and-blocking)
- [Recommended repository shape](#recommended-repository-shape)
- [Adoption plan](#adoption-plan)
- [Copy, adapt, and reject](#copy-adapt-and-reject)

## Operating model

Repository Rules are authored in project context, architecture contracts, specifications, issue records, and documented tool contracts. Guardrails compile those rules into executable verification. Every execution context calls the same command family.

Repository Rules -> Human developer, AI agent, or CI -> standard guardrail command -> syntax, semantics, architecture, and delivery checks -> evidence record.

Prompt is a soft constraint. A Guardrail is a hard constraint. An agent must not be trusted to remember a rule that can be checked from the repository state.

## Guardrail principles

### One rule, one owner

Keep the normative rule in a project context, architecture contract, spec, or tool contract. A hook, CI workflow, and agent prompt may reference it, but must not create conflicting copies.

### One command, many adapters

Human developers, agents, Lefthook, CI, and release jobs invoke the same named commands. An adapter selects timing and scope; it does not reimplement verification logic.

### Fail at the earliest useful point

Run cheap deterministic checks before commit. Run checks that need a clean checkout, build artifacts, credentials, multiple operating systems, or external services in CI. Do not move a check earlier only to make the hook look comprehensive.

### Make invalid states observable

A guardrail must report the rule, the affected path or entity, the observed value, the expected value, and the repair command when one exists. Silent skips and blanket "fix it" messages are not acceptable.

### Separate repair from confirmation

A formatter may rewrite code. A generated-file command may regenerate output. A spec or translation confirmation must not be silently synthesized by a hook. Confirmation requires an explicit command and a reviewable diff.

### Re-run independently

Local success improves feedback but does not establish merge eligibility. CI runs from a clean checkout, validates the complete scope, and produces the required merge verdict.

## Rule layers

| Layer | Examples | Primary evidence |
| --- | --- | --- |
| Syntax | Formatting, parser validity, lint, typecheck. | Tool output and exit status. |
| Semantics | Unit behavior, integration behavior, docs pairing, generated freshness, spec consistency. | Tests, records, hashes, or generated diffs. |
| Architecture | Dependency direction, module boundaries, API ownership, database migration policy. | Graph checks, contract tests, migration dry runs. |
| Delivery | Artifact layout, license, dependency policy, secret scan, release install. | Clean artifact and environment checks. |

Project context feeds architecture contracts. A delta-spec describes intended change. Code implements it. Tests, docs, and external contracts provide independent evidence. Guardrails evaluate the resulting repository and artifact.

## Command architecture

The preferred layers are:

- a task runner or package scripts expose stable names such as `guard:fast`, `guard:commit`, `guard:push`, `guard:ci`, and `guard:release`;
- `scripts/verify/` or language-owned tools implement checks with structured diagnostics;
- Lefthook calls one or two aggregate commands and handles staged-file selection only where necessary;
- CI calls the same aggregate commands and adds environment-specific jobs;
- agent adapters call the same commands and parse their exit code and machine-readable report.

The example in `lefthook.example.yml` intentionally contains no policy logic. It delegates to `pnpm guard:commit` and `pnpm guard:push`. A Go repository can use `make guard-commit`; a Python repository can use `uv run guard commit`; the command name is an implementation choice, while the ownership rule is not.

## Profiles

### Language-agnostic core

Every repository profile should define formatting, linting, static typing where available, unit tests, integration tests, architecture checks, API contract checks, database migration checks, documentation consistency, i18n consistency, generated-file freshness, secret scanning, dependency policy, license policy, and release artifact verification. A profile may mark a category not applicable, but it must record that decision rather than silently omit it.

### Go profile

The Go implementation can map formatting to `gofmt`, static analysis to `go vet` and `golangci-lint`, tests to `go test`, and vulnerability evidence to `govulncheck`. Architecture and specification checks remain repository-owned scripts.

### Python profile

The Python implementation can map formatting and lint to Ruff, typing to `mypy` or `pyright`, and tests to `pytest`. FastAPI projects should add OpenAPI generation and contract tests to the API category.

### TypeScript profile

The TypeScript implementation can map formatting to Prettier, lint to ESLint or Oxlint, typing to `tsc`, and tests to Vitest or the repository's chosen runner. React projects should add browser or accessibility checks at the CI level when the user workflow is affected.

Tool choice is replaceable. The guardrail identifier, scope, blocking policy, and evidence schema are the stable interface.

## Evidence and blocking

Each check emits a result with a stable identifier, scope, command, tool version, start and end time, changed revision, status, and diagnostic locations. A passing local check is evidence for the local revision only. A CI result is evidence for the checked commit and environment.

Blocking rules are explicit. A check blocks a commit, push, pull request, merge, or release only when its matrix entry says so. Observational checks still publish results and must not be reported as passing blockers.

Exceptions require an owner, reason, expiry, affected guardrail, and an issue or decision record. "The agent could not make it pass" is not an exception reason.

## Recommended repository shape

Use the existing repository's natural task runner first. The following is a conceptual layout, not a required copy:

`guardrails/` owns rule manifests and result schemas.

`scripts/verify/` owns repository checks that are not language-tool configuration.

`specs/` owns accepted specifications and delta-specs.

`docs/engineering/` owns lifecycle, guardrail, architecture, and agent contracts.

`lefthook.yml` or an equivalent hook adapter contains only lifecycle-to-command mapping.

`Makefile`, `Taskfile`, `package.json`, or `pyproject.toml` exposes the stable command vocabulary for humans, agents, and CI.

Generated files declare their source and have a deterministic `--check` mode. A destructive or networked check must not run implicitly from a fast hook.

## Adoption plan

### Phase 1: basic code quality

Add format, lint, typecheck, and unit-test commands. Make local commands reproducible and make pre-commit run only the cheap deterministic subset.

### Phase 2: repository consistency

Add documentation links, generated-file freshness, API contracts, migration validation, i18n pairing, dependency policy, and license checks. Run full-scope variants in CI.

### Phase 3: architecture guardrails

Define dependency direction and module ownership. Add graph checks that fail on forbidden imports, layer violations, or package cycles. Keep architectural exceptions explicit and time-bound.

### Phase 4: specification-driven development

Require accepted specs and delta-specs for material changes. Validate changed files against the declared scope, link spec-test cases to acceptance criteria, and publish traceability evidence.

### Phase 5: AI-native development

Implement the Agent Completion Contract, machine-readable result reports, bounded automatic repair, independent re-verification, and a final completion summary that names every check and revision.

## Copy, adapt, and reject

### Copy

Copy DSH's separation of hook adapters from gate ownership, staged-versus-worktree awareness, explicit generated-file freshness, deterministic diagnostics, bounded concurrency, CI backstop, and stable required verdict.

### Adapt

Adapt the Git worktree-safe installer, aggregate gate scheduler, bilingual pairing record, generated-region rules, and release-shaped artifact checks only where the project has the same risk. Use Go, Python, or TypeScript tools behind the same guardrail identifiers.

### Do not copy

Do not copy the entire DSH gate inventory, Cordis-specific invariants, Session snapshot policy, package layout, or a large custom scheduler without measured need. Do not put dozens of shell commands into a hook file. Do not make a hash record stand in for semantic review.
