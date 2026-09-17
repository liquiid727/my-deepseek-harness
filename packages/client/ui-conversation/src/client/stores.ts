/** Per-session Conversation store shared by the shell body and header. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConversationStoreState } from './contract/views.ts'

const CONVERSATION_STORE_KEY = 'dsh.conversation'

/** Declared write set for the Conversation shell. */
type ConversationActions = {
  setDraft: (draft: ConversationStoreState, text: string) => void
  setView: (draft: ConversationStoreState, view: string) => void
  openView: (draft: ConversationStoreState, view: string, focus: string) => void
  completeViewRequest: (draft: ConversationStoreState) => void
}

/**
 * Declare per-session draft persistence and View selection.
 * @returns the store handle.
 */
export function createConversationStore(): EngineStoreHandle<ConversationStoreState, ConversationActions> {
  return defineStore({
    init: (): ConversationStoreState => ({ draft: '', view: null, viewFocus: {}, viewRequest: null }),
    persist: CONVERSATION_STORE_KEY,
    actions: {
      setDraft: (d, text: string) => { d.draft = text },
      setView: (d, view: string) => { d.view = view },
      openView: (d, view: string, focus: string) => {
        d.view = view
        d.viewFocus ??= {}
        d.viewFocus[view] = focus
        d.viewRequest = { view, focus }
      },
      completeViewRequest: (d) => { d.viewRequest = null },
    },
  })
}

/**
 * Read the persisted View preference before the Slot store is materialized.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns the preferred View id, or null when storage has no usable value.
 */
export function readConversationViewPreference(sessionId: SessionId): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${CONVERSATION_STORE_KEY}.${sessionId}`)
    if (raw === null) return null
    const stored: unknown = JSON.parse(raw)
    if (typeof stored !== 'object' || stored === null || !('view' in stored)) return null
    return typeof stored.view === 'string' ? stored.view : null
  } catch {
    // Corrupted or inaccessible persistence reads as "no stored preference";
    // the store falls back to its default View selection.
    return null
  }
}

/**
 * Wrap a store handle so one live instance exists per resolved scope key. The
 * slot framework already dedupes per handle × scope key; this wrapper extends
 * that identity to direct `create(key)` callers (the root-level View
 * navigation seam), which must observe and drive the SAME instance the shell
 * renders.
 * @param handle - engine store handle to share.
 * @returns a handle whose `create` is idempotent per scope key.
 */
export function sharePerScopeStore<T, A extends import('@deepseek-ai/dsh-client-store').ActionsDecl<T>>(
  handle: import('@deepseek-ai/dsh-client-store').EngineStoreHandle<T, A>,
): import('@deepseek-ai/dsh-client-store').EngineStoreHandle<T, A> {
  const instances = new Map<string, ReturnType<typeof handle.create>>()
  return {
    spec: handle.spec,
    create(scopeKey?: string) {
      const key = scopeKey ?? '\u0000root'
      let instance = instances.get(key)
      if (instance === undefined) {
        instance = handle.create(scopeKey)
        instances.set(key, instance)
      }
      return instance
    },
  }
}
