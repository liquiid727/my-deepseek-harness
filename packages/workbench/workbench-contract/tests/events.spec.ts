import { describe, expect, it } from 'vitest'
import { isWorkbenchEvent } from '../src/index.ts'

describe('Workbench event contract', () => {
  it('accepts the public streaming and tool lifecycle events', () => {
    expect(isWorkbenchEvent({
      type: 'message.delta',
      sessionId: 'session-1',
      messageId: 'message-1',
      delta: 'Pi',
    })).toBe(true)
    expect(isWorkbenchEvent({
      type: 'tool.end',
      sessionId: 'session-1',
      toolCallId: 'tool-1',
      toolName: 'get_current_project_info',
      result: { runtime: 'pi' },
    })).toBe(true)
  })

  it('rejects values that are not public Workbench events', () => {
    expect(isWorkbenchEvent({ type: 'message_update', text: 'Pi private event' })).toBe(false)
  })
})
