/** DSH durable-log projection for the runtime-neutral Workbench stream. @module @deepseek-ai/dsh-workbench-bridge */

import { CallId, createAssistantMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { WorkbenchSessionId, type WorkbenchEvent } from '@deepseek-ai/dsh-workbench-contract'
import { JsonWorkbenchSessionMappingStore, PiWorkbenchRuntime, createEmbeddedPiSessionFactory, type PiSessionFactory, type WorkbenchSessionMappingStore } from '@deepseek-ai/dsh-pi-adapter'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SessionId } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/cordis' {
  interface Context { piBridge: PiDshRuntime }
}

/** Minimal durable append face; keeping it small makes the bridge easy to test. */
export interface DurableSession {
  /** Appends one validated DSH event. */
  append(type: string, data: unknown): unknown
}

/** Resolves a DSH session for one Workbench session id. */
export type DurableSessionResolver = (sessionId: string) => DurableSession | undefined

/** Embedded Pi runtime facade used by the Host API ingress. */
export class PiDshRuntime {
  private readonly runtime: PiWorkbenchRuntime
  private readonly workbenchByDsh = new Map<string, string>()
  private readonly mappingStore: WorkbenchSessionMappingStore | undefined
  private readonly bridge: WorkbenchDshBridge

  /** @param factory - Pi SDK session factory; @param resolveSession - DSH log resolver. */
  constructor(
    factory: PiSessionFactory,
    private readonly resolveSession: DurableSessionResolver,
    mappingStore?: WorkbenchSessionMappingStore,
  ) {
    this.mappingStore = mappingStore
    this.bridge = new WorkbenchDshBridge(resolveSession)
    this.runtime = new PiWorkbenchRuntime(factory, mappingStore === undefined ? undefined : preserveDshIdentity(mappingStore))
    this.runtime.subscribe((event) => {
      const dshId = [...this.workbenchByDsh.entries()].find(([, workbenchId]) => workbenchId === event.sessionId)?.[0]
      if (dshId === undefined) return
      this.bridge.handle({ ...event, sessionId: WorkbenchSessionId(dshId) })
    })
  }

  /** Whether this facade is enabled by the deployment. */
  readonly enabled: boolean = true

  /** Sends a text prompt through Pi after creating one stable mapping.
   * @param sessionId - DSH session id.
   * @param text - user-visible prompt text.
   */
  async prompt(sessionId: string, text: string): Promise<void> {
    if (this.workbenchByDsh.size === 0 && this.mappingStore !== undefined) {
      for (const mapping of await this.mappingStore.load()) {
        if (mapping.dshSessionId !== undefined) this.workbenchByDsh.set(mapping.dshSessionId, mapping.workbench.id)
      }
    }
    let workbenchId = this.workbenchByDsh.get(sessionId)
    if (workbenchId === undefined) {
      const created = await this.runtime.sessions.create()
      workbenchId = created.id
      this.workbenchByDsh.set(sessionId, workbenchId)
      if (this.mappingStore !== undefined) {
        for (const mapping of await this.mappingStore.load()) {
          if (mapping.workbench.id === workbenchId) {
            await this.mappingStore.save({ ...mapping, dshSessionId: sessionId })
            break
          }
        }
      }
    }
    const durable = this.resolveSession(sessionId)
    if (durable === undefined) throw new Error(`DSH session "${sessionId}" is unavailable for Pi prompt`)
    durable.append('user/message', { content: [{ type: 'text', text }], source: { kind: 'user' } })
    await this.runtime.agent.prompt(WorkbenchSessionId(workbenchId), { text })
  }

  /** Aborts the active Pi turn for one DSH session.
   * @param sessionId - DSH session id.
   */
  async abort(sessionId: string): Promise<void> {
    const workbenchId = this.workbenchByDsh.get(sessionId)
    if (workbenchId !== undefined) await this.runtime.agent.abort(WorkbenchSessionId(workbenchId))
  }

}

function preserveDshIdentity(store: WorkbenchSessionMappingStore): WorkbenchSessionMappingStore {
  return {
    load: () => store.load(),
    save: async (mapping) => {
      const existing = (await store.load()).find(item => item.workbench.id === mapping.workbench.id)
      await store.save(existing?.dshSessionId === undefined ? mapping : { ...mapping, dshSessionId: existing.dshSessionId })
    },
  }
}

/** Host plugin that opts a deployment into the embedded Pi runtime. */
export class PiDshBridgeService extends Service {
  static inject = ['sessions']
  static Config: z<Config> = z.object({
    enabled: z.boolean().default(false),
    agentDir: z.string().default(''),
    sessionDir: z.string().default(''),
    mappingPath: z.string().default(''),
  })

  /** Whether the Pi runtime is selected for this host. */
  readonly enabled: boolean
  private readonly runtime: PiDshRuntime | undefined

