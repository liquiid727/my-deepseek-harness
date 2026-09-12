/**
 * Local profile install composition (SPEC §4.1, §4.2). The script is the
 * supported way to install this unpublished workspace into a dsh profile, so
 * its composed manifest, overrides, and patch are pinned here: every
 * publishable package must appear as a dependency AND as an override, and the
 * patch must carry the deployment config the bundle rows require.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPOSITORY = resolve(import.meta.dirname, '../../..')

interface Composition {
  profileDir: string
  profileManifest: {
    dependencies: Record<string, string>
    dsh: { profile: { bundles: string[] } }
  }
  profileWorkspace: string
  profilePatch: string
}

function compose(): Composition {
  const output = execFileSync('node', [join(REPOSITORY, 'scripts/install-local-profile.mjs'), '--json'], {
    cwd: REPOSITORY,
    encoding: 'utf8',
  })
  return JSON.parse(output) as Composition
}

/** Publishable workspace packages, as the script sees them. */
function publishablePackages(): string[] {
  return readdirSync(join(REPOSITORY, 'packages'))
    .map(directory => JSON.parse(readFileSync(join(REPOSITORY, 'packages', directory, 'package.json'), 'utf8')) as { name: string; private?: boolean })
    .filter(manifest => manifest.private !== true)
    .map(manifest => manifest.name)
    .sort()
}

/** DSH packages the bundle rows name, as the script derives them. */
function bundleDshPackages(): string[] {
  const patch = readFileSync(join(REPOSITORY, 'packages', 'bundle-medical', 'cordis.patch.yml'), 'utf8')
  return [...new Set([...patch.matchAll(/name:\s*'(@deepseek-ai\/[^']+)'/g)].map(match => match[1]!))].sort()
}

describe('install-local-profile composition (SPEC §4.1)', () => {
  it('declares every publishable package as a tarball dependency and an override', () => {
    const composition = compose()
    const names = publishablePackages()
    const bundleDsh = bundleDshPackages()
    expect(Object.keys(composition.profileManifest.dependencies).sort())
      .toEqual(['@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-web-frontend', ...bundleDsh, ...names].sort())
    expect(composition.profileManifest.dependencies['@deepseek-ai/dsh-web-frontend']).toMatch(/^file:.*\.tgz$/)
    expect(composition.profileWorkspace).toContain("'@deepseek-ai/dsh-web-frontend': 'file:")
    for (const name of names) {
      expect(composition.profileManifest.dependencies[name]).toMatch(/^file:.*\.tgz$/)
      expect(composition.profileWorkspace).toContain(`'${name}': 'file:`)
    }
    // Every DSH package a bundle row names must be a profile dependency: the
    // request-extension inventory resolves active entries from the profile tree.
    expect(bundleDsh).toContain('@deepseek-ai/dsh-storage-sqlite')
    for (const name of bundleDsh) {
      expect(composition.profileManifest.dependencies[name]).toMatch(/^\d+\.\d+\.\d+/)
    }
    expect(composition.profileManifest.dsh.profile.bundles).toEqual([
      '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@medresearch/dsh-bundle-medical',
    ])
  })

  it('pins the deployment config the bundle rows require and silences the koffi build', () => {
    const composition = compose()
    for (const id of ['med-storage-sqlite', 'storage-domain', 'med-project', 'med-literature', 'med-artifact', 'med-statistics']) {
      expect(composition.profilePatch).toContain(`- id: ${id}`)
    }
    expect(composition.profilePatch).toContain('backend: sqlite')
    expect(composition.profileWorkspace).toContain('koffi: false')
    // The runner allowlist is a deployment choice; the generated profile names
    // the PRD §34 V1 analysis packages so real statistics can import them.
    for (const packageName of ['pandas', 'numpy', 'scipy', 'statsmodels', 'matplotlib', 'openpyxl']) {
      expect(composition.profilePatch).toContain(packageName)
    }
  })
})
