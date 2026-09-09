import { describe, expect, it } from 'vitest'
import { DSH_DEPENDENCIES, runCompatibilityCheck } from '../src/compatibility.ts'

describe('DSH compatibility (SPEC §65.2, AGENTS.md §2.1 #2)', () => {
  it('matches every recorded dependency version and export', async () => {
    const report = await runCompatibilityCheck()
    expect(report.entries).toHaveLength(DSH_DEPENDENCIES.length)
    expect(report.entries.filter(entry => !entry.versionMatches)).toEqual([])
    expect(report.entries.filter(entry => entry.missingExports.length > 0)).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('records the DSH version verified against the root README', () => {
    const versions = new Set(DSH_DEPENDENCIES.map(entry => entry.version))
    expect(versions).toEqual(new Set(['0.1.3-alpha.2', '3.18.2', '4.0.2']))
  })
})
