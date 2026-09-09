/**
 * Audit trail records (SPEC §49). Audit rows exist for debugging and research
 * reproducibility; they are append-only and never enter a model request.
 * @module @medresearch/dsh-medical-contracts/src/audit
 */

import { z } from 'zod'
import { auditLogIdSchema, projectIdSchema } from './ids.ts'

/** Audited operations (SPEC §49). */
export const auditActionSchema = z.enum([
  'project.create',
  'project.delete',
  'paper.upload',
  'evidence.verify',
  'claim.verify',
  'dataset.upload',
  'statistics.approve',
  'code.execute',
  'artifact.export',
])
/** Audited operations (SPEC §49). */
export type AuditAction = z.infer<typeof auditActionSchema>

/** One append-only audit row. */
export const auditLogSchema = z.strictObject({
  id: auditLogIdSchema,
  projectId: projectIdSchema.optional(),
  /** DSH session id that caused the operation; opaque and DSH-owned. */
  sessionId: z.string().optional(),
  action: auditActionSchema,
  at: z.string(),
  detail: z.record(z.string(), z.unknown()),
})
/** One append-only audit row. */
export type AuditLog = z.infer<typeof auditLogSchema>
