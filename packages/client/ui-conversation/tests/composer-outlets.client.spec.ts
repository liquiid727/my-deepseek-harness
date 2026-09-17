import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { ComposerOutlets } from '../src/client/composer-outlets.ts'

describe('View composer registrations', () => {
  it('isolates Sessions and prevents an old release from clearing a replacement', () => {
    const outlets = new ComposerOutlets()
    const session = SessionId('first')
    const other = SessionId('second')
    const first = { view: 'home', targetId: 'first', placeholder: 'Question', onMessageAccepted: vi.fn() }
    const replacement = { ...first, targetId: 'replacement' }
    const source = outlets.storeFor(session)
    const release = outlets.mount(session, first)
    const releaseReplacement = outlets.mount(session, replacement)
    release()
    expect(source.getSnapshot()).toBe(replacement)
    expect(outlets.storeFor(other).getSnapshot()).toBeUndefined()
    releaseReplacement()
    releaseReplacement()
    expect(source.getSnapshot()).toBeUndefined()
  })

  it('invalidates a disposed Session source without letting its disposer clear a reopened Session', () => {
    const outlets = new ComposerOutlets()
    const session = SessionId('first')
    const outlet = { view: 'home', targetId: 'first', placeholder: 'Question', onMessageAccepted: vi.fn() }
    const source = outlets.storeFor(session)
    const release = outlets.mount(session, outlet)
    outlets.forget(session)
    outlets.forget(session)
    expect(source.getSnapshot()).toBeUndefined()
    outlets.mount(session, outlet)
    release()
    expect(outlets.storeFor(session)).not.toBe(source)
    expect(outlets.storeFor(session).getSnapshot()).toBe(outlet)
  })
})
