#!/usr/bin/env node
/**
 * Install the Med Research workspace into a dsh profile from local tarballs.
 *
 * The packages are not published and use `workspace:*` internally, so
 * `dsh plugin add file:<bundle>` cannot resolve their dependencies. This script
 * packs every workspace package with `pnpm pack` (which rewrites `workspace:*`
 * to the real version), writes the profile's `package.json` and
 * `pnpm-workspace.yaml` overrides that point every `@medresearch/*` name at its
 * tarball, writes the required deployment config, and runs the install.
 *
 * Usage:
 *   node scripts/install-local-profile.mjs [--profile med-research] [--home ~/.dsh] [--print-only]
 *
 * `--print-only` writes nothing to the Harness home and prints the composed
 * files instead.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARBALL_DIR = join(REPOSITORY, '.med-run', 'tarballs')

/** Parsed command line. */
function parseArgs(argv) {
  const options = { profile: 'med-research', home: join(homedir(), '.dsh'), printOnly: false, json: false, force: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--print-only') options.printOnly = true
    else if (flag === '--json') { options.json = true; options.printOnly = true }
    else if (flag === '--force') options.force = true
    else if (flag === '--profile') options.profile = argv[++index]
    else if (flag === '--home') options.home = resolve(argv[++index])
    else throw new Error(`unknown argument ${JSON.stringify(flag)}`)
  }
  return options
}

/** Every publishable workspace package: name, directory, and packed file name. */
function workspacePackages() {
  return readdirSync(join(REPOSITORY, 'packages'))
    .map(directory => ({ directory, manifest: JSON.parse(readFileSync(join(REPOSITORY, 'packages', directory, 'package.json'), 'utf8')) }))
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ directory, manifest }) => ({
      directory,
      name: manifest.name,
      version: manifest.version,
      tarball: `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`,
    }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
}

/** DSH release line the workspace is verified against, read from the root manifest. */
function dshVersion() {
  const manifest = JSON.parse(readFileSync(join(REPOSITORY, 'package.json'), 'utf8'))
  return manifest.devDependencies['@deepseek-ai/dsh-storage']
}

const options = parseArgs(process.argv.slice(2))
const packages = workspacePackages()
if (packages.length === 0) throw new Error('no publishable workspace packages found')
const profileDir = join(options.home, 'profiles', options.profile)
if (!options.printOnly && !options.force && existsSync(join(profileDir, 'package.json'))) {
  console.error(`install-local-profile: profile ${options.profile} already exists at ${profileDir}; re-run with --force to overwrite its manifest, pnpm settings, and patch`)
  process.exit(1)
}

