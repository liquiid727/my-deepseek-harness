# DSH Lefthook and Repository Gate Analysis

English | [中文](dsh-lefthook-analysis.zh.md)

## Summary

This document reverse-engineers the current DeepSeek Harness repository controls. It separates observed implementation from architectural inference and from recommendations for a language-agnostic Repository Guardrails system.

## Table of Contents

- [Scope and evidence](#scope-and-evidence)
- [Execution architecture](#execution-architecture)
- [Hook inventory](#hook-inventory)
- [Translation pairing architecture](#translation-pairing-architecture)
- [Fast feedback and strong validation](#fast-feedback-and-strong-validation)
- [DSH-specific and reusable practices](#dsh-specific-and-reusable-practices)
- [Ten lessons worth learning](#ten-lessons-worth-learning)
- [Findings and limits](#findings-and-limits)

## Scope and evidence

The primary evidence is `lefthook.yml`, `package.json`, `scripts/install-lefthook.mjs`, `scripts/run-gates.ts`, the translation-pairing scripts and tests, and the pull-request workflows under `.github/workflows/`. The current checkout also has pre-existing dirty changes; those changes are not treated as part of this analysis.

Fact: the configured local hooks are `pre-commit`, `pre-merge-commit`, and `pre-push`. No `commit-msg`, `post-checkout`, or `post-merge` job is declared in the checked-in Lefthook configuration.

Inference: DSH intentionally keeps hook work small and moves repository-wide validation into named package scripts and the gate runner. The comment at the top of `lefthook.yml` states that CI owns the full repository-wide matrix.

Unknown: this repository does not prove that every contributor has installed the hooks, or that a developer's global Git hook manager does not add other hooks. CI is therefore the authoritative backstop.

## Execution architecture

The current execution chain is: Git command -> Git hook selected by Git -> worktree-local `core.hooksPath` at `.git/dsh-hooks` -> generated Lefthook launcher -> `lefthook run <hook>` -> commands in `lefthook.yml` -> scripts and package commands -> exit status returned to Git.

For a normal commit, the concrete chain is:

`git commit` -> `pre-commit` -> staged translation records, archived notes, staged Oxlint, generated notices, whitespace, and vendor manifest -> successful hook permits the commit.

For a merge commit, `pre-merge-commit` repeats the two merge-sensitive checks: staged translation records and archived agent notes. The merge driver runs earlier during Git's file merge and is installed by `scripts/install-lefthook.mjs`.

For a push, the chain is intentionally one aggregate command: `pre-push` -> `pnpm run typecheck` -> push proceeds only on exit status zero. DSH does not put its complete CI matrix in the push hook.

The installation chain is `pnpm install` -> root `postinstall` -> `node scripts/install-lefthook.mjs` -> Git/worktree safety checks -> worktree-local `core.hooksPath` -> `lefthook install --force`. In CI, the installer returns before Git discovery or mutation when `CI=true` or `GITHUB_ACTIONS=true`.

The installer also creates an ownership marker, uses an installation lock, refuses to overwrite unowned hook paths, preserves existing common hooks, and installs the `dsh-translation-pairing` merge driver. These behaviors are in `scripts/install-lefthook.mjs`, not in `lefthook.yml`.

## Hook inventory

| Hook | Purpose | Trigger and scope | Commands | Failure behavior | CI equivalent | Cost posture |
| --- | --- | --- | --- | --- | --- | --- |
| `pre-commit` | Reject or repair cheap staged inconsistencies before a commit is created. | Every commit; mostly staged files, with repository checks for archived notes and vendor state. | `verify-translation-pairing --cached`, archived-note verification, staged Oxlint with safe fixes, third-party notice regeneration, `git diff --cached --check`, vendor manifest check. | Non-zero command blocks the commit; safe lint fixes are staged. | `doc-sync`, static CI, test assertions, and the primary CI aggregate cover the corresponding repository rules. | Fast enough for the local loop; no full test or build. |
| `pre-merge-commit` | Prevent a merge commit from recording invalid staged pairing records or archived notes. | Git-created merge commit; staged index. | Cached translation pairing and archived-note verification. | Non-zero command prevents the merge commit while leaving the merge result available for repair. | Full `doc-sync` and CI static validation. | Small, because the merge result is already expensive to produce. |
| `pre-push` | Catch the most useful local type contract failure before remote work is published. | Every push; whole TypeScript project through the package script. | `pnpm run typecheck`. | Non-zero command blocks the push. | `check:ci`, static CI, Node compatibility, and artifact consumers run type checks in wider contexts. | Medium; deliberately below build, coverage, browser, and full integration cost. |
| `commit-msg` | No repository-owned implementation found. | Not configured by DSH. | None. | Git does not receive a DSH policy from this repository. | Issue and PR policy checks exist in CI, but no commit-message equivalent was found. | UNKNOWN. |
| `post-checkout` | No repository-owned implementation found. | Not configured by DSH. | None. | No DSH action. | No equivalent found. | UNKNOWN. |
| `post-merge` | No repository-owned implementation found. | Not configured by DSH. | None. | No DSH action. | No direct equivalent found. | UNKNOWN. |

The generated launcher supports `LEFTHOOK=0`, which bypasses Lefthook locally, and `LEFTHOOK_VERBOSE`, which prints shell tracing. Those are local execution controls, not evidence that a change passed validation.

## Translation pairing architecture

### Pair identity

For an English document `foo.md`, `translationPairPaths()` derives exactly three sibling paths: `foo.md`, `foo.zh.md`, and `foo.i18n.yaml`. Discovery is active under `docs/`, `.agents/notes/`, `python/`, non-vendor README files, and selected root documents. The checked-in `scripts/translation-pairing.manifest.json` contains explicit exclusions.

### The sidecar record

The `.i18n.yaml` file is a small consistency record, not a translation database. It contains exactly two non-comment records: the basename of the English file and the basename of the Chinese file, each followed by a 40-character Git blob hash. The comments explain that the hashes represent the last confirmed-consistent state and that both languages have equal authority.

The record uses Git blob hashes rather than commit hashes. `gitBlobHash()` hashes `blob <byte length>\0` plus the exact bytes, matching `git hash-object`. This permits a pair to be confirmed while its files are still uncommitted and makes the record independent of branch history.

### What "last confirmed-consistent state" means

The verifier reads the current worktree or, for `--cached`, the stage-zero Git index. It computes the current blob hash of each side and compares it with the two hashes in the sidecar. A mismatch produces the observed "content no longer matches the pair's last confirmed-consistent state" error.

`--write <pair>` does not translate either document. It stores the exact current bytes in the local Git object database, writes the two resulting hashes into the sidecar, and requires an explicit pair argument or `--all`. The stored objects are also pinned below `refs/dsh/translation-pairing/snapshots/` by the Git adapter so the recovery pointer is not immediately lost to garbage collection. The command therefore records a reviewed state; it does not prove translation quality.

### Structural verification

The implementation parses both Markdown files with `mdast-util-from-markdown`, GFM extensions, and `mdast-util-gfm`. It does not compare rendered HTML and it does not use text equality for prose.

The AST traversal records these signatures in document order:

- heading depth, so an H2 versus H3 divergence is reported as `heading (depth)`;
- fenced code block language, metadata, and body verbatim;
- table row and column counts;
- list kind, ordered-list start, and direct item count;
- semantic link targets, excluding the language-switcher link.

Heading-depth comparison is an ordered array comparison of Markdown AST heading nodes. Code-block comparison is an ordered comparison of the normalized fence info string and exact code body emitted by the AST node. "Out of sync" has two meanings in the implementation: the sidecar hash is stale, or one of the current pair rules fails. The latter includes missing files, wrong locale links, missing switchers, malformed generated regions, generated-region drift, and a structural signature difference.

The verifier also requires the Chinese side to link back to the English side and, for authored English documents, requires the reciprocal English-to-Chinese switcher. Generated English sources are explicitly exempt because adding a switcher would make their generator stale. Ordinary relative links to another active bilingual document must point to the matching locale.

Generated regions are partitioned by strict `BEGIN GENERATED` and `END GENERATED` markers. The two sides must have equal region counts and byte-identical normalized region text. This is a separate protection for generated content in addition to the whole-document AST signature.

### Staged records and hook placement

`--cached` means "read the exact stage-zero index bytes." The hook passes staged `.i18n.yaml` paths to the verifier, so it checks the content that would enter the commit rather than an unrelated unstaged worktree edit. The cached mode is read-only and rejects `--write`; hooks never silently bless a drifted pair.

The hook runs this check because a pairing record is part of the commit's three-file unit and the feedback is cheap. CI runs the corpus-wide `verify-translation-pairing` again through `doc-sync`, because a staged-file hook cannot discover every pre-existing pair problem and hooks can be absent or bypassed. The CI check is therefore authoritative for merge eligibility.

### Merge driver

The installer registers `merge.dsh-translation-pairing` in worktree-local Git configuration. The shell driver launches `scripts/translation-pairing-merge.ts`. The driver composes sidecar records only when Git's default text merge succeeds for both owner-blob triplets and the merged pair still satisfies switcher and structural checks. Otherwise it leaves an ordinary conflict. `resolve-translation-pairing-conflicts` applies the same fail-closed logic to a stopped merge and stages safe results.

### Design limits

The gate proves byte identity with a previously confirmed state and mechanical Markdown correspondence. It cannot determine whether an English sentence and its Chinese translation have the same meaning, whether terminology is natural, or whether the pair is factually correct. A reviewer can confirm a bad translation with `--write`; the system deliberately keeps semantic translation quality outside the hash gate.

## Fast feedback and strong validation

| Level | DSH evidence | Role in a general system |
| --- | --- | --- |
| L0 Editor | Formatter integrations, type-aware editor diagnostics, and targeted test commands are available through repository scripts; no single editor protocol is enforced by this repository. | Immediate syntax and local semantic feedback. |
| L1 Pre-commit | Staged translation pairing, archived notes, staged Oxlint, generated notices, whitespace, and vendor manifest. | Cheap deterministic checks and safe regeneration. |
| L2 Pre-push | Whole-project typecheck. | Medium-cost contract validation before publication. |
| L3 CI / PR | Static rules, lint, duplication, coverage, compatibility, snapshots, docs, build, artifacts, browser tests, Python runtime checks, and Windows lanes. | Independent full validation on clean checkout and multiple environments. |
| L4 Merge gate | `all-checks-passed` fails on failure, cancellation, or skipped required jobs. | Branch protection consumes one stable verdict rather than a changing matrix list. |
| L5 Release | Pack, dependency-layout, packed-install, native runtime, and publish verification workflows. | Prove the artifact users will install, not only the source tree. |

The `run-gates.ts` scheduler is the reusable middle layer. It owns named modes, dependency edges, bounded concurrency, output attribution, and fail-fast process-tree cleanup. CI workflow YAML selects the mode; it does not repeat the leaf inventory.

## DSH-specific and reusable practices

DSH-specific mechanisms include Cordis catalog freshness, Session format and snapshot rules, branded package invariants, worktree-local hook ownership, the translation-pairing merge driver, and generated catalogs tied to DSH package structure.

Reusable engineering patterns include a single command vocabulary, staged versus worktree-aware validation, generated-file freshness checks, explicit dependency graphs, bounded concurrency, fail-closed merge verdicts, independent CI execution, and a distinction between automatic repair and confirmation.

The part not worth copying is the exact package inventory or the assumption that a large custom TypeScript gate runner is necessary in every repository. A small project should keep the same ownership model with a smaller task runner and fewer checks.

## Ten lessons worth learning

1. Keep hook configuration thin and put policy in reusable commands.
2. Run staged checks against the exact index bytes that the commit will contain.
3. Let CI repeat local rules from a clean checkout because hooks can be missing or bypassed.
4. Separate automatic repair from explicit confirmation of semantic state.
5. Use stable guardrail identifiers even when jobs or tools are split across platforms.
6. Make generated outputs deterministic and provide a freshness check.
7. Model gate dependencies explicitly instead of hiding them in shell ordering.
8. Bound concurrency and preserve attributable diagnostics.
9. Make the merge verdict fail on failure, cancellation, or skipped required work.
10. Keep domain-specific checks behind general execution patterns.

## Findings and limits

The strongest DSH design choice is not Lefthook. It is the separation between policy, named commands, schedulers, and execution contexts. Lefthook is one adapter for the local context; CI invokes the same policy through aggregate commands.

The most important guardrail gap is universal to Git hooks: local hooks are advisory because they can be disabled, missing, or installed against a stale checkout. DSH addresses this with repeated CI validation and a stable required verdict. A future Repository Guardrails system should preserve that property and add explicit provenance for each completion claim.

This analysis did not find repository-owned secret scanning, dependency vulnerability scanning, database migration checking, or generic API contract checking in the Lefthook/CI surfaces inspected. They are marked as recommendations in the companion matrix, not as current DSH capabilities.