  /** @param ctx - Host context owning DSH sessions. @param config - validated deployment settings. */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'piBridge')
    this.enabled = config.enabled === true
    if (!this.enabled) {
      this.runtime = undefined
      return
    }
    const mappingStore = config.mappingPath === undefined || config.mappingPath === '' ? undefined : new JsonWorkbenchSessionMappingStore(config.mappingPath)
    this.runtime = new PiDshRuntime(
      createEmbeddedPiSessionFactory({
        ...(config.agentDir === undefined || config.agentDir === '' ? {} : { agentDir: config.agentDir }),
        ...(config.sessionDir === undefined || config.sessionDir === '' ? {} : { sessionDir: config.sessionDir }),
      }),
      (id) => {
        const session = ctx.sessions.get(SessionId(id))
        if (session === undefined) return undefined
        const append = session.append as unknown as (type: string, data: unknown) => unknown
        return { append: (type: string, data: unknown) => append(type, data) }
      },
      mappingStore,
    )
  }

  /** Sends a prompt through the configured Pi runtime.
   * @param sessionId - DSH session id.
   * @param text - user-visible prompt text.
   */
  async prompt(sessionId: string, text: string): Promise<void> {
    if (this.runtime === undefined) throw new Error('Pi runtime bridge is disabled')
    await this.runtime.prompt(sessionId, text)
  }

  /** Aborts the active Pi turn for one DSH session.
   * @param sessionId - DSH session id.
   */
  async abort(sessionId: string): Promise<void> {
    if (this.runtime === undefined) return
    await this.runtime.abort(sessionId)
  }
}

/** Configuration for the optional Pi bridge plugin. */
export interface Config {
  /** Enables Pi prompt handling in the Host API. */
  enabled?: boolean
  /** Pi global configuration directory. */
  agentDir?: string
  /** Pi session directory. */
  sessionDir?: string
  /** Workbench-to-Pi mapping JSON file. */
  mappingPath?: string
}

/** Cordis plugin name. */
export const name = 'workbench-bridge'

export default PiDshBridgeService

interface TurnState {
  turn: number
  step: number
  messages: Map<string, string>
}

/** Projects Pi-backed Workbench events into the existing DSH transcript vocabulary. */
export class WorkbenchDshBridge {
  private readonly turns = new Map<string, TurnState>()

  /** @param resolveSession - resolves the durable DSH log receiving a Workbench stream. */
  constructor(private readonly resolveSession: DurableSessionResolver) {}

  /** Appends the DSH event corresponding to one normalized Workbench event.
   * @param event - normalized runtime event.
   */
  handle(event: WorkbenchEvent): void {
    const session = this.resolveSession(event.sessionId)
    if (session === undefined) throw new Error(`DSH session "${event.sessionId}" is unavailable for Workbench event`)
    switch (event.type) {
      case 'turn.start': {
        const state: TurnState = { turn: numberFromId(event.turnId), step: 1, messages: new Map() }
        this.turns.set(event.sessionId, state)
        session.append('turn/start', { turn: state.turn })
        session.append('step/start', { turn: state.turn, step: state.step })
        break
      }
      case 'message.start': this.messageState(event.sessionId).messages.set(event.messageId, ''); break
      case 'message.delta': {
        const state = this.messageState(event.sessionId)
        const text = state.messages.get(event.messageId) ?? ''
        state.messages.set(event.messageId, `${text}${event.delta}`)
        session.append('assistant/chunk', {
          turn: state.turn,
          step: state.step,
          chunk: { type: 'text-delta', index: text.length, text: event.delta },
        })
        break
      }
      case 'message.end': {
        const state = this.messageState(event.sessionId)
        session.append('assistant/message', { turn: state.turn, step: state.step, message: createAssistantMessage({ content: [{ type: 'text', text: state.messages.get(event.messageId) ?? '' }], source: { provider: 'pi', model: 'pi-runtime' } }) })
        break
      }
      case 'tool.start': {
        const state = this.messageState(event.sessionId)
        session.append('tool/call', { turn: state.turn, step: state.step, callId: CallId(event.toolCallId), name: event.toolName, arguments: JSON.stringify(event.args ?? {}) })
        break
      }
      case 'tool.end': {
        const state = this.messageState(event.sessionId)
        const error = event.error
        const output = error === undefined ? JSON.stringify(event.result ?? null) : error.message
        session.append('tool/result', { turn: state.turn, step: state.step, message: createToolResultMessage({ callId: CallId(event.toolCallId), content: [{ type: 'text', text: output }], isError: error !== undefined }), ...(error === undefined ? {} : { error: { name: 'PiRuntimeError', code: error.code ?? 'PI_TOOL_ERROR' } }) })
        break
      }
      case 'tool.update':
      case 'thinking.delta':
        break
      case 'turn.end': {
        const state = this.messageState(event.sessionId)
        session.append('step/end', { turn: state.turn, step: state.step })
        session.append('turn/end', { turn: state.turn, reason: { kind: 'completed' } })
        this.turns.delete(event.sessionId)
        break
      }
      case 'runtime.error': {
        const state = this.turns.get(event.sessionId)
        if (state !== undefined) {
          session.append('step/end', { turn: state.turn, step: state.step })
          session.append('turn/end', { turn: state.turn, reason: { kind: 'error', error: { message: event.message, code: event.code ?? 'PI_RUNTIME_ERROR' } } })
          this.turns.delete(event.sessionId)
        }
        break
      }
    }
  }

  private messageState(sessionId: string): TurnState {
    const state = this.turns.get(sessionId)
    if (state === undefined) throw new Error(`Workbench event for "${sessionId}" arrived outside a turn`)
    return state
  }
}

function numberFromId(id: string): number {
  const match = /(?:^|-)\d+$/.exec(id)
  const value = match === null ? Number.NaN : Number(match[0].replace('-', ''))
  return Number.isSafeInteger(value) && value > 0 ? value : 1
}

export type { Session }
