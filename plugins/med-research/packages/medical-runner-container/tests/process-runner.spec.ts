import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StatisticsRunInput } from '@medresearch/dsh-medical-contracts'
import { disallowedImports } from '../src/allowlist.ts'
import { RestrictedProcessRunner } from '../src/process-runner.ts'

const DATASET = new URL('./fixtures/ponv.csv', import.meta.url).pathname
const runner = new RestrictedProcessRunner({ pythonPath: 'python3', isolationLevel: 'restricted-process' })

const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

function input(code: string, overrides: Partial<StatisticsRunInput['limits']> = {}, allowlist: string[] = []): StatisticsRunInput {
  return {
    datasetPath: DATASET,
    code,
    limits: { timeoutMs: 20_000, cpuSeconds: 10, memoryMb: 512, maxOutputBytes: 100_000, ...overrides },
    allowlist,
  }
}

const ANALYZE = `import csv, json, os, statistics
path = os.environ['MED_DATASET_PATH']
rows = list(csv.DictReader(open(path)))
ponv = [float(r['ponv']) for r in rows]
pain = [float(r['pain']) for r in rows if r['pain']]
summary = {'n': len(rows), 'ponv_rate': sum(ponv)/len(ponv), 'pain_mean': statistics.mean(pain)}
open(os.path.join(os.environ['MED_OUTPUT_DIR'], 'result.json'), 'w').write(json.dumps(summary))
open(os.path.join(os.environ['MED_OUTPUT_DIR'], 'table.csv'), 'w').write('metric,value\\n')
print('done')
`

