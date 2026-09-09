# Remote surface namespace drift

## Finding

The SPEC §30 summary table names `medResearch/planQuery | search | get |
papers`, while the same SPEC's service map (§5/§6) and the PRD use
`ctx.medLiterature`, `literature_*`, and a separate `medPapers` service. The
implemented services and compatibility tests follow that consistent map:

```text
medLiterature/planQuery | search | getPaper
medPapers/get | document | sections | paragraph | resolveFulltext | upload | search
```

## Decision status

This is a source-document inconsistency, not an implementation omission. No
alias is added: exposing both namespaces would create two model-visible routes
for the same capability and would violate the single canonical tool/service
surface. The SPEC/PRD owner must choose whether §30's `medResearch` row is a
typo or whether the service namespaces should be renamed before a generated
Typert surface is treated as final.

## Evidence

- [`docs/spec/med-research-workspace-ultimate-spec-v1.1.md`](../spec/med-research-workspace-ultimate-spec-v1.1.md#30-remote)
- [`packages/medical-contracts/src/services.ts`](../../packages/medical-contracts/src/services.ts:125)
- [`packages/medical-e2e/tests/remote-surface.spec.ts`](../../packages/medical-e2e/tests/remote-surface.spec.ts:33)
