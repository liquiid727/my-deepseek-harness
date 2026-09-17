/** Run checkout-backed Web and medical UI watchers with the medical profile. */
import { spawn, type ChildProcess } from 'node:child_process'
import { copyFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const profile = process.env.DSH_MED_RESEARCH_PROFILE ?? 'med-research'
const port = process.env.DSH_MED_RESEARCH_PORT ?? '3100'
const env = { ...process.env, DSH_WEB_FRONTEND_DIST_INDEX: resolve(root, 'apps/web/dist/index.html') }
const sourceBundle = resolve(root, 'plugins/med-research/packages/plugin-medical-ui/lib/client.js')
const profileHome = process.env.DSH_HOME ?? resolve(process.env.HOME ?? root, '.dsh')
const profileBundle = resolve(profileHome, `profiles/${profile}/node_modules/@medresearch/dsh-plugin-medical-ui/lib/client.js`)

function child(command: string, args: readonly string[]): ChildProcess {
  return spawn(command, args, { cwd: root, env, stdio: 'inherit' })
}

function startServer(): ChildProcess {
  return child('pnpm', ['dsh', '--profile', profile, '--port', port])
}

async function syncBundle(): Promise<number> {
  const source = await stat(sourceBundle)
  await copyFile(sourceBundle, profileBundle)
  return source.mtimeMs
}

let stopped = false
let server: ChildProcess | undefined
const plannedServerStops = new WeakSet<ChildProcess>()
let lastBundleMtime = await syncBundle()
const platformWatcher = child('pnpm', ['run', 'dev:web'])
const medicalUiWatcher = child('pnpm', ['--dir', 'plugins/med-research', '--filter', '@medresearch/dsh-plugin-medical-ui', 'run', 'watch'])

function stop(): void {
  if (stopped) return
  stopped = true
  clearInterval(bundlePoll)
  platformWatcher.kill('SIGTERM')
  medicalUiWatcher.kill('SIGTERM')
  if (server !== undefined) {
    plannedServerStops.add(server)
    server.kill('SIGTERM')
  }
}

function restartServer(): void {
  if (server !== undefined) {
    plannedServerStops.add(server)
    server.kill('SIGTERM')
  }
  const nextServer = startServer()
  server = nextServer
  nextServer.once('exit', (code) => {
    if (!stopped && !plannedServerStops.has(nextServer) && code !== 0 && code !== null) {
      process.exitCode = code
      stop()
    }
  })
}

const bundlePoll = setInterval(() => {
  void stat(sourceBundle).then(async (source) => {
    if (source.mtimeMs <= lastBundleMtime) return
    await copyFile(sourceBundle, profileBundle)
    lastBundleMtime = source.mtimeMs
    restartServer()
  }).catch((reason) => {
    if (!stopped) console.error(`dev:med-research: medical UI sync failed: ${String(reason)}`)
  })
}, 500)

for (const watched of [platformWatcher, medicalUiWatcher]) {
  watched.once('exit', (code) => {
    if (!stopped) {
      process.exitCode = code === null ? 1 : code
      stop()
    }
  })
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)
restartServer()
console.log(`dev:med-research: watching checkout sources; serving http://127.0.0.1:${port}`)
