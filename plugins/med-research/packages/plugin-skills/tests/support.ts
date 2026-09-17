/**
 * In-memory {@link MedStorage} double for skill service tests. The double keeps
 * every domain in a `Map` so a test run never touches a real medium, and it
 * mirrors the production `MedStorage` surface the service depends on. Put does
 * not validate schemas (matching the storage-domain runtime, which validates
 * only on durable reopen), so tests can store skill audit rows with skill-local
 * action strings.
 * @module @medresearch/dsh-plugin-skills/tests/support
 */

import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { MedStorage } from '@medresearch/dsh-medical-storage'

/** A `Map`-backed table satisfying the `KvTable` contract. */
function table<K extends string, V>(): KvTable<K, V> {
  const records = new Map<string, V>()
  const handle = {
    get: (key: K) => records.get(key),
    entries: () => records.entries() as IterableIterator<[K, V]>,
    keys: () => records.keys() as IterableIterator<K>,
    get size() { return records.size },
    put: async (key: K, value: V) => { records.set(key, value) },
    delete: async (key: K) => { const had = records.has(key); records.delete(key); return had },
    update: async (key: K, fn: (current: V) => V) => {
      const current = records.get(key)
      if (current === undefined) throw new Error(`missing-key: ${key}`)
      const next = fn(current)
      records.set(key, next)
      return next
    },
  }
  return handle as unknown as KvTable<K, V>
}

/** Build a fresh in-memory storage handle for one test. */
export function createMemoryStorage(): MedStorage {
  const t = () => table<string, unknown>()
  return {
    projects: t(), sessionsProjects: t(), researchQueries: t(), papers: t(), paperSources: t(),
    projectPapers: t(), documents: t(), sections: t(), paragraphs: t(), chunks: t(), evidences: t(),
    claims: t(), claimEvidences: t(), datasets: t(), datasetColumns: t(), analysisRuns: t(), artifacts: t(),
    auditLogs: t(), notes: t(), annotations: t(), tags: t(), tagLinks: t(), drafts: t(), draftRevisions: t(),
    skills: t(), skillVersions: t(), skillTests: t(), skillInstallations: t(),
    opened: new Map(),
    close: async () => {},
  } as unknown as MedStorage
}
