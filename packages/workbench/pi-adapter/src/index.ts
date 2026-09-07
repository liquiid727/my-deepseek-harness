/** Pi AgentSession adapter for the runtime-neutral Workbench contract. @module @deepseek-ai/dsh-pi-adapter */

import type {
  CreateWorkbenchSessionInput,
  Unsubscribe,
  WorkbenchEvent,
  WorkbenchPromptInput,
  WorkbenchRuntime,
  WorkbenchSession,
  WorkbenchSessionId,
  WorkbenchSessionSummary,
} from '@deepseek-ai/dsh-workbench-contract'
import { WorkbenchSessionId as workbenchSessionId } from '@deepseek-ai/dsh-workbench-contract'
import { Type } from '@mariozechner/pi-ai'
import { createAgentSession, defineTool, SessionManager, type CreateAgentSessionOptions, type ToolDefinition } from '@mariozechner/pi-coding-agent'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Pi event fields used by the adapter; Pi's richer private event data does not cross this module. */
export type PiSessionEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: unknown[] }
  | { type: 'message_start'; message: { role?: string; id?: string } }
  | { type: 'message_update'; message: { role?: string; id?: string }; assistantMessageEvent: { type: string; delta?: string; text?: string } }
  | { type: 'message_end'; message: { role?: string; id?: string } }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_execution_update'; toolCallId: string; toolName: string; args: unknown; partialResult: unknown }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; result: unknown; isError: boolean }

/** Small Pi AgentSession face required by this adapter. */
export interface PiSession {
  /** Observes Pi session events. */
  subscribe(listener: (event: PiSessionEvent) => void): Unsubscribe
  /** Starts a Pi prompt. */
  prompt(text: string): Promise<void>
  /** Cancels active Pi work and waits for Pi to become idle. */
  abort(): Promise<void>
}


/** Factory that creates or restores Pi sessions behind a Workbench session mapping. */
export interface PiSessionFactory {
  /** Creates a Pi session for a newly-created Workbench session. */
  create(input?: CreateWorkbenchSessionInput): Promise<{ id: string; session: PiSession }>
  /** Opens a Pi session through its durable Pi identity. */
  open(id: string): Promise<{ id: string; session: PiSession }>
}

/** Durable Workbench-to-Pi identity record. */
export interface WorkbenchSessionMapping {
  /** Workbench-facing id. */
  workbench: WorkbenchSession
  /** Pi session file identity. */
  piSessionId: string
  /** Last observed activity. */
  updatedAt: number
  /** DSH session id when the Host bridge owns this mapping. */
  dshSessionId?: string
  /** Last emitted Workbench turn number, used to continue a resumed transcript. */
  lastTurn?: number
}

/** Persistence face for session mappings. */
export interface WorkbenchSessionMappingStore {
  /** Reads all mappings during runtime startup. */
  load(): Promise<WorkbenchSessionMapping[]>
  /** Upserts one mapping after create/open/activity. */
  save(mapping: WorkbenchSessionMapping): Promise<void>
}

/** In-memory mapping store for tests and embedders that own persistence. */
export class MemoryWorkbenchSessionMappingStore implements WorkbenchSessionMappingStore {
  private readonly mappings = new Map<string, WorkbenchSessionMapping>()

  /** Returns a snapshot of current mappings. */
  load(): Promise<WorkbenchSessionMapping[]> { return Promise.resolve([...this.mappings.values()]) }

  /** Stores one mapping by Workbench id. */
  save(mapping: WorkbenchSessionMapping): Promise<void> {
    this.mappings.set(mapping.workbench.id, mapping)
    return Promise.resolve()
  }
}

/** JSON-file mapping store for Host restarts. Writes are replaced atomically. */
export class JsonWorkbenchSessionMappingStore implements WorkbenchSessionMappingStore {
  private writeQueue: Promise<void> = Promise.resolve()

  /** @param path - mapping file owned by the deployment. */
  constructor(private readonly path: string) {}

