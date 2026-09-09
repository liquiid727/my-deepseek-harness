/**
 * Restricted-process statistics runner (SPEC §35–§36). Executes generated
 * Python against a read-only copy of the dataset in a temporary directory,
 * with a curated environment, no network (the guard blocks the socket family),
 * a package allowlist, an address-space limit, and a wall-clock timeout.
 *
 * Isolation level: `restricted-process`. This is not a container: it relies on
 * the in-process guard plus OS resource limits. SPEC §65.1 records that the
 * container provider is the production target; this provider is the macOS /
 * no-container fallback and must be labelled as such.
 * @module @medresearch/dsh-medical-runner-container/src/process-runner
 */

import { execFile, spawn } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import type {
  RunOutput,
  StatisticsRunInput,
  StatisticsRunResult,
  StatisticsRunner,
} from '@medresearch/dsh-medical-contracts'
import { disallowedImports } from './allowlist.ts'
import { guardSource, launcherSource } from './guard.ts'

/** Declared isolation strength of a provider. */
export type IsolationLevel = 'restricted-process' | 'container'

/** Construction options. */
export interface ProcessRunnerOptions {
  /** Python interpreter; must be an absolute path or resolvable on `PATH`. */
  pythonPath: string
  /** Isolation strength this provider actually provides. */
  isolationLevel: IsolationLevel
}

/** MIME type of a produced file, by extension. */
function mimeTypeOf(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.json': return 'application/json'
    case '.csv': return 'text/csv'
    case '.png': return 'image/png'
    case '.svg': return 'image/svg+xml'
    case '.pdf': return 'application/pdf'
    default: return 'application/octet-stream'
  }
}

/**
 * The V1 {@link StatisticsRunner} provider.
 */
export class RestrictedProcessRunner implements StatisticsRunner {
  /**
   * @param options - Interpreter path and the declared isolation level.
   */
  constructor(private readonly options: ProcessRunnerOptions) {}

  /** The isolation level this provider declares. */
  get isolation(): IsolationLevel {
    return this.options.isolationLevel
  }

