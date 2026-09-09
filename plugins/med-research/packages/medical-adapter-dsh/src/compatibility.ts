/**
 * DSH compatibility surface (SPEC §2, §65.2; AGENTS.md §2.1 #2). Records the
 * exact published packages, versions, and named exports this repository
 * depends on and verifies them against what is installed. Run it before
 * upgrading DSH; a mismatch fails loud instead of surfacing later as a
 * mysterious runtime error.
 * @module @medresearch/dsh-medical-adapter-dsh/src/compatibility
 */

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

/** One dependency the repository relies on. */
export interface DependencyExpectation {
  /** Published package name. */
  name: string
  /** Version verified against the DSH checkout recorded in the root README. */
  version: string
  /** Named exports (or `default`) that must be present. */
  exports: readonly string[]
}

/** The verified DSH surface. Update together with the root README table. */
export const DSH_DEPENDENCIES: readonly DependencyExpectation[] = [
  { name: '@deepseek-ai/cordis', version: '4.0.2', exports: ['Context'] },
  { name: '@deepseek-ai/dsh-storage', version: '0.1.3-alpha.2', exports: ['StorageError', 'default'] },
  { name: '@deepseek-ai/dsh-storage-domain', version: '0.1.3-alpha.2', exports: ['defineDomain', 'domainTable', 'DomainFacility'] },
  { name: '@deepseek-ai/dsh-storage-sqlite', version: '0.1.3-alpha.2', exports: ['SqliteStorageBackend', 'Config'] },
  { name: '@deepseek-ai/dsh-tools', version: '0.1.3-alpha.2', exports: ['defineTool'] },
  { name: '@deepseek-ai/dsh-web', version: '0.1.3-alpha.2', exports: [] },
  { name: '@deepseek-ai/dsh-fs', version: '0.1.3-alpha.2', exports: ['default'] },
  { name: '@deepseek-ai/dsh-fs-local', version: '0.1.3-alpha.2', exports: ['default'] },
  { name: '@deepseek-ai/dsh-workspace', version: '0.1.3-alpha.2', exports: ['WorkspaceRegistry'] },
  { name: '@deepseek-ai/schemastery', version: '3.18.2', exports: ['default'] },
  // Remote surface: the decorators the host services use and the gateway the
  // client round-trip test drives.
  { name: '@deepseek-ai/dsh-typert-protocol', version: '0.1.3-alpha.2', exports: ['Remote', 'bindTypertRemote', 'remoteMethods'] },
  { name: '@deepseek-ai/dsh-typert-registry', version: '0.1.3-alpha.2', exports: ['default'] },
  { name: '@deepseek-ai/dsh-api-gateway', version: '0.1.3-alpha.2', exports: ['default'] },
  // Client half: the slot core the registration tests run on and the browser
  // plugins the client entry waits for.
  { name: '@deepseek-ai/dsh-client-ui-slots', version: '0.1.3-alpha.2', exports: ['SlotCore', 'resolveSlotLabel'] },
  { name: '@deepseek-ai/dsh-client-locale', version: '0.1.3-alpha.2', exports: ['apply'] },
  { name: '@deepseek-ai/dsh-client-connection', version: '0.1.3-alpha.2', exports: ['apply', 'inject'] },
  { name: '@deepseek-ai/dsh-client-ui-renderer', version: '0.1.3-alpha.2', exports: ['apply'] },
]

/** One verified dependency. */
export interface DependencyReport {
  name: string
  expectedVersion: string
  actualVersion: string
  versionMatches: boolean
  /** Expected exports that are absent. */
  missingExports: string[]
}

/** Compatibility report. */
export interface CompatibilityReport {
  ok: boolean
  entries: DependencyReport[]
}

/** Read the installed version of one package by walking up from its resolved entry. */
function installedVersion(name: string): string {
  try {
    let directory = dirname(require.resolve(name))
    for (let depth = 0; depth < 6; depth += 1) {
      const manifest = join(directory, 'package.json')
      if (existsSync(manifest)) {
        return (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version ?? 'unknown'
      }
      directory = dirname(directory)
    }
  } catch {
    // Resolution failed; the report surfaces 'unknown' as a mismatch.
  }
  return 'unknown'
}

/**
 * Verify every recorded dependency against the installed packages.
 * @returns a report naming any version or export mismatch.
 */
export async function runCompatibilityCheck(): Promise<CompatibilityReport> {
  const entries: DependencyReport[] = []
  for (const expected of DSH_DEPENDENCIES) {
    const actualVersion = installedVersion(expected.name)
    const module = await import(expected.name) as Record<string, unknown>
    const missingExports = expected.exports.filter(name => module[name] === undefined)
    entries.push({
      name: expected.name,
      expectedVersion: expected.version,
      actualVersion,
      versionMatches: actualVersion === expected.version,
      missingExports,
    })
  }
  return { ok: entries.every(entry => entry.versionMatches && entry.missingExports.length === 0), entries }
}
