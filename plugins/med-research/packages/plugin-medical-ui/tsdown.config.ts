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

import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Package name stamped into the module-loader handoff. */
const PLUGIN_ID = '@medresearch/dsh-plugin-medical-ui'

/** Module specifiers the dsh web shell shares into its frozen module table. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

const CSS_MODULE_PREFIX = '\0med-css-module:'
const GLOBAL_CSS_PREFIX = '\0med-css-global:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Compile one stylesheet into the tagged injection form understood by the DSH loader. */
function styleInjectionModule(
  fileId: string,
  css: string,
  classMap?: Readonly<Record<string, string>>,
): string {
  const tagId = `${PLUGIN_ID}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    'if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
    '  const tag = document.createElement("style");',
    `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

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
  plugins: [{
    name: 'med-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      return CSS_MODULE_PREFIX + (importer === undefined ? source : resolve(dirname(importer), source)) + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_MODULE_PREFIX)) return null
      const fileId = virtualId.slice(CSS_MODULE_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const { code, exports } = transform({
        filename: fileId,
        code: await readFile(fileId),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap = Object.fromEntries(
        Object.entries(exports ?? {}).map(([local, value]) => [local, value.name]),
      )
      return styleInjectionModule(fileId, code.toString(), classMap)
    },
  }, {
    name: 'med-css-global-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
      return GLOBAL_CSS_PREFIX + (importer === undefined ? source : resolve(dirname(importer), source)) + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(GLOBAL_CSS_PREFIX)) return null
      const fileId = virtualId.slice(GLOBAL_CSS_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const { code } = transform({ filename: fileId, code: await readFile(fileId), minify: true })
      return styleInjectionModule(fileId, code.toString())
    },
  }],
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
