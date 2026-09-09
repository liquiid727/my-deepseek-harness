/**
 * Static allowlist check (SPEC §36, FR-19). Generated code may import Python
 * standard-library modules and the packages named in the run's allowlist;
 * anything else is rejected before a process starts.
 * @module @medresearch/dsh-medical-runner-container/src/allowlist
 */

/** Standard-library modules V1 accepts. Deliberately excludes the escape surface. */
const STDLIB = new Set([
  'abc', 'argparse', 'ast', 'base64', 'bisect', 'calendar', 'cmath', 'collections', 'colorsys',
  'csv', 'dataclasses', 'datetime', 'decimal', 'difflib', 'enum', 'fractions', 'functools',
  'getpass', 'graphlib', 'gzip', 'hashlib', 'heapq', 'html', 'io', 'itertools', 'json',
  'logging', 'math', 'numbers', 'operator', 'os', 'pathlib', 'pickle', 'pprint', 'queue',
  'random', 're', 'shlex', 'shutil', 'signal', 'statistics', 'string', 'sys', 'tempfile',
  'textwrap', 'time', 'types', 'typing', 'unicodedata', 'uuid', 'warnings', 'zipfile',
])

/**
 * Submodules of a blocked root that carry no escape surface. Mirrors the
 * runtime guard: `pathlib` imports `urllib.parse` for pure string parsing,
 * while `urllib.request` stays blocked.
 */
const STDLIB_SUBMODULES = new Set(['urllib.parse'])

const IMPORT_PATTERN = /^[ \t]*(?:from[ \t]+([A-Za-z_][\w.]*)[ \t]+import|import[ \t]+([A-Za-z_][\w., \t]*))/gmu

/**
 * Extract the modules imported by a Python source file, as written.
 * @param code - Generated analysis code.
 * @returns unique dotted module names.
 */
export function importedModules(code: string): string[] {
  const modules = new Set<string>()
  for (const match of code.matchAll(IMPORT_PATTERN)) {
    const from = match[1]
    if (from !== undefined) {
      modules.add(from)
      continue
    }
    for (const part of (match[2] ?? '').split(',')) {
      const name = part.trim().split(/\s+as\s+/u)[0]!.trim()
      if (name !== '') modules.add(name)
    }
  }
  return [...modules]
}

/** Whether one imported module name is permitted without an allowlist entry. */
function isStdlib(name: string): boolean {
  return STDLIB.has(name) || STDLIB_SUBMODULES.has(name) || STDLIB.has(name.split('.')[0]!)
}

/**
 * Report imports that the run's allowlist does not permit.
 * @param code - Generated analysis code.
 * @param allowlist - Third-party packages the run permits.
 * @returns the disallowed module names, in first-seen order.
 */
export function disallowedImports(code: string, allowlist: readonly string[]): string[] {
  const allowed = new Set(allowlist)
  return importedModules(code).filter(name =>
    !isStdlib(name) && !allowed.has(name) && !allowed.has(name.split('.')[0]!))
}
