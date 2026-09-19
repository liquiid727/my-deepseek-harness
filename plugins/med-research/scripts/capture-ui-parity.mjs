#!/usr/bin/env node
/**
 * Capture one prototype-vs-actual parity run for the acceptance-baseline UI
 * scenes (R001 `ui-acceptance.md` §45): screenshots at the three locked
 * viewports (plus an independent 200% zoom pass), the run metadata the
 * acceptance rules require, and a per-region comparison table to fill in.
 * The scene roster lives in `ui-parity-regions.mjs` — the 0917 four plus the
 * two pages the set does not cover.
 *
 * The prerequisites of a scene (seeded projects, a real Research chain, an
 * uploaded PDF, a Runner run) are performed by the operator in the running
 * profile; this script records what the run was and captures what is on
 * screen. Nothing is mocked.
 *
 * Usage:
 *   node scripts/capture-ui-parity.mjs --url http://127.0.0.1:3100/ \
 *     --scene UI-PROJECT --locale zh --out .parity/2026-09-17 \
 *     --data "project=住院时长队列" --note "empty-project overview"
 *   node scripts/capture-ui-parity.mjs --dry-run --out .parity/template
 *
 * @module med-research/scripts/capture-ui-parity
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { PARITY_COLUMNS, PARITY_SCENES, PARITY_VIEWPORTS } from './ui-parity-regions.mjs'

/** @typedef {{ id: string, send: (method: string, params?: object) => Promise<object> }} Session */

/**
 * Read one `--key value` pair from argv.
 * @param {string[]} argv - process.argv slice.
 * @param {string} key - flag name without dashes.
 * @param {string} fallback - value used when the flag is absent.
 * @returns {string} the flag value.
 */
function flag(argv, key, fallback) {
  const index = argv.indexOf(`--${key}`)
  return index === -1 || argv[index + 1] === undefined ? fallback : argv[index + 1]
}

/**
 * Read one repeatable `--key value` flag.
 * @param {string[]} argv - process.argv slice.
 * @param {string} key - flag name without dashes.
 * @param {string[]} fallback - values used when the flag is absent.
 * @returns {string[]} every occurrence.
 */
function flags(argv, key, fallback) {
  const values = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === `--${key}` && argv[index + 1] !== undefined) {
      // Both `--zoom 100 200` and `--zoom 100,200` read the same.
      values.push(...argv[index + 1].split(',').map(value => value.trim()).filter(value => value !== ''))
    }
  }
  return values.length === 0 ? fallback : values
}

/**
 * Locate the repository root of this checkout.
 * @returns {string} absolute repository root.
 */
function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

/**
 * Collect the run stamp `ui-acceptance.md` §43 requires: source revision,
 * dirty state, profile and config hashes, runtime, and operator data ids.
 * @param {object} options - profile directory, service data, and note.
 * @returns {object} the run metadata.
 */
function collectRun(options) {
  const root = repoRoot()
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
    .split('\n')
    .filter(line => line.trim() !== '')
  const profileFiles = ['cordis.yml', 'cordis.patch.yml', 'package.json']
    .map(name => join(options.profileDir, name))
    .filter(path => existsSync(path))
  return {
    capturedAt: new Date().toISOString(),
    source: {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty,
    },
    profile: {
      dir: options.profileDir,
      hash: createHash('sha256')
        .update(profileFiles.map(path => readFileSync(path, 'utf8')).join('\n'))
        .digest('hex')
        .slice(0, 16),
      files: profileFiles.length,
    },
    runtime: { node: process.version, url: options.url },
    operator: { data: options.data, note: options.note, zoom: options.zooms, locales: options.locales },
    root,
  }
}

/**
 * Open a CDP session on the first page target of a running browser.
 * @param {string} endpoint - DevTools HTTP endpoint.
 * @returns {Promise<Session>} browser and page session.
 */
