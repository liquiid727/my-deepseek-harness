# GoalSpec Templates

These templates are the canonical source for new Requirement Workspaces. Copy
the root files into `.requirements/requirements/R0NN-<slug>/`, then copy the
`spec-package/` directory once for every `S0N-<slug>` delivery unit.

```text
R0NN/
├── prd.md
├── index.yaml
├── acceptance.md
└── specs/S0N/
    ├── spec.md
    ├── test.md
    ├── review.md
    ├── acceptance.md
    ├── issues/ISSUE-R0NN-S0N-NNN-<slug>.md
    └── evidence/
```

## Stable IDs

| Layer | Format |
|---|---|
| Requirement Workspace | `R0NN` |
| Product Requirement | `REQ-R0NN-NNN` |
| Business Rule | `BR-R0NN-NNN` |
| Invariant | `INV-R0NN-NNN` |
| Edge Case | `EDGE-R0NN-NNN` |
| Acceptance Criterion | `AC-R0NN-NNN` |
| Spec Package | `S0N` |
| Contract Behavior | `SPEC-R0NN-S0N-NNN` |
| Test | `TEST-R0NN-S0N-NNN` |
| Issue | `ISSUE-R0NN-S0N-NNN` |
| Review Finding | `REVIEW-R0NN-S0N-NNN` |
| Evidence (optional) | `EV-R0NN-S0N-NNN` |

IDs are permanent anchors. Do not reuse, renumber, or silently change their
meaning after approval. `primary_spec` is the single owner of an Issue;
`covers` expresses additional traceability only.

## State boundaries

- `prd.md` and `index.yaml` describe product and package lifecycle.
- `spec.md` describes the executable system contract; it does not contain TEST
  IDs, test data, coverage matrices, or execution results.
- `test.md` describes planned verification, never final results.
- `issues/*.md` describes executable work and its Completion Record.
- `evidence/` stores immutable execution results.
- child `acceptance.md` records QA for one Spec Package.
- root `acceptance.md` aggregates required child decisions and PRD AC/UAT.

There is no legacy template path. New work uses the v2 root files and one
`spec-package/` directory per independently deliverable Spec Package.

## Contract Fields

- `source_spec` and `source_test` are relative file paths; stable contract
  identity is carried by `source_spec_id` and `source_test_id`.
- `source_*_version` and `source_*_hash` bind downstream artifacts to the
  approved source. A `pending-*` hash is not release eligible.
- Spec behaviors must name a public seam, observable result, error behavior,
  side effects, observability, risk tier, required evidence, and gate impact.
- Test scenarios must name setup/data/environment, concrete Given/When/Then
  assertions, evidence, and gate impact. `test.md` never contains final
  execution results.
- Implementation Issues include code changes plus only the focused validation
  they declare. Verification Issues own independent test assets, normalized
  evidence, and release-gate execution. Every Issue has one `primary_spec` and
  executable Acceptance Criteria.
- Every Issue declares a change profile. Semantic work records an `Execution
  Preflight` with real consumers/entry paths and an affected-surface matrix;
  Completion Records state alternatives, skipped checks, verified behavior,
  residual risk, and intentionally untouched areas. See
  `rules/shared/change-discipline.md`.
- Agent sections are conditional. Include Agent metrics, Dataset/version,
  thresholds, trajectory signals, degradation, and human handoff only when the
  PRD/Spec declares Agent behavior or `qualityProfile: agent-workflow`.
- Core product traceability and acceptance fields are mandatory. Performance,
  security, migration, compatibility, dependency, and other conditional
  sections must be completed when applicable or state `Not applicable` with a
  rationale.
- `EV-*` is optional; `evidence/index.yaml`, run IDs, and immutable paths are
  still required for all formal evidence.
