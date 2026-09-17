// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createConversationStore, readConversationViewPreference, sharePerScopeStore } from '../src/client/stores.ts'

const KEY = 'dsh.conversation'

beforeEach(() => {
  localStorage.clear()
})

describe('createConversationStore', () => {
  it('owns draft, selected View, and one-shot View requests', () => {
    const store = createConversationStore().create()
    expect(store.store.getSnapshot()).toEqual({ draft: '', view: null, viewFocus: {}, viewRequest: null })

    store.actions.setDraft('hello')
    store.actions.setView('chat')
    expect(store.store.getSnapshot()).toEqual({
      draft: 'hello',
      view: 'chat',
      viewFocus: {},
      viewRequest: null,
    })

    store.actions.openView('trajectory', 'call-1')
    expect(store.store.getSnapshot()).toMatchObject({
      view: 'trajectory',
      viewFocus: { trajectory: 'call-1' },
      viewRequest: { view: 'trajectory', focus: 'call-1' },
    })
    store.actions.completeViewRequest()
    expect(store.store.getSnapshot().viewRequest).toBeNull()
  })

  it('persists per Session scope and clears the persisted value', () => {
    const first = createConversationStore().create('sess-1')
    first.actions.setDraft('draft for one')
    first.actions.setView('chat')
    expect(localStorage.getItem(`${KEY}.sess-1`)).not.toBeNull()
    expect(localStorage.getItem(`${KEY}.sess-2`)).toBeNull()

    const restored = createConversationStore().create('sess-1')
    expect(restored.store.getSnapshot()).toMatchObject({
      draft: 'draft for one',
      view: 'chat',
      viewFocus: {},
    })

    first.clearPersisted()
    expect(localStorage.getItem(`${KEY}.sess-1`)).toBeNull()
  })

  it('creates independent live instances', () => {
    const handle = createConversationStore()
    const first = handle.create()
    const second = handle.create()
    first.actions.setDraft('only first')
    expect(second.store.getSnapshot().draft).toBe('')
  })

  it('shares one live instance per scope key through sharePerScopeStore', () => {
    const handle = sharePerScopeStore(createConversationStore())
    const first = handle.create('sess-1')
    const second = handle.create('sess-1')
    expect(second).toBe(first)
    second.actions.setView('med-home')
    expect(first.store.getSnapshot().view).toBe('med-home')
    const root = handle.create()
    expect(root).toBe(handle.create())
    expect(root).not.toBe(first)
  })

  it('reads only a usable persisted View preference', () => {
    const sessionId = 'sess-1' as SessionId
    const store = createConversationStore().create(sessionId)
    store.actions.setView('trajectory')
    expect(readConversationViewPreference(sessionId)).toBe('trajectory')

    localStorage.setItem(`${KEY}.${sessionId}`, '{invalid')
    expect(readConversationViewPreference(sessionId)).toBeNull()
  })

  it('upgrades a prior persisted state when a View receives focus', () => {
    localStorage.setItem(`${KEY}.sess-legacy`, JSON.stringify({
      draft: 'old draft', view: 'chat', viewRequest: null,
    }))
    const store = createConversationStore().create('sess-legacy')
    store.actions.openView('papers', 'paper-1')
    expect(store.store.getSnapshot()).toMatchObject({
      draft: 'old draft',
      view: 'papers',
      viewFocus: { papers: 'paper-1' },
    })
  })
})