  /** Reads mappings, treating a missing first-run file as empty. */
  async load(): Promise<WorkbenchSessionMapping[]> {
    try {
      const text = await readFile(this.path, 'utf8')
      const parsed: unknown = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Workbench mapping file must contain an array')
      return parsed as WorkbenchSessionMapping[]
    } catch (error: unknown) {
      if (isNodeMissing(error)) return []
      throw error
    }
  }

  /** Atomically writes the current mapping set. */
  save(mapping: WorkbenchSessionMapping): Promise<void> {
    const write = this.writeQueue.then(async () => {
      const current = await this.load()
      const next = [...current.filter(item => item.workbench.id !== mapping.workbench.id), mapping]
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.tmp-${process.pid}`
      await writeFile(temporary, `${JSON.stringify(next)}\n`, 'utf8')
      await rename(temporary, this.path)
    })
    this.writeQueue = write.catch(() => {})
    return write
  }
}

function isNodeMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

interface SessionRecord {
  readonly workbench: WorkbenchSession
  readonly piSessionId: string
  readonly pi: PiSession
  unsubscribe: Unsubscribe
  nextTurn: number
  nextMessage: number
  activeTurn: string | undefined
  activeMessage: string | undefined
}

/** In-memory mapping between Workbench sessions and Pi AgentSessions. */
export class PiWorkbenchRuntime implements WorkbenchRuntime {
  /** Workbench session operations. */
  readonly sessions = {
    create: async (input?: CreateWorkbenchSessionInput): Promise<WorkbenchSession> => {
      await this.ready
      const created = await this.factory.create(input)
      const id = workbenchSessionId(`workbench-${++this.nextSession}`)
      const workbench: WorkbenchSession = { id, ...input?.title === undefined ? {} : { title: input.title } }
      await this.attach(workbench, created.id, created.session)
      return workbench
    },
    open: async (id: WorkbenchSessionId): Promise<WorkbenchSession> => {
      await this.ready
      const existing = this.records.get(id)
      if (existing !== undefined) return existing.workbench
      const mapping = this.persistedMappings.get(id)
      if (mapping === undefined) throw new Error(`Workbench session "${id}" is not mapped to Pi`)
      const opened = await this.factory.open(mapping.piSessionId)
      await this.attach(mapping.workbench, opened.id, opened.session)
      return mapping.workbench
    },
    list: async (): Promise<WorkbenchSessionSummary[]> => {
      await this.ready
      return [...this.persistedMappings.values()].map(mapping => ({ ...mapping.workbench, updatedAt: mapping.updatedAt }))
    },
  }

  /** Workbench agent operations. */
  readonly agent = {
    prompt: async (sessionId: WorkbenchSessionId, input: WorkbenchPromptInput): Promise<void> => {
      const record = await this.recordFor(sessionId)
      try {
        await record.pi.prompt(input.text)
      } catch (error: unknown) {
        this.emit({
          type: 'runtime.error',
          sessionId,
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
          timestamp: Date.now(),
        })
        record.activeTurn = undefined
        record.activeMessage = undefined
        throw error
      } finally {
        this.touch(sessionId)
      }
    },
    abort: async (sessionId: WorkbenchSessionId): Promise<void> => {
      const record = await this.recordFor(sessionId)
      await record.pi.abort()
      this.touch(sessionId)
    },
  }

  private readonly records = new Map<WorkbenchSessionId, SessionRecord>()
  private readonly persistedMappings = new Map<WorkbenchSessionId, WorkbenchSessionMapping>()
  private readonly listeners = new Set<(event: WorkbenchEvent) => void>()
  private nextSession = 0
  private readonly ready: Promise<void>

  /** Creates a Pi-backed Workbench runtime. */
  constructor(
    private readonly factory: PiSessionFactory,
    private readonly mappingStore: WorkbenchSessionMappingStore = new MemoryWorkbenchSessionMappingStore(),
  ) {
    this.ready = this.loadMappings()
  }

  /** Subscribes to normalized runtime events. */
  subscribe(listener: (event: WorkbenchEvent) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private async attach(workbench: WorkbenchSession, piSessionId: string, pi: PiSession): Promise<void> {
    const record: SessionRecord = {
      workbench,
      piSessionId,
      pi,
      unsubscribe: () => {},
      nextTurn: this.persistedMappings.get(workbench.id)?.lastTurn ?? 0,
      nextMessage: 0,
      activeTurn: undefined,
      activeMessage: undefined,
    }
    record.unsubscribe = pi.subscribe((event) => { this.handle(record, event) })
    this.records.set(workbench.id, record)
    const mapping = { ...this.persistedMappings.get(workbench.id), workbench, piSessionId, updatedAt: Date.now() }
    this.persistedMappings.set(workbench.id, mapping)
    await this.mappingStore.save(mapping)
  }

  private async recordFor(id: WorkbenchSessionId): Promise<SessionRecord> {
    await this.ready
    const existing = this.records.get(id)
    if (existing !== undefined) return existing
    await this.sessions.open(id)
    const opened = this.records.get(id)
    if (opened === undefined) throw new Error(`Workbench session "${id}" did not open`)
    return opened
  }

  private handle(record: SessionRecord, event: PiSessionEvent): void {
    const sessionId = record.workbench.id
    const timestamp = Date.now()
    switch (event.type) {
      case 'agent_start': {
        const turnId = `turn-${++record.nextTurn}`
        record.activeTurn = turnId
        const mapping = this.persistedMappings.get(sessionId)
        if (mapping !== undefined) {
          mapping.lastTurn = record.nextTurn
          void this.mappingStore.save(mapping)
        }
        this.emit({ type: 'turn.start', sessionId, turnId, timestamp })
        break
      }
      case 'agent_end': {
        const turnId = record.activeTurn
        const errorMessage = agentEndError(event.messages)
        if (errorMessage !== undefined) {
          this.emit({ type: 'runtime.error', sessionId, message: errorMessage, recoverable: true, timestamp })
        } else if (turnId !== undefined) {
          this.emit({ type: 'turn.end', sessionId, turnId, timestamp })
        }
        record.activeTurn = undefined
        record.activeMessage = undefined
        break
      }
      case 'message_start': {
        if (event.message.role !== 'assistant') break
        const messageId = event.message.id ?? `message-${++record.nextMessage}`
        record.activeMessage = messageId
        this.emit({ type: 'message.start', sessionId, messageId, timestamp })
        break
      }
      case 'message_update': {
        if (event.message.role !== 'assistant') break
        const delta = event.assistantMessageEvent.delta ?? event.assistantMessageEvent.text
        const messageId = record.activeMessage ?? event.message.id
        if (typeof delta === 'string' && messageId !== undefined) {
          this.emit({ type: 'message.delta', sessionId, messageId, delta, timestamp })
        }
        break
      }
      case 'message_end': {
        if (event.message.role !== 'assistant') break
        const messageId = record.activeMessage ?? event.message.id
        if (messageId !== undefined) this.emit({ type: 'message.end', sessionId, messageId, timestamp })
        record.activeMessage = undefined
        break
      }
      case 'tool_execution_start':
        this.emit({ type: 'tool.start', sessionId, toolCallId: event.toolCallId, toolName: event.toolName, args: event.args, timestamp })
        break
      case 'tool_execution_update':
        this.emit({ type: 'tool.update', sessionId, toolCallId: event.toolCallId, toolName: event.toolName, update: event.partialResult, timestamp })
        break
      case 'tool_execution_end':
        this.emit(event.isError
          ? { type: 'tool.end', sessionId, toolCallId: event.toolCallId, toolName: event.toolName, error: { type: 'runtime.error', sessionId, message: stringifyError(event.result), recoverable: true }, timestamp }
          : { type: 'tool.end', sessionId, toolCallId: event.toolCallId, toolName: event.toolName, result: event.result, timestamp })
        break
    }
    this.touch(sessionId)
  }

  private emit(event: WorkbenchEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  private touch(sessionId: WorkbenchSessionId): void {
    const mapping = this.persistedMappings.get(sessionId)
    if (mapping !== undefined) {
      mapping.updatedAt = Date.now()
      void this.mappingStore.save(mapping)
    }
  }

  private async loadMappings(): Promise<void> {
    for (const mapping of await this.mappingStore.load()) this.persistedMappings.set(mapping.workbench.id, mapping)
  }
}

/** Options for the embedded Pi AgentSession factory. */
export interface EmbeddedPiSessionFactoryOptions {
  /** Default project directory used by new sessions. */
  cwd?: string
  /** Pi global configuration directory. */
  agentDir?: string
  /** Explicit Pi model and provider configuration. */
  sessionOptions?: Omit<CreateAgentSessionOptions, 'cwd' | 'agentDir' | 'sessionManager'>
  /** Pi session directory used for durable JSONL sessions. */
  sessionDir?: string
}

/** Creates the read-only project identity tool used by the bridge POC.
 * @param cwd - project directory reported by the tool.
 * @returns a Pi tool definition with no file or process side effects.
 */
export function createProjectInfoTool(cwd: string): ToolDefinition {
  return defineTool({
    name: 'get_current_project_info',
    label: 'Project info',
    description: 'Return the current project identity and the active runtime.',
    promptSnippet: 'Inspect the current project identity without changing files.',
    parameters: Type.Object({}),
    execute: () => Promise.resolve({
      content: [{ type: 'text', text: JSON.stringify({ name: 'deepseek-harness', root: cwd, runtime: 'pi' }) }],
      details: {},
    }),
  })
}

/** Creates real Pi AgentSessions backed by Pi's durable SessionManager.
 * @param options - SDK and session-directory options.
 * @returns a factory for creating and opening Pi sessions.
 */
export function createEmbeddedPiSessionFactory(options: EmbeddedPiSessionFactoryOptions = {}): PiSessionFactory {
  const sessions = new Map<string, PiSession>()
  return {
    async create(input) {
      const cwd = input?.cwd ?? options.cwd ?? process.cwd()
      const result = await createAgentSession({
        ...options.sessionOptions,
        cwd,
        customTools: [createProjectInfoTool(cwd), ...(options.sessionOptions?.customTools ?? [])],
        ...(options.agentDir === undefined ? {} : { agentDir: options.agentDir }),
        sessionManager: SessionManager.create(cwd, options.sessionDir),
      })
      const adapted = adaptAgentSession(result.session)
      const id = result.session.sessionManager.getSessionFile() ?? result.session.sessionId
      sessions.set(id, adapted)
      return { id, session: adapted }
    },
    async open(id) {
      const existing = sessions.get(id)
      if (existing !== undefined) return { id, session: existing }
      const sessionManager = SessionManager.open(id, options.sessionDir)
      const result = await createAgentSession({
        ...options.sessionOptions,
        cwd: sessionManager.getCwd(),
        customTools: [createProjectInfoTool(sessionManager.getCwd()), ...(options.sessionOptions?.customTools ?? [])],
        ...(options.agentDir === undefined ? {} : { agentDir: options.agentDir }),
        sessionManager,
      })
      const adapted = adaptAgentSession(result.session)
      sessions.set(id, adapted)
      return { id, session: adapted }
    },
  }
}

interface EmbeddedPiSession {
  sessionId: string
  subscribe(listener: (event: unknown) => void): Unsubscribe
  prompt(text: string): Promise<void>
  abort(): Promise<void>
}

function adaptAgentSession(session: EmbeddedPiSession): PiSession {
  return {
    subscribe: (listener) => {
      return session.subscribe((event) => { listener(event as PiSessionEvent) })
    },
    prompt: text => session.prompt(text),
    abort: () => session.abort(),
  }
}

/** Produces a concise safe error string from a Pi tool result. */
function stringifyError(value: unknown): string {
  return value instanceof Error ? value.message : typeof value === 'string' ? value : 'Pi tool execution failed'
}

function agentEndError(messages: readonly unknown[]): string | undefined {
  for (const message of [...messages].reverse()) {
    if (typeof message !== 'object' || message === null) continue
    const candidate = message as { stopReason?: unknown; errorMessage?: unknown }
    if (candidate.stopReason === 'error' && typeof candidate.errorMessage === 'string') return candidate.errorMessage
  }
  return undefined
}
