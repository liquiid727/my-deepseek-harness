/**
 * Task plugin entry (0917 图 1 的「当前任务」). Provides `ctx.medTasks` and the
 * `medTasks/*` Remote namespace; the client reaches it through the med Remote.
 * @module @medresearch/dsh-plugin-task
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { taskIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { TaskError, TasksService } from './service.ts'

export { TaskError, TasksService } from './service.ts'
export type { TasksServiceOptions } from './service.ts'

/** Cordis plugin name. */
export const name = 'med-task'
/** Storage carries the tasks table. */
export const inject = ['storageDomain']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medTasks: TasksService
  }
}

/**
 * Mount the task capability.
 * @param ctx - Registrant context.
 */
export async function apply(ctx: Context): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.task.storage')
  const service = new TasksService({
    storage,
    now: () => new Date().toISOString(),
    newTaskId: () => taskIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medTasks', service), 'med.task.service')
}