describe('RestrictedProcessRunner isolation (SPEC §36, §57)', () => {
  it('executes analysis code and returns resultJson plus declared outputs', async () => {
    const result = await runner.execute(input(ANALYZE))
    expect(result.status).toBe('succeeded')
    expect(result.stdout.trim()).toBe('done')
    expect(result.resultJson).toMatchObject({ n: 8, pain_mean: expect.closeTo(4.957, 2) })
    expect(result.outputs.map(output => output.type)).toContain('file')
    expect(result.runtime.language).toBe('python')
    expect(result.runtime.version).toMatch(/^3\./)
  })

  it('rejects a package outside the allowlist before execution', async () => {
    const result = await runner.execute(input('import sklearn\n', {}, ['numpy', 'pandas']))
    expect(result.status).toBe('failed')
    expect(result.stderr).toContain('not in allowlist: sklearn')
    expect(result.outputs).toEqual([])
    expect(disallowedImports('import numpy as np\nfrom pandas import DataFrame', ['numpy'])).toEqual(['pandas'])
    // A blocked root stays blocked; only its pure-parsing submodule is permitted.
    expect(disallowedImports('import urllib.request\n', [])).toEqual(['urllib.request'])
    expect(disallowedImports('from urllib.parse import urlparse\nimport os.path\n', [])).toEqual([])
  })

  it('blocks network access at runtime', async () => {
    const result = await runner.execute(input('import json, os\n__import__("socket")\n'))
    expect(result.status).toBe('failed')
    expect(result.stderr).toContain('blocked by the Med Research runner')
  })

  it('keeps urllib.request blocked while allowing the pure urllib.parse parser', async () => {
    const staticallyBlocked = await runner.execute(input('import urllib.request\n'))
    expect(staticallyBlocked.status).toBe('failed')
    expect(staticallyBlocked.stderr).toContain('package not in allowlist: urllib.request')

    // A dynamic import bypasses the static check and must still hit the guard.
    const guardBlocked = await runner.execute(input('__import__("urllib.request")\n'))
    expect(guardBlocked.status).toBe('failed')
    expect(guardBlocked.stderr).toContain("module 'urllib' is blocked")

    // pathlib imports urllib.parse internally; generated code must be able to use it.
    const allowed = await runner.execute(input(
      "import os\nfrom pathlib import Path\nfrom urllib.parse import urlparse\n"
      + "Path(os.environ['MED_OUTPUT_DIR'], 'parsed.txt').write_text(urlparse('https://x/y').path)\n",
    ))
    expect(allowed.status).toBe('succeeded')
  })

  it('blocks process creation at runtime', async () => {
    const result = await runner.execute(input('import os\nos.system("echo escaped")\n'))
    expect(result.status).toBe('failed')
    expect(result.stderr).toContain('process creation is blocked')
  })

  it('keeps the dataset read-only and never mutates the original', async () => {
    const before = createHash('sha256').update(await readFile(DATASET)).digest('hex')
    const result = await runner.execute(input(
      "import os\nopen(os.environ['MED_DATASET_PATH'], 'a').write('tampered')\n",
    ))
    expect(result.status).toBe('failed')
    expect(result.stderr).toMatch(/Permission denied|Read-only/u)
    expect(createHash('sha256').update(await readFile(DATASET)).digest('hex')).toBe(before)
  })

  it('does not expose host environment secrets', async () => {
    process.env.MED_RUNNER_TEST_SECRET = 'top-secret-value'
    const result = await runner.execute(input(
      "import json, os\nopen(os.path.join(os.environ['MED_OUTPUT_DIR'],'result.json'),'w').write(json.dumps(dict(os.environ)))\n",
    ))
    delete process.env.MED_RUNNER_TEST_SECRET
    expect(result.status).toBe('succeeded')
    expect(JSON.stringify(result.resultJson)).not.toContain('top-secret-value')
  })

  it('kills a run that exceeds the wall-clock timeout', async () => {
    const result = await runner.execute(input('while True:\n    pass\n', { timeoutMs: 500 }))
    expect(result.status).toBe('failed')
    expect(result.stderr).toContain('runner timeout')
    expect(result.outputs).toEqual([])
  })

  it('enforces the CPU-second limit independently of wall-clock timeout', async () => {
    const result = await runner.execute(input('while True:\n    pass\n', { cpuSeconds: 1, timeoutMs: 10_000 }))
    expect(result.status).toBe('failed')
    expect(result.outputs).toEqual([])
  })

  it.skipIf(process.platform === 'darwin')('fails an allocation beyond the memory limit', async () => {
    const result = await runner.execute(input(
      "x = bytearray(2 * 1024 * 1024 * 1024)\n",
      { memoryMb: 256, timeoutMs: 20_000 },
    ))
    expect(result.status).toBe('failed')
    expect(result.stderr).toMatch(/MemoryError|memory/u)
  })

  it('reports code errors without inventing a result', async () => {
    const result = await runner.execute(input("raise ValueError('boom')\n"))
    expect(result.status).toBe('failed')
    expect(result.stderr).toContain('boom')
    expect(result.resultJson).toBeUndefined()
  })

  it('caps captured output at maxOutputBytes', async () => {
    const result = await runner.execute(input("print('x' * 100000)\n", { maxOutputBytes: 1_000 }))
    expect(result.status).toBe('succeeded')
    expect(result.stdout.length).toBe(1_000)
  })

  it('copies produced files into a durable output directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'med-runner-out-'))
    dirs.push(dir)
    const result = await runner.execute({
      ...input(ANALYZE),
      outputDir: dir,
    })
    expect(result.status).toBe('succeeded')
    expect(result.outputs[0]!.path.startsWith(dir)).toBe(true)
    expect(await readFile(result.outputs[0]!.path, 'utf8')).toContain('metric,value')
  })

  it('rejects an incomplete SVG figure instead of registering it as an output', async () => {
    const result = await runner.execute(input(
      "import os\nopen(os.path.join(os.environ['MED_OUTPUT_DIR'], 'plot.svg'), 'w').write('<svg>broken')\n",
    ))
    expect(result.status).toBe('failed')
    expect(result.stderr).toContain('not a complete SVG document')
    expect(result.outputs).toEqual([])
  })

  it('accepts SVG documents with an XML declaration and doctype prologue', async () => {
    const result = await runner.execute(input(
      "import os\nsvg = '<?xml version=\"1.0\"?>\\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\\n<svg></svg>'\nopen(os.path.join(os.environ['MED_OUTPUT_DIR'], 'plot.svg'), 'w').write(svg)\n",
    ))
    expect(result.status).toBe('succeeded')
    expect(result.outputs[0]?.type).toBe('figure')
  })

  it('preflights every output before copying durable files on failure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'med-runner-invalid-output-'))
    dirs.push(dir)
    const result = await runner.execute({
      ...input("import os\nopen(os.path.join(os.environ['MED_OUTPUT_DIR'], 'good.csv'), 'w').write('x')\nopen(os.path.join(os.environ['MED_OUTPUT_DIR'], 'bad.svg'), 'w').write('<svg>broken')\n"),
      outputDir: dir,
    })
    expect(result.status).toBe('failed')
    expect(result.outputs).toEqual([])
    expect(await readdir(dir)).toEqual([])
  })

  it('classifies uppercase PNG and SVG extensions as figures', async () => {
    const result = await runner.execute(input(
      "import os\nfrom pathlib import Path\nout = Path(os.environ['MED_OUTPUT_DIR'])\nout.joinpath('plot.PNG').write_bytes(b'png')\nout.joinpath('plot.SVG').write_text('<svg></svg>')\n",
    ))
    expect(result.status).toBe('succeeded')
    expect(result.outputs.map(output => [output.type, output.mimeType])).toEqual([
      ['figure', 'image/png'],
      ['figure', 'image/svg+xml'],
    ])
  })

  it('declares its isolation level', () => {
    expect(runner.isolation).toBe('restricted-process')
  })
})

describe('runner plugin isolation config (SPEC §36)', () => {
  it('refuses a declared container isolation this provider cannot honour', async () => {
    const { Context } = await import('@deepseek-ai/cordis')
    const plugin = await import('../src/index.ts')
    const ctx = new Context()
    await expect(ctx.plugin(plugin, { isolationLevel: 'container' })).rejects.toThrow(/not implemented/)
  })

  it('provides the runner at an explicitly accepted restricted-process level', async () => {
    const { Context } = await import('@deepseek-ai/cordis')
    const plugin = await import('../src/index.ts')
    const ctx = new Context()
    await ctx.plugin(plugin, { isolationLevel: 'restricted-process' })
    expect(ctx.medRunner.isolation).toBe('restricted-process')
    await ctx.fiber.dispose()
  })
})
