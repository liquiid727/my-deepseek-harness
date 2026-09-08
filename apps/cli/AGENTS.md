# AGENTS.md — CLI application

`apps/cli` publishes the `dsh` executable and owns profile loading, process launch, web serving, and CLI-facing integration tests.

- Keep CLI argument parsing and process lifecycle behavior here; reusable capabilities belong in `packages/`.
- Source launches use the repository's ESM `tsx` entrypoint. Built-bin tests execute the packaged `lib/` output and must remain representative of published files.
- A profile or `cordis.yml` change must declare every bare plugin in the manifest used to resolve it. Validate composition through the Loader and app boot path.
- Real API tests may self-skip without `DEEPSEEK_API_KEY`; keyless snapshots must remain deterministic and portable.
