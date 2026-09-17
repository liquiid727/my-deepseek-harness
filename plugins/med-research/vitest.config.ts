import ts from 'typescript'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/**
 * Transform standard TypeScript decorators before Vite's default parser sees
 * source files. The host services mark their Remote surface with `@Remote`
 * (SPEC §30), and Vite 8 hands the untransformed syntax to Node, which has no
 * decorator support. The transform mirrors DSH's own test-time plugin so the
 * source plane runs the same decorator semantics as the harness.
 * @returns a pre-transform Vite plugin.
 */
function standardDecoratorPlugin(): Plugin {
  return {
    name: 'medresearch-standard-decorators',
    enforce: 'pre',
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

/**
 * The source plane: specs import package sources directly, and cross-package
 * imports resolve through the pnpm workspace symlinks to each package's
 * `src/index.ts` export. No build artifact is involved yet.
 */
export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(
        new URL('../../packages/client/ui-primitives/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.spec.ts', 'packages/*/tests/**/*.spec.tsx'],
    environment: 'node',
  },
})