async function connect(endpoint) {
  const list = await (await fetch(new URL('/json/list', endpoint))).json()
  const page = list.find(target => target.type === 'page')
  if (page === undefined) throw new Error(`no page target at ${endpoint}`)
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true })
    socket.addEventListener('error', fail, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  /** Console and exception log of the current capture. */
  const console_ = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const entry = pending.get(message.id)
      if (entry === undefined) return
      pending.delete(message.id)
      if (message.error !== undefined) entry.reject(new Error(`${entry.method}: ${message.error.message}`))
      else entry.resolve(message.result ?? {})
      return
    }
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      console_.push(`${message.params.type}: ${message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ')}`)
    }
    if (message.method === 'Runtime.exceptionThrown') {
      console_.push(`exception: ${message.params.exceptionDetails.text}`)
    }
  })
  /**
   * Send one CDP command.
   * @param {string} method - CDP method.
   * @param {object} [params] - method parameters.
   * @returns {Promise<object>} the result.
   */
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = nextId++
    pending.set(id, { method, resolve: ok, reject: fail })
    socket.send(JSON.stringify({ id, method, params }))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  return { id: page.id, send, console_ }
}

/**
 * Capture one screenshot at one viewport and zoom.
 * @param {Session} session - CDP session.
 * @param {object} shot - url, viewport, zoom, settle, and target path.
 * @returns {Promise<string[]>} console and exception lines raised for this shot.
 */
async function capture(session, shot) {
  session.console_.length = 0
  const scale = shot.zoom / 100
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(shot.viewport.width / scale),
    height: Math.round(shot.viewport.height / scale),
    deviceScaleFactor: 1,
    mobile: false,
  })
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: scale })
  await session.send('Page.navigate', { url: shot.url })
  await new Promise(ok => { setTimeout(ok, shot.settle) })
  const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(shot.path, Buffer.from(result.data, 'base64'))
  return [...session.console_]
}

/**
 * Render the per-scene comparison table and the run stamp.
 * @param {object} run - run metadata.
 * @param {object[]} captures - one record per screenshot.
 * @returns {string} the parity markdown.
 */
function renderMarkdown(run, captures) {
  const head = [
    '# 原型 vs 实际 — UI 对比记录',
    '',
    `- 采集时间：${run.capturedAt}`,
    `- 源码 revision：\`${run.source.revision}\`${run.source.dirty.length === 0 ? '（clean）' : `（dirty：${run.source.dirty.length} 项）`}`,
    `- profile：\`${run.profile.dir}\` · config hash \`${run.profile.hash}\``,
    `- 运行时：Node ${run.runtime.node} · ${run.runtime.url}`,
    `- 服务数据：${run.operator.data.length === 0 ? '（未记录）' : run.operator.data.map(value => `\`${value}\``).join('、')}`,
    `- 操作说明：${run.operator.note === '' ? '（未记录）' : run.operator.note}`,
    `- 视口：${PARITY_VIEWPORTS.map(viewport => viewport.id).join('、')} · DPR 1 · zoom ${run.operator.zoom.join('%/')}%`,
    `- locale：${run.operator.locales.join('、')}`,
    '',
    '> 判定列写 `ok` 或 `blocking`。任一必需区域/操作缺失、假状态、跨 Project 数据、未声明宿主差异或遮挡主操作均为 blocking；纯抗锯齿差异不阻塞。',
    '',
  ]
  const body = PARITY_SCENES.filter(scene => run.scenes.includes(scene.id)).flatMap(scene => {
    const shots = captures.filter(shot => shot.scene === scene.id)
    const rows = scene.regions.map(region => `| ${region.label} | | | | | | | | | |`)
    return [
      `## ${scene.id} — ${scene.owner}`,
      '',
      `原型：\`${scene.asset}\` ｜ 前置：${scene.prerequisite}`,
      '',
      `| ${PARITY_COLUMNS.join(' | ')} |`,
      `| ${PARITY_COLUMNS.map(() => '---').join(' |')} |`,
      ...rows,
      '',
      shots.length === 0 ? '_本次未采集该场景。_' : shots.map(shot => `- \`${shot.file}\` — ${shot.viewport}-${shot.locale}-z${shot.zoom}${shot.console.length === 0 ? '' : `（console：${shot.console.length} 条）`}`).join('\n'),
      '',
    ]
  })
  const trail = [
    '## Console 与异常',
    '',
    captures.every(shot => shot.console.length === 0)
      ? '本次采集没有 console error / warning / exception。'
      : captures.filter(shot => shot.console.length > 0)
        .map(shot => `- \`${shot.file}\`：\n${shot.console.map(line => `  - ${line}`).join('\n')}`)
        .join('\n'),
    '',
  ]
  return `${[...head, ...body, ...trail].join('\n')}\n`
}

