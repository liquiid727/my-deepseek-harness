/**
 * Project task service (0917 图 1 的「当前任务」).
 *
 * Tasks are project records authored by the user; they are not the agent's
 * per-turn todo list. The listing order is the one the project page reads in:
 * open work first, then priority, then the nearest deadline.
 * @module @medresearch/dsh-plugin-task/src/service
 */

import type {
  MedTasksService,
  ProjectId,
  Task,
  TaskCreateInput,
  TaskId,
  TaskPatch,
  TaskPriority,
} from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/** Business failure of the task service. */
export class TaskError extends Error {
  override readonly name = 'TaskError'

  /**
   * @param code - stable failure code.
   * @param message - operator-facing detail.
   */
  constructor(readonly code: 'TASK_NOT_FOUND' | 'TASK_INVALID', message: string) {
    super(message)
  }
}

/** Construction dependencies of {@link TasksService}. */
export interface TasksServiceOptions {
  storage: MedStorage
  /** Current time as an ISO string. */
  now: () => string
  newTaskId: () => TaskId
}

/** Ranking of the prototype's priority badges, highest first. */
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, low: 2, medium: 1 }

/** Project-scoped tasks. */
export class TasksService implements MedTasksService {
  /** Typert Gateway binding: the Web client reaches these methods as `medTasks/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medTasks')

  private readonly options: TasksServiceOptions

  /**
   * @param options - Storage and identity.
   */
  constructor(options: TasksServiceOptions) {
    this.options = options
  }

  /**
   * Create one task.
   * @param input - owning project, title, and the optional fields.
   * @returns the stored task.
   * @throws TaskError when the project is missing or the title is blank.
   */
  @Remote
  async create(input: TaskCreateInput): Promise<Task> {
    const title = input.title.trim()
    if (title === '') throw new TaskError('TASK_INVALID', 'a task needs a title')
    if (this.options.storage.projects.get(input.projectId) === undefined) {
      throw new TaskError('TASK_INVALID', `project ${input.projectId} does not exist`)
    }
    const at = this.options.now()
    const task: Task = {
      id: this.options.newTaskId(),
      projectId: input.projectId,
      title,
      status: 'open',
      priority: input.priority ?? 'medium',
      ...input.dueAt === undefined ? {} : { dueAt: input.dueAt },
      ...input.sourceSessionId === undefined ? {} : { sourceSessionId: input.sourceSessionId },
      createdAt: at,
      updatedAt: at,
    }
    await this.options.storage.tasks.put(task.id, task)
    return task
  }

  /**
   * List one project's tasks in reading order: open work, then priority, then
   * the nearest deadline. A task without a deadline sorts after one with it.
   * @param projectId - owning project.
   * @param options - `includeClosed` also returns done and dropped tasks.
   * @returns the ordered tasks.
   */
  @Remote
  async list(projectId: ProjectId, options?: { includeClosed?: boolean }): Promise<Task[]> {
    const includeClosed = options?.includeClosed === true
    return [...this.options.storage.tasks.entries()]
      .map(([, task]) => task)
      .filter(task => task.projectId === projectId)
      .filter(task => includeClosed || (task.status !== 'done' && task.status !== 'dropped'))
      .sort((left, right) =>
        Number(left.status === 'done' || left.status === 'dropped')
        - Number(right.status === 'done' || right.status === 'dropped')
        || PRIORITY_RANK[left.priority]! - PRIORITY_RANK[right.priority]!
        || deadlineKey(left.dueAt) - deadlineKey(right.dueAt)
        || left.createdAt.localeCompare(right.createdAt))
  }

  /**
   * Read one task.
   * @param id - task id.
   * @returns the task, or `undefined`.
   */
  @Remote
  async get(id: TaskId): Promise<Task | undefined> {
    return this.options.storage.tasks.get(id)
  }

  /**
   * Apply a patch to one task.
   * @param id - task id.
   * @param patch - fields to change; `dueAt: null` clears the deadline.
   * @returns the stored task.
   * @throws TaskError when the task is missing or the new title is blank.
   */
  @Remote
  async update(id: TaskId, patch: TaskPatch): Promise<Task> {
    const current = this.options.storage.tasks.get(id)
    if (current === undefined) throw new TaskError('TASK_NOT_FOUND', `task ${id} does not exist`)
    const title = patch.title === undefined ? current.title : patch.title.trim()
    if (title === '') throw new TaskError('TASK_INVALID', 'a task needs a title')
    const updated: Task = {
      ...current,
      title,
      status: patch.status ?? current.status,
      priority: patch.priority ?? current.priority,
      updatedAt: this.options.now(),
    }
    // A null deadline removes the field rather than storing an empty date, so
    // "no deadline" and "an unknown deadline" stay distinguishable.
    if (patch.dueAt === null) delete (updated as { dueAt?: string }).dueAt
    else if (patch.dueAt !== undefined) (updated as { dueAt?: string }).dueAt = patch.dueAt
    await this.options.storage.tasks.put(updated.id, updated)
    return updated
  }

  /**
   * Delete one task.
   * @param id - task id.
   * @throws TaskError when the task does not exist.
   */
  @Remote
  async remove(id: TaskId): Promise<void> {
    if (this.options.storage.tasks.get(id) === undefined) {
      throw new TaskError('TASK_NOT_FOUND', `task ${id} does not exist`)
    }
    await this.options.storage.tasks.delete(id)
  }
}

/** Sort key placing a task without a deadline after every dated one. */
function deadlineKey(dueAt: string | undefined): number {
  return dueAt === undefined ? Number.POSITIVE_INFINITY : Date.parse(dueAt)
}