// `--print-only` composes the same files without touching the tree or the home.
if (!options.printOnly) {
  // The browser bundle is a build artifact the tarball must carry.
  execFileSync('pnpm', ['run', 'build:client'], { cwd: REPOSITORY, stdio: 'inherit' })
  rmSync(TARBALL_DIR, { recursive: true, force: true })
  mkdirSync(TARBALL_DIR, { recursive: true })
  for (const entry of packages) {
    execFileSync('pnpm', ['--filter', entry.name, 'pack', '--pack-destination', TARBALL_DIR], {
      cwd: REPOSITORY,
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    if (!existsSync(join(TARBALL_DIR, entry.tarball))) throw new Error(`pack produced no tarball for ${entry.name}`)
  }
}

const version = dshVersion()
const bundle = packages.find(entry => entry.name === '@medresearch/dsh-bundle-medical')
if (bundle === undefined) throw new Error('the workspace has no @medresearch/dsh-bundle-medical package')

/**
 * DSH packages the bundle's rows name. The profile must install each one:
 * `dsh-plugin-package-inventory-deepseek` resolves every active Loader entry
 * from the profile tree and throws on an unresolvable package, which fails
 * every model request with REQUEST_EXTENSION. The base and web-app bundles
 * already supply their own rows; these extra rows are the bundle's own.
 */
function bundleDshPackages() {
  const patch = readFileSync(join(REPOSITORY, 'packages', 'bundle-medical', 'cordis.patch.yml'), 'utf8')
  return [...new Set([...patch.matchAll(/name:\s*'(@deepseek-ai\/[^']+)'/g)].map(match => match[1]))].sort()
}

/** One `file:` spec for a packed package. */
const fileSpec = entry => `file:${join(TARBALL_DIR, entry.tarball)}`

const profileManifest = {
  name: `dsh-profile-${options.profile}`,
  private: true,
  dependencies: {
    '@deepseek-ai/dsh-web-app': version,
    ...Object.fromEntries(bundleDshPackages().map(name => [name, version])),
    ...Object.fromEntries(packages.map(entry => [entry.name, fileSpec(entry)])),
  },
  dsh: {
    profile: {
      bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', bundle.name],
      patchReload: 'live',
    },
  },
}

const profileWorkspace = [
  'packages:',
  '  - .',
  '',
  'nodeLinker: hoisted',
  'autoInstallPeers: false',
  '',
  'allowBuilds:',
  '  koffi: false',
  '',
  '# Every internal dependency resolves to the packed tarball, so the profile',
  '# never reaches npm for a @medresearch package.',
  'overrides:',
  ...packages.map(entry => `  '${entry.name}': '${fileSpec(entry)}'`),
  '',
].join('\n')

const runtimeRoot = join(REPOSITORY, '.med-run')
const profilePatch = [
  '# User layer for the med-research profile. The bundle rows ship no config, so',
  '# this layer supplies the deployment values the services require.',
  '- id: med-storage-sqlite',
  '  config:',
  `    path: ${join(runtimeRoot, 'med.sqlite')}`,
  // The base bundle owns the domain facility; this layer only routes it.
  '- id: storage-domain',
  '  config:',
  '    backend: sqlite',
  '- id: med-project',
  '  config:',
  `    workspaceRoot: ${join(runtimeRoot, 'workspaces')}`,
  '- id: med-literature',
  '  config:',
  '    tool: med-research-local',
  '    email: med-research@example.com',
  '- id: med-artifact',
  '  config:',
  `    artifactRoot: ${join(runtimeRoot, 'artifacts')}`,
  '- id: med-statistics',
  '  config:',
  `    artifactRoot: ${join(runtimeRoot, 'artifacts')}`,
  '    # PRD §34 V1 analysis packages. The runner environment must have them',
  '    # installed; an absent package fails the run loudly at import time.',
  '    allowlist: [pandas, numpy, scipy, statsmodels, matplotlib, openpyxl]',
  '',
].join('\n')

if (options.json) {
  console.log(JSON.stringify({ profileDir, profileManifest, profileWorkspace, profilePatch }, null, 2))
  process.exit(0)
}
if (options.printOnly) {
  console.log(`# profile ${profileDir}/package.json`)
  console.log(JSON.stringify(profileManifest, null, 2))
  console.log(`\n# profile ${profileDir}/pnpm-workspace.yaml`)
  console.log(profileWorkspace)
  console.log(`\n# profile ${profileDir}/cordis.patch.yml`)
  console.log(profilePatch)
  process.exit(0)
}

mkdirSync(join(runtimeRoot, 'workspaces'), { recursive: true })
mkdirSync(join(runtimeRoot, 'artifacts'), { recursive: true })
mkdirSync(profileDir, { recursive: true })
writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify(profileManifest, null, 2)}\n`)
writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), profileWorkspace)
writeFileSync(join(profileDir, 'cordis.patch.yml'), profilePatch)
execFileSync('pnpm', ['install'], { cwd: profileDir, stdio: 'inherit' })

console.log(`installed profile ${options.profile} at ${profileDir}`)
console.log(`next: dsh --profile ${options.profile} --dump-config`)
console.log(`      dsh --profile ${options.profile} --port 3099`)
console.log(`note: the generated patch sets workspaceRoot to ${join(runtimeRoot, 'workspaces')}.`)
console.log('      project_create writes through ctx.fs, so that directory must sit inside the session workspace')
console.log('      (or the session file policy must allow it); otherwise the tool fails with FS_SANDBOX_DENIED.')