/** Entry point. */
async function main() {
  const argv = process.argv.slice(2)
  const out = resolve(flag(argv, 'out', '.parity/run'))
  const options = {
    url: flag(argv, 'url', 'http://127.0.0.1:3100/'),
    profileDir: flag(argv, 'profile-dir', join(process.env.HOME ?? '', '.dsh/profiles/med-research')),
    data: flags(argv, 'data', []),
    note: flag(argv, 'note', ''),
    locales: flags(argv, 'locale', ['zh']),
    zooms: flags(argv, 'zoom', ['100']).map(value => Number(value)),
    scenes: flags(argv, 'scene', PARITY_SCENES.map(scene => scene.id)),
    settle: Number(flag(argv, 'settle-ms', '1500')),
  }
  // A renamed or retired prototype must fail here, not become a dead link in
  // the comparison table. The roster changed with the 0917 baseline, so the
  // check is part of the run rather than an operator habit.
  const unknown = options.scenes.filter(id => !PARITY_SCENES.some(scene => scene.id === id))
  if (unknown.length > 0) throw new Error(`unknown scene id(s): ${unknown.join(', ')}`)
  const missingAssets = PARITY_SCENES.filter(scene => options.scenes.includes(scene.id))
    .filter(scene => !existsSync(resolve(import.meta.dirname, scene.asset)))
    .map(scene => `${scene.id} → ${scene.asset}`)
  if (missingAssets.length > 0) throw new Error(`parity scene asset(s) not found:\n  ${missingAssets.join('\n  ')}`)
  const run = { ...collectRun(options), scenes: options.scenes }
  const shotsDir = join(out, 'screenshots')
  mkdirSync(shotsDir, { recursive: true })

  /** @type {object[]} */
  const captures = []
  if (!argv.includes('--dry-run')) {
    const endpoint = flag(argv, 'cdp', 'http://127.0.0.1:9222')
    const session = await connect(endpoint)
    for (const scene of PARITY_SCENES.filter(candidate => options.scenes.includes(candidate.id))) {
      for (const locale of options.locales) {
        for (const viewport of PARITY_VIEWPORTS) {
          for (const zoom of options.zooms) {
            const file = `${scene.id}-${viewport.id}-${locale}-z${zoom}.png`
            const console_ = await capture(session, {
              url: options.url, viewport, zoom, settle: options.settle, path: join(shotsDir, file),
            })
            captures.push({ scene: scene.id, file: `screenshots/${file}`, viewport: viewport.id, locale, zoom, console: console_ })
            process.stdout.write(`captured ${file}${console_.length === 0 ? '' : ` (${console_.length} console entries)`}\n`)
          }
        }
      }
    }
  }

  writeFileSync(join(out, 'run.json'), `${JSON.stringify({ ...run, captures }, null, 2)}\n`)
  writeFileSync(join(out, 'parity.md'), renderMarkdown({ ...run, captures }, captures))
  process.stdout.write(`parity run written to ${out}\n`)
}

await main()
