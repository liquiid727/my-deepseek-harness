import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  JsonWorkbenchSessionMappingStore,
  MemoryWorkbenchSessionMappingStore,
  PiWorkbenchRuntime,
  createProjectInfoTool,
  type PiSession,
  type PiSessionFactory,
} from '../src/index.ts'
import { WorkbenchSessionId } from '@deepseek-ai/dsh-workbench-contract'
import type { WorkbenchEvent } from '@deepseek-ai/dsh-workbench-contract'

type PiEvent = Parameters<NonNullable<PiSession['subscribe']>>[0] extends (event: infer Event) => void ? Event : never

class FakePiSession implements PiSession {
  readonly listeners = new Set<(event: PiEvent) => void>()
  prompts: string[] = []
  aborted = false
  promptError: Error | undefined

  subscribe(listener: (event: PiEvent) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async prompt(text: string): Promise<void> {
    this.prompts.push(text)
    if (this.promptError !== undefined) {
      this.emit({ type: 'agent_start' })
      throw this.promptError
    }
  }

  async abort(): Promise<void> {
    this.aborted = true
  }

  emit(event: PiEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

function factory(): { factory: PiSessionFactory; sessions: Map<string, FakePiSession> } {
  const sessions = new Map<string, FakePiSession>()
  let next = 0
  return {
    sessions,
    factory: {
      async create() {
        const id = `pi-${++next}`
        const session = new FakePiSession()
        sessions.set(id, session)
        return { id, session }
      },
      async open(id) {
        const session = sessions.get(id)
        if (session === undefined) throw new Error(`missing Pi session ${id}`)
        return { id, session }
      },
    },
  }
}

describe('PiWorkbenchRuntime', () => {
  it('provides a read-only project info tool for the bridge POC', async () => {
    const tool = createProjectInfoTool('/project')

    expect(tool.name).toBe('get_current_project_info')
    await expect(tool.execute('call-1', {}, undefined, undefined, {} as never)).resolves.toEqual({
      content: [{ type: 'text', text: JSON.stringify({ name: 'deepseek-harness', root: '/project', runtime: 'pi' }) }],
      details: {},
    })
  })

  it('maps Pi streaming and tool events without exposing Pi events to subscribers', async () => {
    const setup = factory()
    const runtime = new PiWorkbenchRuntime(setup.factory)
    const events: string[] = []
    runtime.subscribe((event) => { events.push(event.type) })

    const session = await runtime.sessions.create()
    const pi = setup.sessions.get('pi-1')
    if (pi === undefined) throw new Error('expected Pi session')
    pi.emit({ type: 'agent_start' })
    pi.emit({ type: 'message_start', message: { role: 'assistant', id: 'assistant-1' } })
    pi.emit({
      type: 'message_update',
      message: { role: 'assistant', id: 'assistant-1' },
      assistantMessageEvent: { type: 'text_delta', delta: 'PI_' },
    })
    pi.emit({ type: 'tool_execution_start', toolCallId: 'tool-1', toolName: 'get_current_project_info', args: {} })
    pi.emit({ type: 'tool_execution_update', toolCallId: 'tool-1', toolName: 'get_current_project_info', args: {}, partialResult: { progress: 1 } })
    pi.emit({ type: 'tool_execution_end', toolCallId: 'tool-1', toolName: 'get_current_project_info', result: { runtime: 'pi' }, isError: false })
    pi.emit({ type: 'message_end', message: { role: 'assistant', id: 'assistant-1' } })
    pi.emit({ type: 'agent_end', messages: [] })

    expect(session.id).toBe('workbench-1')
    expect(events).toEqual([
      'turn.start',
      'message.start',
      'message.delta',
      'tool.start',
      'tool.update',
      'tool.end',
      'message.end',
      'turn.end',
    ])
  })

  it('reopens the mapped Pi session without creating a duplicate session', async () => {
    const setup = factory()
    const runtime = new PiWorkbenchRuntime(setup.factory)
    const created = await runtime.sessions.create()
    const opened = await runtime.sessions.open(created.id)

    expect(opened).toEqual(created)
    expect(setup.sessions).toHaveLength(1)
  })

  it('restores a persisted Workbench-to-Pi mapping without creating a Pi session', async () => {
    const setup = factory()
    const mappings = new MemoryWorkbenchSessionMappingStore()
    const first = new PiWorkbenchRuntime(setup.factory, mappings)
    const created = await first.sessions.create({ title: 'Persisted' })
    const restarted = new PiWorkbenchRuntime(setup.factory, mappings)

    const opened = await restarted.sessions.open(WorkbenchSessionId(created.id))

    expect(opened).toEqual(created)
    expect(setup.sessions).toHaveLength(1)
  })

  it('writes mapping records to a JSON file for a host restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-workbench-'))
    const store = new JsonWorkbenchSessionMappingStore(join(dir, 'mappings.json'))
    await store.save({ workbench: { id: WorkbenchSessionId('workbench-1') }, piSessionId: '/tmp/pi-session.jsonl', updatedAt: 1 })
    const restored = await store.load()
    expect(restored[0]?.piSessionId).toBe('/tmp/pi-session.jsonl')
    expect((await readFile(join(dir, 'mappings.json'), 'utf8')).endsWith('\n')).toBe(true)
  })

  it('serializes concurrent mapping writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-workbench-'))
    const store = new JsonWorkbenchSessionMappingStore(join(dir, 'mappings.json'))

