# Implementation Evidence — S07 Skills Center and Builder

- Entry: PRD R001
- Spec: SPEC-R001-S07 / 1.1.0 / 78241219a2ecbbd97a16157304b6c926e17babc882a93908131fa3bbecc49b0a
- Status: implementation advanced in this round; NOT accepted. The lifecycle, audit trail and permission re-confirmation now exist; browser evidence, independent QA and medical review are missing.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/plugin-skills/src/service.ts` — inventory with derived `updateAvailable` / `revoked`, validation depth, controlled test runs with cancellation, publish, install (disabled by default), enable/disable, upgrade with permission re-confirmation, uninstall, revoke, draft deletion, and an audit trail over the shared `AuditWriter`.
- `packages/medical-contracts/src/audit.ts` — the full skill audit action set plus `AUDIT_ACTIONS_REQUIRED_BY_SKILLS`.
- `packages/medical-storage/src/audit.ts` — the writer validates every row against `auditLogSchema` before writing.
- `packages/plugin-skills/tests/lifecycle.spec.ts` (new), `tests/support.ts` (new).
- `packages/medical-storage/tests/audit-validation.spec.ts` (new).
- `packages/medical-e2e/tests/remote-surface.spec.ts` — pinned skills surface updated.

## Implemented behavior

- **Full lifecycle (SPEC-R001-S07-004).** `upgrade` refuses to move an installation to a version that adds tools, file scope, automatic triggers, or model egress unless the caller explicitly re-confirms; the check is `computeWidening(current, target)` and the refusal is a distinct error. `revoke` marks a published version unusable so new installs and new invocations fail, an already-revoked version cannot be installed or upgraded to, and history is kept. `uninstall` removes only the Workspace membership. `deleteDraft` cannot delete a published version's history.
- **Audit (SPEC-R001-S07-004).** save-draft, validate, test, publish, install, enable, disable, uninstall, upgrade, revoke and delete-draft each append an audit row with actor, source and target version, permission diff, decision, and the installation/project scope.
- **Audit integrity — a real defect fixed.** The skill service previously cast an arbitrary string to `AuditAction` (`action as AuditAction`) and the storage domain does not enforce a table's value schema on write, so an action outside the contract was **silently stored**. Two fixes: the audit action enum now lists the full skill set and exports `AUDIT_ACTIONS_REQUIRED_BY_SKILLS`, the service types its audits as `AuditAction` so drift is a compile error, and the audit writer validates each row through `auditLogSchema` before writing so an undeclared action is rejected. `tests/audit-validation.spec.ts` pins both the accept and reject paths.
- **Inventory (SPEC-R001-S07-001).** `browse` returns each definition with its derived state, including `updateAvailable` computed by comparing the installed version against the catalog version rather than stored as an override, and `revoked`.
- **Validation depth (SPEC-R001-S07-002).** Required name/description/semantic version/instructions, JSON-Schema-2020-12 schemas with remote `$ref` rejected, examples checked against the schemas, knowledge references limited to the authorized workspace scope, and unknown tool or model rejected at validation time.
- **Controlled test (SPEC-R001-S07-003).** `test` runs against a temporary non-activated registry, `cancelTest` releases the in-flight run through its `AbortController`, and neither can change installation or activation state.

## Spec deviations

- The controlled test executes through a temporary trace-only registry; it does not yet run a real model call, so its "output" is schema-valid shape rather than a genuine skill product.
- The 13 built-in definitions are catalog data; their semantic quality is owned by the business Specs and is not verified here.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-skills
  → Test Files 1 passed (1) / Tests 23 passed (23)
pnpm exec vitest run packages/medical-storage
  → Test Files 3 passed (3) / Tests 16 passed (16)
pnpm run typecheck
  → exit 0
```

## Checks skipped

- Browser evidence for the three-column skills workbench at 1672×941, 1440×900 and 390×844 against `asset/skill工作台.png` — not executed.
- The 13 built-in skills' business acceptance, which belongs to S02/S03/S04/S05/S08 and needs a medical reviewer.
- Independent QA.

## Known limitations / residual risk

- Without a model credential the controlled test cannot exercise a real skill invocation, so "test a draft" is verified as isolation and state discipline rather than as skill output quality.
- Permission re-confirmation is enforced in the service; the confirmation dialog flow in the client was not re-verified in a browser.

## Intentionally untouched

- The DSH skill capability and loader, the business packages, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty. Acceptance stays `blocked`.
