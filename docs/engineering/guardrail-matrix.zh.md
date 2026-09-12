# Guardrail 矩阵

[English](guardrail-matrix.md) | 中文

## Summary

本矩阵把每项 guardrail 分配给能提供有用反馈的 lifecycle context，以及必须阻止交付的 context。“Conditional”表示仓库拥有该 surface，或 change scope 激活该检查时才运行。

## Table of Contents

- [矩阵](#matrix)
- [策略](#policy)
- [语言 profile](#language-profiles)
- [证据契约](#evidence-contract)

## Matrix

| Guardrail | Local | Pre-commit | Pre-push | CI / PR | Blocking |
| --- | --- | --- | --- | --- | --- |
| Format | editor 与 changed file | Yes，safe repair | Optional | Yes，whole scope | Commit 和 CI |
| Lint | changed file | Yes，fast rule | Optional | Yes，full rule | Commit 和 CI |
| Typecheck | editor 或 focused package | No | Yes | Yes，clean checkout | Push 和 CI |
| Unit test | focused test | No | Conditional | Yes | CI；快速且稳定时 push |
| Integration test | 成本低时 focused | No | Conditional | Yes | CI |
| Architecture | targeted graph query | Conditional | Conditional | Yes，full graph | CI；确定时提前 |
| API contract | local schema generation | No | Conditional | Yes，schema 与 consumer | CI |
| DB migration | local dry run | No | Conditional | Yes，forward 与支持的 rollback | CI |
| Spec consistency | changed spec 与 delta | Conditional | Conditional | Yes，complete traceability | CI |
| Docs consistency | changed docs | Yes，staged 时 | Conditional | Yes，link 与 structure | Commit 和 CI |
| i18n | changed pair | Yes，staged record | No | Yes，full corpus | Commit 和 CI |
| Secret scan | fast 时 changed file | No | No | Yes | CI |
| Dependency | manifest 与 lockfile | No | Conditional | Yes，policy 与 vulnerability scan | CI |
| Generated files | source-owned output | Yes，safe regeneration | No | Yes，deterministic freshness | Commit 和 CI |
| License | local manifest query | No | No | Yes | CI 和 release |
| Security | focused test | No | No | Yes，complete scan | CI 和 release |

## Policy

低于一秒的 check 通常应运行在 editor 或 pre-commit。一到五秒的 check 在确定且限定 changed file 时可以放在 pre-commit。五到三十秒通常放在 pre-push 或 focused local command。超过三十秒、联网 check、大型 integration suite、E2E、security scan、dependency scan 和 release build 放在 CI，除非项目测量证明有可靠的 local variant。

矩阵是 policy artifact，不是某个 Lefthook file 的复制品。Hook 可以选择 pre-commit 列的一部分，CI 也可以把一列拆到多个 job。Guardrail identifier 和 result schema 必须在这些 adapter 之间保持稳定。

Blocking 按 lifecycle 评估。Non-blocking observational check 仍要报告 status，不能作为 blocking check 已通过的证据。缺失 environment 必须产生有 policy 许可的显式 self-skip，或 loud failure；required check 禁止 silent skip。

## Language profiles

| Profile | Format | Lint and static analysis | Typecheck | Tests | Security and dependency |
| --- | --- | --- | --- | --- | --- |
| Go | `gofmt` | `go vet`、`golangci-lint` | Go compiler 和 package build | `go test` | `govulncheck` 和 repository scan |
| Python | Ruff format 或 Black | Ruff | `mypy` 或 `pyright` | `pytest` | `pip-audit` 或 approved scanner |
| TypeScript / React | Prettier | ESLint 或 Oxlint | `tsc` | Vitest 和 browser test | approved npm scanner 和 secret scan |

Tool 可以替换。核心标准是 category、scope、evidence 和 blocking policy。

## Evidence contract

每项 guardrail result 都应包含 identifier、revision、scope、command、tool version、status、duration 和 diagnostic location。CI 还应记录 operating system、runtime version、dependency installation mode，以及适用时的 artifact identity。

Merge gate 只消费 blocking result。Release gate 消费 release profile 要求的精确 artifact check。Agent completion report 使用同一组 result identifier，并区分 passed、failed、skipped、not-applicable 和 not-run。