    await Promise.all([
      store.save({ workbench: { id: WorkbenchSessionId('workbench-1') }, piSessionId: '/tmp/pi-1.jsonl', updatedAt: 1 }),
      store.save({ workbench: { id: WorkbenchSessionId('workbench-2') }, piSessionId: '/tmp/pi-2.jsonl', updatedAt: 2 }),
      store.save({ workbench: { id: WorkbenchSessionId('workbench-3') }, piSessionId: '/tmp/pi-3.jsonl', updatedAt: 3 }),
    ])

    expect((await store.load()).map(mapping => mapping.workbench.id)).toEqual([
      'workbench-1', 'workbench-2', 'workbench-3',
    ])
  })

  it('forwards prompt and abort to the mapped Pi session', async () => {
    const setup = factory()
    const runtime = new PiWorkbenchRuntime(setup.factory)
    const session = await runtime.sessions.create()
    const pi = setup.sessions.get('pi-1')
    if (pi === undefined) throw new Error('expected Pi session')

    await runtime.agent.prompt(session.id, { text: 'Reply exactly with: PI_RUNTIME_OK' })
    await runtime.agent.abort(session.id)

    expect(pi.prompts).toEqual(['Reply exactly with: PI_RUNTIME_OK'])
    expect(pi.aborted).toBe(true)
  })

  it('continues turn numbering after restoring a persisted session', async () => {
    const setup = factory()
    const mappings = new MemoryWorkbenchSessionMappingStore()
    const first = new PiWorkbenchRuntime(setup.factory, mappings)
    const events: WorkbenchEvent[] = []
    const unsubscribe = first.subscribe((event) => { events.push(event) })
    const created = await first.sessions.create()
    await first.agent.prompt(created.id, { text: 'first' })
    const firstPi = setup.sessions.get('pi-1')
    if (firstPi === undefined) throw new Error('expected first Pi session')
    firstPi.emit({ type: 'agent_start' })
    firstPi.emit({ type: 'agent_end', messages: [] })
    unsubscribe()

    const restarted = new PiWorkbenchRuntime(setup.factory, mappings)
    restarted.subscribe((event) => { events.push(event) })
    await restarted.agent.prompt(created.id, { text: 'second' })
    firstPi.emit({ type: 'agent_start' })
    firstPi.emit({ type: 'agent_end', messages: [] })

    expect(events.filter(event => event.type === 'turn.start').map(event => event.turnId)).toEqual(['turn-1', 'turn-2'])
    expect((await mappings.load())[0]?.lastTurn).toBe(2)
  })

  it('publishes a recoverable runtime error when Pi prompt fails after starting a turn', async () => {
    const setup = factory()
    const runtime = new PiWorkbenchRuntime(setup.factory)
    const events: WorkbenchEvent[] = []
    runtime.subscribe((event) => { events.push(event) })
    const session = await runtime.sessions.create()
    const pi = setup.sessions.get('pi-1')
    if (pi === undefined) throw new Error('expected Pi session')
    pi.promptError = new Error('provider unavailable')

    await expect(runtime.agent.prompt(session.id, { text: 'hello' })).rejects.toThrow('provider unavailable')

    expect(events.map(event => event.type)).toEqual(['turn.start', 'runtime.error'])
    expect(events[1]).toMatchObject({ type: 'runtime.error', sessionId: session.id, message: 'provider unavailable', recoverable: true })
  })

  it('publishes a runtime error when Pi ends a turn with an error assistant message', async () => {
    const setup = factory()
    const runtime = new PiWorkbenchRuntime(setup.factory)
    const events: WorkbenchEvent[] = []
    runtime.subscribe((event) => { events.push(event) })
    const session = await runtime.sessions.create()
    const pi = setup.sessions.get('pi-1')
    if (pi === undefined) throw new Error('expected Pi session')

    pi.emit({ type: 'agent_start' })
    pi.emit({ type: 'agent_end', messages: [{ role: 'assistant', stopReason: 'error', errorMessage: 'rate limited' }] })

    expect(events.map(event => event.type)).toEqual(['turn.start', 'runtime.error'])
    expect(events[1]).toMatchObject({ type: 'runtime.error', sessionId: session.id, message: 'rate limited', recoverable: true })
  })
})
