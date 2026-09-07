/** Runtime-neutral APIs and events consumed by a Workbench shell. @module @deepseek-ai/dsh-workbench-contract */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque session identifier owned by a Workbench runtime. */
export type WorkbenchSessionId = Branded<'WorkbenchSessionId'>

/** Brands a Workbench session identifier at its owning runtime boundary.
 * @param id - raw runtime identifier.
 * @returns branded identifier.
 */
export function WorkbenchSessionId(id: string): WorkbenchSessionId { return id as WorkbenchSessionId }

/** A session that a Workbench shell can display and address. */
export interface WorkbenchSession {
  /** Runtime-owned session identity. */
  id: WorkbenchSessionId
  /** Human-readable session title when the runtime has one. */
  title?: string
}

/** Summary used when listing sessions without opening each transcript. */
export interface WorkbenchSessionSummary extends WorkbenchSession {
  /** Epoch milliseconds of the latest durable session activity. */
  updatedAt: number
}

/** Input used when creating a runtime session. */
export interface CreateWorkbenchSessionInput {
  /** Working directory available to the runtime. */
  cwd?: string
  /** Initial title supplied by the caller. */
  title?: string
}

/** Input for an agent prompt. */
export interface WorkbenchPromptInput {
  /** User-visible text supplied to the agent. */
  text: string
}

/** Listener removed by a Workbench runtime subscription. */
export type Unsubscribe = () => void

/** Shared fields present on every Workbench event. */
export interface WorkbenchEventBase {
  /** Session that owns this event. */
  sessionId: WorkbenchSessionId
  /** Epoch milliseconds when the runtime observed this event. */
  timestamp?: number
}

/** Opens an agent turn. */
export interface TurnStartEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'turn.start'
  /** Runtime turn identity. */
  turnId: string
}

/** Opens an assistant message. */
export interface MessageStartEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'message.start'
  /** Runtime message identity. */
  messageId: string
}

/** Appends visible assistant text to an open message. */
export interface MessageDeltaEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'message.delta'
  /** Runtime message identity. */
  messageId: string
  /** Incremental assistant text. */
  delta: string
}

/** Closes an assistant message. */
export interface MessageEndEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'message.end'
  /** Runtime message identity. */
  messageId: string
}

/** Appends non-user-visible reasoning text when the runtime exposes it. */
export interface ThinkingDeltaEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'thinking.delta'
  /** Runtime message identity when reasoning belongs to an assistant message. */
  messageId?: string
  /** Incremental reasoning text. */
  delta: string
}

/** Announces a runtime tool call. */
export interface ToolStartEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'tool.start'
  /** Runtime tool-call identity. */
  toolCallId: string
  /** Runtime tool name. */
  toolName: string
  /** JSON-compatible tool arguments when the runtime can expose them. */
  args?: unknown
}

/** Reports progress from a running runtime tool call. */
export interface ToolUpdateEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'tool.update'
  /** Runtime tool-call identity. */
  toolCallId: string
  /** Runtime tool name. */
  toolName: string
  /** Runtime-defined non-final progress data. */
  update: unknown
}

/** Closes a runtime tool call with either a result or a normalized error. */
export interface ToolEndEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'tool.end'
  /** Runtime tool-call identity. */
  toolCallId: string
  /** Runtime tool name. */
  toolName: string
  /** Runtime-defined successful result. */
  result?: unknown
  /** Normalized tool failure. */
  error?: WorkbenchRuntimeError
}

/** Closes an agent turn. */
export interface TurnEndEvent extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'turn.end'
  /** Runtime turn identity. */
  turnId: string
}

/** A recoverable or terminal runtime error visible to the shell. */
export interface WorkbenchRuntimeError extends WorkbenchEventBase {
  /** Stable public event discriminant. */
  type: 'runtime.error'
  /** Runtime-defined stable error code when available. */
  code?: string
  /** Safe diagnostic message for the shell. */
  message: string
  /** Whether the session can accept a later prompt. */
  recoverable?: boolean
}

/** Runtime-neutral event stream consumed by Workbench shells. */
export type WorkbenchEvent =
  | TurnStartEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ThinkingDeltaEvent
  | ToolStartEvent
  | ToolUpdateEvent
  | ToolEndEvent
  | TurnEndEvent
  | WorkbenchRuntimeError

/** Session operations provided by a Workbench runtime. */
export interface WorkbenchSessions {
  /** Creates a session. */
  create(input?: CreateWorkbenchSessionInput): Promise<WorkbenchSession>
  /** Opens a known session. */
  open(id: WorkbenchSessionId): Promise<WorkbenchSession>
  /** Lists sessions visible to the current shell. */
  list(): Promise<WorkbenchSessionSummary[]>
}

/** Agent operations provided by a Workbench runtime. */
export interface WorkbenchAgent {
  /** Starts a turn for one session. */
  prompt(sessionId: WorkbenchSessionId, input: WorkbenchPromptInput): Promise<void>
  /** Stops the active turn for one session. */
  abort(sessionId: WorkbenchSessionId): Promise<void>
}

/** Runtime-neutral Workbench interface between a shell and its adapter. */
export interface WorkbenchRuntime {
  /** Session operations. */
  sessions: WorkbenchSessions
  /** Agent operations. */
  agent: WorkbenchAgent
  /** Subscribes to runtime events until the returned disposer is called. */
  subscribe(listener: (event: WorkbenchEvent) => void): Unsubscribe
}

/** Checks whether an unknown cross-process value has the minimum public event fields. */
/**
 * Checks whether an unknown cross-process value carries the minimum public event fields.
 * @param value - unknown cross-process value.
 * @returns whether the value has the minimum public event fields.
 */
export function isWorkbenchEvent(value: unknown): value is WorkbenchEvent {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.sessionId !== 'string') return false
  switch (value.type) {
    case 'turn.start':
    case 'turn.end':
      return typeof value.turnId === 'string'
    case 'message.start':
    case 'message.end':
      return typeof value.messageId === 'string'
    case 'message.delta':
      return typeof value.messageId === 'string' && typeof value.delta === 'string'
    case 'thinking.delta':
      return typeof value.delta === 'string'
    case 'tool.start':
    case 'tool.update':
    case 'tool.end':
      return typeof value.toolCallId === 'string' && typeof value.toolName === 'string'
    case 'runtime.error':
      return typeof value.message === 'string'
    default:
      return false
  }
}

/** Narrows an unknown value to a record without accepting arrays. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
