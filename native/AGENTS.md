# AGENTS.md — Native components

The `native/` tree contains source-of-record native launchers and their published package wrappers. Native changes affect platform support, packaging, and runtime safety together.

- Read the child rules in [landlock-run](landlock-run/AGENTS.md) before changing that implementation.
- Keep platform matrices and release metadata explicit and synchronized with the package manifests and support documentation.
- Native binaries and build directories are generated artifacts. Build and test them through the documented scripts; do not hand-edit or commit generated payloads.
- A launcher must fail closed when confinement or platform resolution cannot be established. Test the public wrapper and the real executable where the host platform permits it.
