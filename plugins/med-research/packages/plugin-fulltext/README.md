# @medresearch/dsh-plugin-fulltext

English | [中文](README.zh.md)

## Summary

Full-text resolution for the Med Research Workspace. Provides `ctx.medFulltext`; `paper_resolve_fulltext` is the model-facing caller. V1 resolves the machine-readable channel from a paper's PMCID and falls back to `abstract_only` or `unavailable`; it never claims a channel it did not check.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `europePmcBaseUrl` | `https://www.ebi.ac.uk/europepmc/webservices/rest` | Europe PMC REST base |
| `timeoutMs` | `30000` | Request deadline |

## Model Experience

No tool of its own. It returns a `FulltextResolution`; `unavailable` is a real outcome and is never rendered as an error.

## Known Limitations and Deferred Work

- Only the Europe PMC `fullTextXML` channel is checked; the NCBI PMC OA package, Unpaywall, OpenAlex, and publisher channels are P1 (SPEC §21).
- No license metadata is returned yet; the parsing layer records the license when a source provides one.
- The resolver performs one GET per call; no caching is applied.
