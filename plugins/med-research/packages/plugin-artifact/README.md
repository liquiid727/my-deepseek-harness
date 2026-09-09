# @medresearch/dsh-plugin-artifact

English | [中文](README.zh.md)

## Summary

Run-linked artifacts (SPEC §38, Gate 5). Provides `ctx.medArtifacts` and registers `artifact_get` / `artifact_export`. `register` refuses any run that did not succeed and copies the produced file into a durable root, so every figure or table carries its `analysisRunId`, dataset hash, and code hash. In a Web composition it also registers the authenticated `GET /api/medArtifact.export` route, because artifact bytes cannot ride the JSON Remote envelope.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `artifactRoot` | required | Durable directory artifact files are copied into |

## Model Experience

`artifact_get` returns the artifact record; `artifact_export` returns base64 plus size for the artifact's own format. Neither invents a result for a failed run.

## Known Limitations and Deferred Work

- Export returns bytes for the stored format only; on-the-fly conversion (e.g. SVG→PNG) is not implemented.
- Figure registration accepts only `image/png` and `image/svg+xml`, matching the PRD chart export contract; unsupported figure MIME types fail with `FIGURE_FORMAT_UNSUPPORTED`.
- The download route exists only in a composition that provides `ctx.connection` (Web); other apps reach the bytes through the `artifact_export` tool.
