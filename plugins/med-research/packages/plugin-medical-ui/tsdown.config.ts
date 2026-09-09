/**
 * Browser bundle for the Med Research client half (AGENTS.md §2.1.5, §2.7).
 * DSH does not publish its client bundle preset, so this package carries its
 * own: one CJS closure-factory artifact wrapped for the harness module loader
 * (`window.__ModuleLoader__.load`), with the platform module table left external
 * and every other import inlined. The Node half stays source-plane
 * (`main: src/index.ts`) and is loaded by the host through tsx.
 *
 * The bundle's only runtime imports are `react` and `react/jsx-runtime`; every
 * DSH client package import is type-only and erased.
 * @module @medresearch/dsh-plugin-medical-ui/tsdown
 */

import type { UserConfig } from 'tsdown'

/** Package name stamped into the module-loader handoff. */
const PLUGIN_ID = '@medresearch/dsh-plugin-medical-ui'

/** Module specifiers the dsh web shell shares into its frozen module table. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
] as const

export default [{
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: true,
  deps: {
    // Requested module-table rows stay `require`; everything else inlines,
    // including this workspace's own contract constants (plain values with no
    // shared runtime identity).
    neverBundle: [...PLATFORM_MODULES],
    alwaysBundle: [/^@medresearch\//],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    // One classic script is all the loader fetches: a dynamic import must be
    // inlined rather than split into a chunk nothing can load.
    codeSplitting: false,
    sourcemap: true,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}] satisfies UserConfig[]
