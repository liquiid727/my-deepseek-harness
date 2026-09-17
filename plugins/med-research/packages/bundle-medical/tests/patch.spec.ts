import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'

const require = createRequire(import.meta.url)
const patchPath = new URL('../cordis.patch.yml', import.meta.url).pathname
const manifestPath = new URL('../package.json', import.meta.url).pathname

interface Row { id: string; name: string; config?: unknown }

function rows(): Row[] {
  const document = parse(readFileSync(patchPath, 'utf8')) as Array<{ insert?: Row[] }>
  return document.flatMap(entry => entry.insert ?? [])
}

/** Locate the installed package.json of one dependency. */
function manifestOf(name: string): { name?: string; version?: string; dsh?: unknown } | undefined {
  try {
    let directory = dirname(require.resolve(name))
    for (let depth = 0; depth < 6; depth += 1) {
      const candidate = join(directory, 'package.json')
      if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8'))
      directory = dirname(directory)
    }
  } catch {
    return undefined
  }
  return undefined
}

describe('bundle-medical patch (SPEC §4.1, §15.1)', () => {
  it('declares the patch and lists every host plugin exactly once', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { dsh?: { bundle?: { patch?: string } } }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')

    const inserted = rows()
    expect(inserted.length).toBe(14)
    expect(new Set(inserted.map(row => row.id)).size).toBe(inserted.length)
    expect(inserted.every(row => typeof row.id === 'string' && typeof row.name === 'string')).toBe(true)
  })

  it('inserts only the sqlite backend and names only resolvable packages', () => {
    const inserted = rows()
    expect(inserted.map(row => row.name)).toContain('@deepseek-ai/dsh-storage-sqlite')
    // The domain facility stays the base bundle's row: a second
    // dsh-storage-domain row would be scoped to its own fiber and invisible to
    // the sibling med plugins.
    expect(inserted.map(row => row.name)).not.toContain('@deepseek-ai/dsh-storage-domain')
    for (const row of inserted) {
      expect(manifestOf(row.name)?.name, row.name).toBe(row.name)
    }
  })

  it('keeps required deployment config out of the shipped layer', () => {
    for (const row of rows()) {
      expect(row.config, `${row.id} must not hardcode deployment config`).toBeUndefined()
    }
  })

  it('lists every med plugin package declared as a bundle dependency', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { dependencies?: Record<string, string> }
    const declared = Object.keys(manifest.dependencies ?? {}).sort()
    const inserted = rows().map(row => row.name).filter(name => name.startsWith('@medresearch/')).sort()
    expect(inserted).toEqual(declared)
  })
})
