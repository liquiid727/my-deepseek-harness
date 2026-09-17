/**
 * Audit trail writer (SPEC §49). Every audited operation appends one row to
 * `med_audit_logs`; rows are append-only, never enter a model request, and
 * carry the project they belong to plus the action's own facts. Detail stays
 * free of row-level dataset content (SPEC §47).
 * @module @medresearch/dsh-medical-storage/src/audit
 */

import { randomUUID } from 'node:crypto'
import {
  auditLogIdSchema,
  auditLogSchema,
  type AuditAction,
  type AuditLog,
  type ProjectId,
} from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from './repository.ts'

/** One audited operation (SPEC §49). */
export interface AuditEntry {
  /** Audited action. */
  action: AuditAction
  /** Project the operation belongs to; absent for a project-independent operation. */
  projectId?: ProjectId
  /** DSH session that caused the operation; absent when no session is in scope. */
  sessionId?: string
  /** Action-specific facts; never row-level dataset content. */
  detail?: Record<string, unknown>
}

/** Appends audit rows to one storage handle. */
export interface AuditWriter {
  /**
   * Append one row and return the record written.
   * @param entry - Action, project, and facts to record.
   * @returns the stored audit row.
   */
  append(entry: AuditEntry): Promise<AuditLog>
}

/**
 * Build a writer over one open storage handle. Row identity is owned here
 * rather than by each service, because the audit domain owns the record.
 *
 * Every row is validated against the contract before it is written: the domain
 * medium does not enforce a table's value schema on write, so without this
 * check an operation invented by a caller would be stored as a plausible-looking
 * audit row that no consumer can classify (AGENTS.md §2.8, fail loud).
 * @param options - Open storage handle and the clock used for `at`.
 * @returns a writer for that handle.
 */
export function createAuditWriter(options: { storage: MedStorage; now: () => string }): AuditWriter {
  const { storage, now } = options
  return {
    async append(entry) {
      const record: AuditLog = auditLogSchema.parse({
        id: auditLogIdSchema.parse(randomUUID()),
        ...entry.projectId === undefined ? {} : { projectId: entry.projectId },
        ...entry.sessionId === undefined ? {} : { sessionId: entry.sessionId },
        action: entry.action,
        at: now(),
        detail: entry.detail ?? {},
      })
      await storage.auditLogs.put(record.id, record)
      return record
    },
  }
}
