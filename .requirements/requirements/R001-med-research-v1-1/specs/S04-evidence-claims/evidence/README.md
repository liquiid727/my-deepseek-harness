# Evidence

Evidence is the verification and quality record for this Spec Package.

- `implementation.md` records what implementation changed, minimal checks,
  deviations, skipped checks, limitations, and intentionally untouched areas.
- `plans/`, `runs/`, `gates/`, and `artifacts/` hold independent Test Design
  execution and normalized outputs.
- `index.yaml` makes evidence addressable and binds it to `consumer_entry`, Spec
  version, revision, environment, result, and available correlation identifiers
  (`run_id`, `service_id`, `session_id`, and `trace_id`).

Evidence supports review and acceptance; it does not itself make a QA decision.
