# AGENTS.md — Python SDK

English | [中文](AGENTS.zh.md)

The `python/` tree contains the Python client SDK and its bundled runtime. Public protocol behavior must stay aligned with the TypeScript SDK and the repository's session and snapshot contracts.

- Keep package metadata, lockfiles, and generated runtime artifacts consistent with the owning `pyproject.toml` or build script.
- Wire and durable data crossing the Python boundary is validated at that boundary; typed internal values do not gain redundant runtime fallbacks.
- Changes to loop projection, session events, or JSON-RPC behavior update the corresponding TypeScript and Python expectations together.
- Follow [python/development.md](development.md) for environment and release workflows. Never commit credentials or local virtual-environment output.
