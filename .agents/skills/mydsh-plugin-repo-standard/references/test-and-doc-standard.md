# Test and documentation standard

## Test matrix

| Surface | Spec | What it must prove |
| --- | --- | --- |
| Mapping and request shaping | `tests/<name>.spec.ts` | Valid response maps to the published result type; malformed or empty entries are dropped; the outgoing request carries the documented method, URL, headers, and body |
| Credential resolution | `tests/<name>.spec.ts` | The `apiKeyEnv` path, the credentials-service path, and the missing-credential message naming the reference |
| Error classification | `tests/<name>.spec.ts` | Provider failure maps to the seam's error code; cancellation maps to the abort code |
| Redirect refusal | `tests/redirect.spec.ts` | A real local HTTP server returns a cross-origin `Location` and the request fails instead of following it |
| Settings | `tests/settings.spec.ts` | Section read and write change what the next operation reads; disposing the registration removes the section |
| Live provider | `tests/<name>.e2e.ts` | A real API call succeeds with a key and self-skips without one |

Rules:

- A mocked fetch cannot observe redirect handling or header forwarding; prove those against a real server.
- Tests describe behavior, not correctness. A behavior change updates its tests in the same change.
- Prefer the consumer's real entry point over a hand-built registration when the surface is end-to-end.
- Keep ports, temporary paths, and child processes owned by the spec so parallel runs stay isolated.

## Package README contract

Each package ships `README.md`, `README.zh.md`, and `README.i18n.yaml` and must contain:

- **What it is and which seam it fills** — capability, role, and the config key that activates it.
- **Config table** — every key, its default, and what it changes.
- **A paste-ready patch snippet** — the exact `cordis.patch.yml` rows a deployment adds.
- **Model Experience** — what the model sees, the token cost, and any KV-cache effect.
- **Known Limitations and Deferred Work** — what does not work, and what was deliberately left out.
- **Non-obvious constraints** — a reused settings namespace, a required deployment precondition, or a sandbox limitation.

## Repository documents

- Write a development record under `docs/` **before** implementing: the investigation, the seam, the design, and the alternatives considered. `dsh-plugins/docs/` holds four examples of this record (search provider, consumer bridge, registry provider, session plugin).
- Keep the record current with what shipped. A record that describes an abandoned design is worse than no record.
- Register the plugin in the root `README.md` plugin table with capability, role, one-line description, and doc link. An unregistered plugin is not complete.
- A non-trivial plugin adds a decision record in the host repository's note tree when the host has one; follow the host's own format rather than inventing one.

## Finish

Before declaring the plugin done, each affected surface needs its own evidence, and the report separates what was run, what was deliberately not run, and what remains risky. [mydsh-development-practices](../../mydsh-development-practices/SKILL.md) owns that reporting discipline.
