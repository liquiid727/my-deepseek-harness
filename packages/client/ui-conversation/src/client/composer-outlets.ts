/** Session-scoped destinations and completion callbacks for the resident composer. */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ComposerOutlet } from './contract/composer-outlet.ts'

/** One registry per Conversation plugin lifetime; destinations are transient UI state. */
export class ComposerOutlets {
  private readonly stores = new Map<SessionId, SnapshotStore<ComposerOutlet | undefined>>()

  /**
   * Resolve one stable source for the shell's framework hook.
   * @param sessionId - Owning Session.
   * @returns the Session's transient composer destination source.
   */
  storeFor(sessionId: SessionId): SnapshotStore<ComposerOutlet | undefined> {
    let store = this.stores.get(sessionId)
    if (store === undefined) {
      store = createSnapshotStore<ComposerOutlet | undefined>(undefined)
      this.stores.set(sessionId, store)
    }
    return store
  }

  /**
   * Replace the active View destination.
   * @param sessionId - Owning Session.
   * @param outlet - Mounted View destination.
   * @returns a release function that cannot clear a newer destination.
   */
  mount(sessionId: SessionId, outlet: ComposerOutlet): () => void {
    const store = this.storeFor(sessionId)
    store.set(outlet)
    return () => {
      if (store.getSnapshot() === outlet) store.set(undefined)
    }
  }

  /**
   * Invalidate outstanding callbacks and release the Session source.
   * @param sessionId - Closed Session.
   */
  forget(sessionId: SessionId): void {
    this.stores.get(sessionId)?.set(undefined)
    this.stores.delete(sessionId)
  }
}
