# Upstream

Ported from [liangdabiao/dsh-plugin-developer-skill](https://github.com/liangdabiao/dsh-plugin-developer-skill) at commit `79615d507cda28a1cd749c515a8192e9f073dead` (2026-09-01).

Every file in this directory except this one is an upstream copy, with three local edits. The directory and frontmatter `name` are `mydsh-plugin-developer`, and the README title follows it; upstream URLs and install commands keep the upstream name. The `description` value in `SKILL.md` frontmatter is single-quoted because the upstream plain scalar contains `: ` and fails YAML parsing, which would make the loader ignore the skill. The `配置三层` table-of-contents link in `references/architecture.md` is retargeted to the heading it names, because the upstream anchor matches no heading in that file and this repository's link gate rejects it.

Two classes of file were deliberately not copied because they are generated artifacts: `lib/` build output (git-ignored repository-wide) and `package-lock.json`. Rebuild an example with its own `scripts/build.*` before running it. Update the rest by re-copying that repository, not by editing here.

The standards this skill's workflow must satisfy are owned by [mydsh-plugin-repo-standard](../mydsh-plugin-repo-standard/SKILL.md).
