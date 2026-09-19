/**
 * Project tasks (0917 图 1 的「当前任务」、图 2 与图 4 的「任务」域).
 *
 * A task is a project-owned, user-authored to-do. It is deliberately not the
 * agent's `todo_write` list: that belongs to one session's turn and disappears
 * with it, while these rows are part of the project record and survive the
 * session that produced them.
 * @module @medresearch/dsh-medical-contracts/src/tasks
 */

import { z } from 'zod'
import { projectIdSchema, taskIdSchema } from './ids.ts'

/** Lifecycle of one task. */
export const taskStatusSchema = z.enum(['open', 'in_progress', 'done', 'dropped'])
/** Lifecycle of one task. */
export type TaskStatus = z.infer<typeof taskStatusSchema>

/** The prototype's priority badges (高 / 中 / 低). */
export const taskPrioritySchema = z.enum(['high', 'medium', 'low'])
/** Task priority. */
export type TaskPriority = z.infer<typeof taskPrioritySchema>

/** One project task. */
export const taskSchema = z.strictObject({
  id: taskIdSchema,
  projectId: projectIdSchema,
  title: z.string().min(1),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  /** ISO date the task is due; absent means it has no deadline. */
  dueAt: z.string().optional(),
  /** Session that produced the task, when it was not authored by hand. */
  sourceSessionId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** One project task. */
export type Task = z.infer<typeof taskSchema>

/** Fields a caller may set when creating a task. */
export interface TaskCreateInput {
  projectId: import('./ids.ts').ProjectId
  title: string
  priority?: TaskPriority
  dueAt?: string
  sourceSessionId?: string
}

/** Fields a caller may change on an existing task. */
export interface TaskPatch {
  title?: string
  status?: TaskStatus
  priority?: TaskPriority
  /** `null` clears the deadline; `undefined` leaves it alone. */
  dueAt?: string | null
}
