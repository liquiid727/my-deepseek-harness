import { describe, expect, it } from 'vitest'
import {
  PiDshRuntime,
  WorkbenchDshBridge,
  type DurableSession,
} from '../src/index.ts'
import { WorkbenchSessionId } from '@deepseek-ai/dsh-workbench-contract'
import { MemoryWorkbenchSessionMappingStore, type PiSession, type PiSessionFactory } from '@deepseek-ai/dsh-pi-adapter'

function session(): DurableSession & { events: Array<[string, unknown]> } {
  const events: Array<[string, unknown]> = []
  return { events, append(type: string, data: unknown): void { events.push([type, data]) } }
}

describe('WorkbenchDshBridge', () => {
  it('projects streaming and tool lifecycle into durable DSH events', () => {
    const target = session()
    const bridge = new WorkbenchDshBridge(id => id === 's-1' ? target : undefined)
    const sessionId = WorkbenchSessionId('s-1')
    bridge.handle({ type: 'turn.start', sessionId, turnId: 'turn-1' })
    bridge.handle({ type: 'message.start', sessionId, messageId: 'm-1' })
    bridge.handle({ type: 'message.delta', sessionId, messageId: 'm-1', delta: 'PI_RUNTIME_OK' })
    bridge.handle({ type: 'tool.start', sessionId, toolCallId: 'call-1', toolName: 'safe', args: { ok: true } })
    bridge.handle({ type: 'tool.end', sessionId, toolCallId: 'call-1', toolName: 'safe', result: { ok: true } })
    bridge.handle({ type: 'message.end', sessionId, messageId: 'm-1' })
    bridge.handle({ type: 'turn.end', sessionId, turnId: 'turn-1' })

    expect(target.events.map(([type]) => type)).toEqual([
      'turn/start', 'step/start', 'assistant/chunk', 'tool/call', 'tool/result',
      'assistant/message', 'step/end', 'turn/end',
    ])
    expect(target.events.find(([type]) => type === 'tool/call')?.[1]).toMatchObject({ callId: 'call-1', name: 'safe' })
  })

  it('projects a failed tool result as an error for the DSH tool UI', () => {
    const target = session()
    const bridge = new WorkbenchDshBridge(id => id === 's-1' ? target : undefined)
    const sessionId = WorkbenchSessionId('s-1')
    bridge.handle({ type: 'turn.start', sessionId, turnId: 'turn-1' })
    bridge.handle({ type: 'tool.start', sessionId, toolCallId: 'call-1', toolName: 'safe', args: {} })
    bridge.handle({
      type: 'tool.end',
      sessionId,
      toolCallId: 'call-1',
      toolName: 'safe',
      error: { type: 'runtime.error', sessionId, message: 'denied', code: 'PI_TOOL_DENIED' },
    })

    expect(target.events.find(([type]) => type === 'tool/result')?.[1]).toMatchObject({
      message: { content: [{ type: 'tool-result', isError: true, content: [{ type: 'text', text: 'denied' }] }] },
      error: { code: 'PI_TOOL_DENIED' },
    })
  })
})

describe('PiDshRuntime', () => {
  it('routes one DSH session through Pi and preserves the runtime mapping on reopen', async () => {
    const target = session()
    const listeners = new Set<(event: Parameters<NonNullable<PiSession['subscribe']>>[0] extends (event: infer Event) => void ? Event : never) => void>()
    const pi: PiSession = {
      subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
      async prompt(text) {
        for (const listener of listeners) listener({ type: 'agent_start' })
        for (const listener of listeners) listener({ type: 'message_start', message: { role: 'assistant', id: 'm' } })
        for (const listener of listeners) listener({ type: 'message_update', message: { role: 'assistant', id: 'm' }, assistantMessageEvent: { type: 'text_delta', delta: text } })
        for (const listener of listeners) listener({ type: 'message_end', message: { role: 'assistant', id: 'm' } })
        for (const listener of listeners) listener({ type: 'agent_end', messages: [] })
      },
      async abort() {},
    }
    let created = 0
    const mappings = new MemoryWorkbenchSessionMappingStore()
    const factory: PiSessionFactory = {
      async create() { created++; return { id: 'pi-session', session: pi } },
      async open() { return { id: 'pi-session', session: pi } },
    }
    const runtime = new PiDshRuntime(factory, id => id === 's-1' ? target : undefined, mappings)

    await runtime.prompt('s-1', 'PI_RUNTIME_OK')
    await runtime.prompt('s-1', 'again')

    expect(created).toBe(1)
    expect(target.events.filter(([type]) => type === 'assistant/chunk')).toHaveLength(2)

    const restarted = new PiDshRuntime(factory, id => id === 's-1' ? target : undefined, mappings)
    await restarted.prompt('s-1', 'after-restart')
    expect(created).toBe(1)
  })

  it('marks the bridged user message as a surface append', async () => {
    const appended: Array<[string, unknown, unknown]> = []
    const target: DurableSession = {
      append(type, data, opts) { appended.push([type, data, opts]) },
    }
    const pi: PiSession = {
      subscribe() { return () => {} },
      async prompt() {},
      async abort() {},
    }
    const factory: PiSessionFactory = {
      async create() { return { id: 'pi-session', session: pi } },
      async open() { return { id: 'pi-session', session: pi } },
    }

    await new PiDshRuntime(factory, id => id === 's-1' ? target : undefined).prompt('s-1', 'hello')

    expect(appended[0]?.[0]).toBe('user/message')
    expect(appended[0]?.[2]).toEqual({ surfaceOp: 'append' })
  })

  it('projects a runtime error into a terminal DSH turn event', () => {
    const target = session()
    const bridge = new WorkbenchDshBridge(id => id === 's-1' ? target : undefined)
    const sessionId = WorkbenchSessionId('s-1')
    bridge.handle({ type: 'turn.start', sessionId, turnId: 'turn-1' })
    bridge.handle({ type: 'runtime.error', sessionId, message: 'controlled failure', code: 'PI_TEST_ERROR' })

    expect(target.events.at(-1)).toEqual(['turn/end', { turn: 1, reason: { kind: 'error', error: { message: 'controlled failure', code: 'PI_TEST_ERROR' } } }])
  })
})