  private async pythonVersion(): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn(this.options.pythonPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''
      child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8') })
      child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString('utf8') })
      child.on('error', () => resolve('unknown'))
      child.on('close', () => resolve(output.trim().replace(/^Python\s+/u, '') || 'unknown'))
    })
  }

  /**
   * Execute one analysis run.
   * @param input - Dataset path, code, limits, and package allowlist.
   * @returns the machine-only result; every failure path reports `failed` and
   * never fabricates a result table.
   */
  async execute(input: StatisticsRunInput): Promise<StatisticsRunResult> {
    const version = await this.pythonVersion()
    const runtime = { language: 'python' as const, version, packages: {} }
    const disallowed = disallowedImports(input.code, input.allowlist)
    if (disallowed.length > 0) {
      return {
        status: 'failed',
        stdout: '',
        stderr: `package not in allowlist: ${disallowed.join(', ')}`,
        outputs: [],
        runtime,
      }
    }

    const root = await mkdtemp(join(tmpdir(), 'med-runner-'))
    try {
      const dataDir = join(root, 'data')
      const outDir = join(root, 'out')
      const guardDir = join(root, 'guard')
      await mkdir(dataDir, { recursive: true })
      await mkdir(outDir, { recursive: true })
      await mkdir(guardDir, { recursive: true })
      const dataset = join(dataDir, basename(input.datasetPath))
      await copyFile(input.datasetPath, dataset)
      await chmod(dataset, 0o444)
      await writeFile(join(guardDir, 'sitecustomize.py'), guardSource())
      await writeFile(join(guardDir, 'launcher.py'), launcherSource())
      const codePath = join(root, 'analysis.py')
      await writeFile(codePath, input.code)

      const outcome = await this.run(input, { root, dataset, outDir, guardDir, codePath })
      if (outcome.memoryExceeded) {
        return {
          status: 'failed',
          stdout: outcome.stdout,
          stderr: `${outcome.stderr}\nrunner memory limit exceeded (${input.limits.memoryMb} MB)`,
          outputs: [],
          runtime,
        }
      }
      if (outcome.timedOut) {
        return {
          status: 'failed',
          stdout: outcome.stdout,
          stderr: `${outcome.stderr}\nrunner timeout after ${input.limits.timeoutMs} ms`,
          outputs: [],
          runtime,
        }
      }
      if (outcome.code !== 0) {
        return { status: 'failed', stdout: outcome.stdout, stderr: outcome.stderr, outputs: [], runtime }
      }

      const outputs: RunOutput[] = []
      const pending: Array<{ name: string; path: string; extension: string; mimeType: string }> = []
      let resultJson: unknown
      for (const name of await readdir(outDir)) {
        const path = join(outDir, name)
        if (!(await stat(path)).isFile()) continue
        if (name === 'result.json') {
          try {
            resultJson = JSON.parse(await readFile(path, 'utf8'))
          } catch {
            return {
              status: 'failed',
              stdout: outcome.stdout,
              stderr: 'result.json is not valid JSON',
              outputs: [],
              runtime,
            }
          }
          continue
        }
        if (extname(name).toLowerCase() === '.svg') {
          const svg = await readFile(path, 'utf8')
          // SVG exporters commonly prepend an XML declaration and/or DOCTYPE.
          // Keep the document-boundary check strict while accepting that legal prologue.
          if (!/^\s*(?:(?:<\?xml\b[^>]*\?>|<!DOCTYPE\b[^>]*>)\s*)*<svg\b[\s\S]*<\/svg>\s*$/iu.test(svg)) {
            return {
              status: 'failed',
              stdout: outcome.stdout,
              stderr: `figure output ${name} is not a complete SVG document`,
              outputs: [],
              runtime,
            }
          }
        }
        const extension = extname(name).toLowerCase()
        pending.push({ name, path, extension, mimeType: mimeTypeOf(name) })
      }
      // All output validation is complete before any durable file is created.
      // A malformed result must never leave a partial artifact set behind.
      if (input.outputDir !== undefined) await mkdir(input.outputDir, { recursive: true })
      for (const output of pending) {
        const durable = input.outputDir === undefined ? output.path : join(input.outputDir, output.name)
        if (input.outputDir !== undefined) await copyFile(output.path, durable)
        outputs.push({
          type: output.extension === '.png' || output.extension === '.svg' ? 'figure' : 'file',
          path: durable,
          mimeType: output.mimeType,
        })
      }
      return {
        status: 'succeeded',
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        ...resultJson === undefined ? {} : { resultJson },
        outputs,
        runtime,
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }

  /** Spawn one guarded Python process and collect its bounded output. */
  private run(
    input: StatisticsRunInput,
    paths: { root: string; dataset: string; outDir: string; guardDir: string; codePath: string },
  ): Promise<{ code: number | null; timedOut: boolean; memoryExceeded: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.options.pythonPath, [join(paths.guardDir, 'launcher.py'), paths.codePath], {
        cwd: paths.outDir,
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          HOME: paths.root,
          LANG: 'C.UTF-8',
          PYTHONPATH: paths.guardDir,
          PYTHONDONTWRITEBYTECODE: '1',
          MED_DATASET_PATH: paths.dataset,
          MED_OUTPUT_DIR: paths.outDir,
          MED_MEMORY_BYTES: String(input.limits.memoryMb * 1024 * 1024),
          MED_CPU_SECONDS: String(input.limits.cpuSeconds),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      let timedOut = false
      let memoryExceeded = false
      const append = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
        const text = chunk.toString('utf8')
        const current = target === 'stdout' ? stdout : stderr
        const remaining = input.limits.maxOutputBytes - current.length
        if (remaining <= 0) return
        const bounded = text.slice(0, remaining)
        if (target === 'stdout') stdout += bounded
        else stderr += bounded
      }
      child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk))
      child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk))
      child.on('error', reject)
      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, input.limits.timeoutMs)
      const watchdog = setInterval(() => {
        const pid = child.pid
        if (pid === undefined || memoryExceeded) return
        try {
          execFile('ps', ['-o', 'rss=', '-p', String(pid)], (error, out) => {
            if (error !== null) return
            const rssKb = Number.parseInt(out.trim(), 10)
            if (Number.isFinite(rssKb) && rssKb > input.limits.memoryMb * 1024) {
              memoryExceeded = true
              child.kill('SIGKILL')
            }
          })
        } catch {
          // Process inspection is a best-effort fallback on hosts where the
          // sandbox denies spawning `ps`; launcher limits remain authoritative.
        }
      }, 100)
      child.on('close', (code) => {
        clearTimeout(timer)
        clearInterval(watchdog)
        resolve({ code, timedOut, memoryExceeded, stdout, stderr })
      })
    })
  }
}
