# Implementation Evidence - S04 Evidence and Claims

- Entry: PRD R001
- Spec: SPEC-R001-S04 / 2.1.0 / ae8af8dafa116a6df0c5519965bd8e57176202fe22c5e38562fccf8a3388bba8
- Status: implementation advanced in this round; NOT accepted. Structural checks pass; semantic Gold Set, independent QA and medical review are missing.
- Date: 2026-09-14
- Worktree: `plugins/med-research` on branch `medical-workbench`; no commit, push, PR or deployment performed.

## Changed files

- `packages/medical-contracts/src/research.ts` — `evidenceStatusSchema` gains `CONSISTENT`; `evidenceSchema` gains `matchedAnchors`, `unmatchedRanges`, `verificationReason`, `verificationVersion`, `verifiedAt`, `withdrawnAt`; new `textSpanSchema`.
- `packages/medical-contracts/src/services.ts` — `ClaimGateResult` becomes `CONSISTENT | INSUFFICIENT | CONFLICTING` with a `counts` block; `CitationMap` entries gain `pmid`/`doi`; `EvidenceComparisonRow` gains relation/source class/both statuses/withdrawn; `MedEvidenceService` gains `verify(..., options)`, `withdraw`, `chase`; new `ChaseInput`/`ChaseResult`/`ChaseHop`.
- `packages/medical-contracts/src/audit.ts` — audited actions gain `evidence.withdraw`, `reference.chase`.
- `packages/medical-domain/src/evidence-state.ts` — new `evidenceQualificationReasons` / `isQualifiedEvidence`: the single qualification rule.
- `packages/medical-domain/src/alignment.ts` — new `partitionMatchedSpans` and `MIN_MATCHED_SPAN_LENGTH`.
- `packages/plugin-evidence/src/service.ts` — rewritten around the domain rules; `PROJECT_NOT_FOUND`; PARTIAL anchoring and downgrade; `verify` provenance; `withdraw` propagation; claim gate via `verifyClaim`; citation map de-duplication; richer `compare`; `chase`.
- `packages/plugin-evidence/src/tools.ts` — `evidence_verify` gains relation/reason/verificationVersion; new `evidence_withdraw`, `evidence_chase`.
- `packages/plugin-evidence/src/config.ts` — `maxHops`.
- `packages/plugin-evidence/src/reader-actions.ts` (new) — S04 contributions to the S03 Reader registry.
- `packages/plugin-evidence/tests/lifecycle.spec.ts` (new, 16 cases).
- `packages/plugin-medical-ui/src/client/remote.ts`, `src/client/tool-names.ts`; `packages/medical-e2e/tests/*` expectations.

## Implemented behavior

- **Qualification (interfaces.md §Reader, Note and Evidence).** Qualified = not withdrawn, not `secondary_citation`, locator not `NOT_FOUND`, a `PARTIAL` must carry exact matched anchors, support `VERIFIED`, relation `SUPPORT`/`AGAINST`. Previously the gate required `locatorStatus === 'FOUND'` (wrongly excluding valid `PARTIAL`) and ignored `sourceType` entirely (wrongly admitting secondary citations).
- **Claim aggregate status.** `CONSISTENT` when exactly one side has qualified evidence, `CONFLICTING` when both do, `INSUFFICIENT` when neither; de-duplicated counts with `pending` and `secondary` reported separately. The gate decision itself now runs through the existing domain `verifyClaim` instead of a private reimplementation.
- **`VERIFIED` is not `SUPPORT`.** The gate requires a directional relation, and `verify` with relation `UNCERTAIN` keeps the support status at `PENDING` even when the caller asks for `VERIFIED`.
- **Verification provenance.** `verify` records reason, verifier version and time.
- **Withdrawal.** `withdraw` sets `withdrawnAt`, invalidates every claim binding the record (`INSUFFICIENT`, `PENDING`, `EVIDENCE_WITHDRAWN:<id>`) and returns every draft that referenced it to `DRAFT`.
- **Citation map.** Indices follow first appearance of each Evidence across support+counter, a repeated Evidence keeps one index, and each entry carries PMID/DOI and the focus anchor.
- **Reference Chasing.** Bounded by `maxHops`, driven only by a declared injected resolver, records every hop with source/identifier/status/reason, keeps a visited set, creates a NEW direct evidence on success, and never mutates the original secondary record.
- **Comparison.** Rows carry relation, source class, locator/support status, withdrawal flag, and study design only when the stored metadata reports it.

## Spec deviations

- `chase` needs a declared reference connector. The resolver is an injected capability; with none configured the call returns `UNRESOLVED` with an explicit reason instead of pretending. Wiring the live PubMed related-link connector is not done in this round.
- `compare` fills study design from persisted paper `publicationTypes` and outcome from the section title. Sample size and effect size are only emitted when the stored source reports them; both are empty otherwise, which the spec allows ("原文未报告为空").
- `Evidence.withdrawnAt` and the matched/unmatched spans are additive optional fields, so stored records from earlier domain versions remain valid; no domain version bump was needed.

## Minimal checks executed

```
cd plugins/med-research
pnpm exec vitest run packages/plugin-evidence
  → Test Files 2 passed (2) / Tests 29 passed (29)
     (tests/lifecycle.spec.ts 16 new cases: PARTIAL anchoring, PARTIAL downgrade,
      secondary exclusion, CONSISTENT counts, CONFLICTING, pending counts,
      verify provenance, UNCERTAIN → PENDING, NOT_FOUND never VERIFIED,
      withdrawal propagation, citation de-duplication, comparison rows,
      cross-project exclusion, chase resolved/unresolved/CHASE_LIMIT/no resolver)
pnpm exec vitest run packages/medical-domain
  → Test Files 7 passed (7) / Tests 49 passed (49)
pnpm exec vitest run packages/medical-e2e/tests/composition.spec.ts
  → Test Files 1 passed (1) / Tests 7 passed (7)
pnpm run typecheck
  → tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit (exit 0)
```

## Checks skipped

- Gold Set relocatability ≥98%, Relation Accuracy ≥0.85, Claim Support Precision ≥0.85, Unsupported Claim Rate 0 — no frozen dataset, no reviewer, no model credentials.
- Browser evidence for conclusion card, three-relation filter, Evidence Table, partial, source focus and narrow viewport — not executed.
- Real-API e2e — `DEEPSEEK_API_KEY` is not present in the environment or in a root `.env`.

## Known limitations / residual risk

- The semantic relation decision is still supplied by the caller/model; only the location and the state invariants are machine-checked. Relation accuracy therefore remains an unmeasured quantity until the Gold Set exists.
- `chase` has no live connector, so Reference Chasing is verifiable only against an injected resolver.
- The Evidence Table UI has not been re-checked against `asset/搜索研究.png`.

## Intentionally untouched

- Every other Spec package, the DSH checkout, the runner isolation implementation, and unrelated dirty worktree files.

## Formal verification evidence

None yet. `evidence/index.yaml` runs/artifacts/gates remain empty: no recorded run exists that a reviewer could independently replay. Acceptance stays `blocked`; this file is implementer self-test, not independent QA.
