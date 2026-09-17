/**
 * Artifact check for the Med Research browser bundle. DSH serves the client
 * half as one classic script through the harness module loader, so the emitted
 * `lib/client.js` must be a single closure factory, must request only module
 * table rows, and must not reach Node builtins. Run after `pnpm run build:client`.
 *
 * Usage: node scripts/verify-client-bundle.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PLUGIN_ID = '@medresearch/dsh-plugin-medical-ui'
/** Module-table rows the bundle may request; everything else must inline. */
const ALLOWED_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-primitives',
])

const artifact = fileURLToPath(new URL('../packages/plugin-medical-ui/lib/client.js', import.meta.url))
const raw = readFileSync(artifact, 'utf8')
// The bundler appends a sourcemap reference after the factory close.
const source = raw.replace(/\n?\/\/# sourceMappingURL=.*\s*$/, '\n')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

check(source.startsWith('window.__ModuleLoader__.load({'), 'must open the module-loader handoff')
check(source.includes(`id: ${JSON.stringify(PLUGIN_ID)}`), `must register the package id ${PLUGIN_ID}`)
check(source.includes('return module.exports;'), 'must return the factory exports')
check(source.trimEnd().endsWith('});'), 'must close the module-loader handoff')
check(source.includes('exports.apply = apply;'), 'must export apply')
check(source.includes('exports.inject = inject;'), 'must export inject')
check(source.includes('data-plugin-css='), 'must tag compiled styles for loader-owned unload and HMR cleanup')
check(source.includes('views.css'), 'must inline the shared medical view stylesheet')
check(source.includes('nav.css'), 'must inline the medical navigation stylesheet')
check(!source.includes('asset/'), 'must not bundle design-reference asset paths')

for (const specifier of new Set([...source.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1]))) {
  check(ALLOWED_EXTERNALS.has(specifier), `unexpected external require("${specifier}")`)
}
for (const specifier of new Set([...source.matchAll(/from\s+"([^"]+)"/g)].map(match => match[1]))) {
  check(!specifier.startsWith('node:'), `must not import Node builtin "${specifier}"`)
}
check(!/\bimport\s*\(/.test(source), 'must not contain a dynamic import')

if (failures.length > 0) {
  console.error(`client bundle check failed for ${artifact}:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`client bundle ok: ${artifact} (${String(source.length)} bytes, externals: ${[...ALLOWED_EXTERNALS].join(', ')})`)
