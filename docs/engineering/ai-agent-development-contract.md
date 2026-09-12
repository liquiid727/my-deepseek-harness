# AI Agent Development Contract

English | [中文](ai-agent-development-contract.zh.md)

## Summary

An AI coding agent may announce completion only after it has run the checks required by the change scope, captured their results, and rechecked the final revision. Prompts guide the agent; executable guardrails decide whether the repository state is acceptable.

## Table of Contents

- [Completion contract](#completion-contract)
- [Agent execution loop](#agent-execution-loop)
- [Required evidence](#required-evidence)
- [Scope classification](#scope-classification)
- [Failure and repair](#failure-and-repair)
- [Completion message](#completion-message)
- [Security and authority](#security-and-authority)

## Completion contract

Before saying a task is complete, the agent must:

1. identify the changed files and the applicable guardrail profile;
2. run formatting or confirm that no formatter applies;
3. run lint and static checks;
4. run typecheck where the language supports it;
5. run focused tests and the required broader test tier;
6. run architecture and dependency-direction checks for structural changes;
7. run specification, delta-spec, and traceability checks for spec-governed changes;
8. run docs, i18n, and generated-file checks for documentation or generated changes;
9. inspect the final diff and repository status;
10. report commands, revisions, pass/fail status, and unverified items.

An agent must not report "completed" when a required check failed, was skipped without an approved exception, or was not run. It may report an explicit partial result and the blocking diagnostic.

## Agent execution loop

The standard loop is:

1. Read project context, architecture contracts, the accepted spec or issue, and local instructions.
2. Classify the change as code, docs, generated output, API, database, architecture, security, or release work.
3. Run a baseline check when the existing tree may already be red.
4. Make the smallest coherent change within the declared scope.
5. Run automatic repair only for tools whose repair policy is explicit.
6. Run the scoped guardrail command.
7. Read the failure as data, repair the owning source, and rerun the check.
8. Run the lifecycle aggregate that represents the completion claim.
9. Review the final diff for accidental changes and record residual risk.

Agent writes code -> guardrail command -> failure diagnostics -> agent repair -> independent recheck -> evidence -> completion claim

The recheck must execute the command again. An agent must not infer a pass from a successful edit or from a test that does not cover the changed contract.

## Required evidence

| Change category | Minimum evidence | Completion blocker |
| --- | --- | --- |
| Ordinary source change | Format, lint, typecheck, focused tests, final diff. | Any required failure. |
| Public API change | Ordinary evidence plus API schema and contract tests. | Schema drift or missing consumer update. |
| Architecture change | Ordinary evidence plus dependency graph and architecture contract check. | Forbidden dependency or undocumented exception. |
| Database change | Migration validation, forward apply, rollback or supported downgrade evidence, and integration test. | Unsafe or unreproducible migration. |
| Documentation change | Link, wrap, structure, i18n pairing, generated freshness, and doc-site checks where published. | Missing counterpart, stale record, or dead link. |
| Generated file change | Generator `--check` or deterministic regeneration and source review. | Hand-edited stale output. |
| Security-sensitive change | Focused security tests, secret scan, dependency scan, and review evidence. | Unreviewed security result or exposed secret. |
| Release change | Build, pack, clean-install, artifact smoke, and release metadata verification. | Artifact cannot be installed or verified. |

The agent records command output or a compact result reference. "Tests pass" without command names and scope is insufficient.

## Scope classification

A change that touches only a local implementation can use the smallest applicable checks. A change that crosses packages, public APIs, persisted data, security controls, generated files, or user-visible workflows expands the evidence set. A mixed change uses the union of affected categories.

Project context defines global constraints. An architecture contract defines permitted dependencies and ownership. A delta-spec defines the intended change. A spec-test maps acceptance criteria to executable tests. Issues provide defect identity and regression scope. Guardrails check that code, tests, docs, and contracts remain aligned.

## Failure and repair

Failures are blocking when the matrix marks them blocking. The agent may retry a flaky external check only under a bounded policy and must report the original failure and retry result. It must not weaken a check, delete a test, widen an exception, or re-record a hash merely to make the command green.

Automatic repair is allowed for formatting, safe imports, and deterministic generated outputs when the command states exactly what it changes. It is not allowed to silently rewrite acceptance criteria, architecture contracts, API schemas, database history, translations, or security findings.

When the baseline is already red, the agent separates pre-existing failures from new failures, proves that its change does not add a new failure where possible, and reports the remaining baseline blocker. It must not call the task complete if the task's own required evidence is missing.

## Completion message

The final report should state the implementation result first, then the evidence. It should name the changed scope, commands run, pass/fail status, baseline blockers, and unverified environments. A useful claim is: "Implemented X; format, lint, typecheck, focused tests, and architecture checks passed on revision Y. CI and Windows remain unverified." An unsupported claim is: "Done; it should work."

## Security and authority

Guardrails do not grant an agent authority to publish, merge, delete data, expose credentials, or change policy. The agent still needs explicit authorization for external writes and destructive operations. A green local guardrail is evidence of repository state, not permission to ship.
