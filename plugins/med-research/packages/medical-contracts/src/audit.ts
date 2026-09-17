/**
 * Audit trail records (SPEC §49). Audit rows exist for debugging and research
 * reproducibility; they are append-only and never enter a model request.
 * @module @medresearch/dsh-medical-contracts/src/audit
 */

import { z } from 'zod'
import { auditLogIdSchema, projectIdSchema } from './ids.ts'

/**
 * Audited operations (SPEC §49). The set is exhaustive: the audit writer
 * validates every row against {@link auditLogSchema} before writing, so an
 * action that is not listed here is rejected instead of being stored as an
 * undefined operation.
 */
export const auditActionSchema = z.enum([
  'project.create',
  'project.delete',
  'project.archive',
  'project.restore',
  'project.select',
  'paper.upload',
  'evidence.verify',
  'evidence.withdraw',
  'reference.chase',
  'claim.verify',
  'dataset.upload',
  'statistics.approve',
  'code.execute',
  'skill.save_draft',
  'skill.validate',
  'skill.test',
  'skill.publish',
  'skill.install',
  'skill.enable',
  'skill.disable',
  'skill.uninstall',
  'skill.upgrade',
  'skill.revoke',
  'skill.delete_draft',
  'artifact.export',
  'mode.change',
])
/** Audited operations (SPEC §49). */
export type AuditAction = z.infer<typeof auditActionSchema>

/**
 * Audit actions the skill lifecycle emits (SPEC-R001-S07-004). Exported so the
 * contract enum and the service's audit map can be checked against one list.
 */
export const AUDIT_ACTIONS_REQUIRED_BY_SKILLS = [
  'skill.save_draft',
  'skill.validate',
  'skill.test',
  'skill.publish',
  'skill.install',
  'skill.enable',
  'skill.disable',
  'skill.uninstall',
  'skill.upgrade',
  'skill.revoke',
  'skill.delete_draft',
] as const satisfies readonly AuditAction[]

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
