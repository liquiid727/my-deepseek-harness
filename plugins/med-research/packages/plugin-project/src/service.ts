/**
 * Project service (SPEC §32). Owns project records, the on-disk
 * `project.json` mirror, the DSH workspace binding, and library membership.
 * Filesystem and workspace registration arrive as injected capabilities so the
 * service stays testable and the plugin owns the wiring.
 * @module @medresearch/dsh-plugin-project/src/service
 */

import { agentModeSchema, projectCreateInputSchema, projectSchema } from '@medresearch/dsh-medical-contracts'
import type {
  AgentMode,
  MedProjectsService,
  PaperId,
  Project,
  ProjectCreateInput,
  ProjectId,
  ProjectOverview,
  ProjectOverviewCounter,
  ProjectPaper,
  ProjectPatch,
  SessionProject,
} from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { projectDirectory, projectJsonPath, projectSlug, serializeProjectFile } from './project-file.ts'
import { AgentModeController, type ModeAgentRegistry } from './mode.ts'

/** File access the service needs; the implementation must create parent directories. */
export interface ProjectFileStore {
  /**
   * Write a UTF-8 file, creating missing parent directories.
   * @param path - Absolute target path.
   * @param content - Full file content.
   */
  write(path: string, content: string): Promise<void>
}

/**
 * Case- and accent-fold a project name for duplicate detection.
 * @param name - Raw project name.
 * @returns the normalized comparison key.
 */
function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase()
}

/** Workspace registration the service needs. */
export interface WorkspaceRegistrar {
  /**
   * Register an existing directory as a DSH workspace.
   * @param path - Absolute directory; it must already exist.
   * @param title - Display title.
   * @returns the created workspace's id.
   */
  create(path: string, title: string): Promise<{ id: string }>
}

/** Construction dependencies of {@link ProjectsService}. */
export interface ProjectsServiceOptions {
  storage: MedStorage
  files: ProjectFileStore
  workspaces: WorkspaceRegistrar
  /** Parent directory every project workspace is created under. */
  workspaceRoot: string
  /** Current time as an ISO string; injectable for deterministic tests. */
  now: () => string
  /** New project identity; injectable for deterministic tests. */
  newId: () => ProjectId
  /** Live agent registry; omitted by storage-only compositions. */
  agents?: ModeAgentRegistry
}

/** Stable failure codes of the project service. */
export type ProjectErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'PAPER_NOT_FOUND'
  | 'PROJECT_BUSY'
  | 'PROJECT_DUPLICATE'
  | 'PROJECT_VERSION_CONFLICT'

/** Thrown when a project operation names a record that does not exist. */
export class ProjectError extends Error {
  override readonly name = 'ProjectError'

  /**
   * @param code - Stable discriminant.
   * @param message - Diagnostic detail naming the missing record.
   */
  constructor(
    readonly code: ProjectErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** Project lifecycle capabilities over one storage handle. */
export class ProjectsService implements MedProjectsService {
  /** Typert Gateway binding: the Web client reaches these methods as `medProjects/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medProjects')

  private readonly options: ProjectsServiceOptions
  /** Audit trail for the two audited project operations (SPEC §49). */
  private readonly audit: AuditWriter
  private readonly modes: AgentModeController

  /**
   * @param options - Storage, file and workspace capabilities, and identity/clock.
   */
  constructor(options: ProjectsServiceOptions) {
    this.options = options
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
    this.modes = new AgentModeController(options.agents)
  }

  /**
   * Create the project record, its directory, `project.json`, and the DSH
   * workspace binding, in that order.
   * @param input - Project fields from the tool or RPC call.
   * @returns the stored project.
   * @throws ProjectError with `PROJECT_DUPLICATE` when a project with the same
   *   normalized name already exists.
   */
  @Remote
  async create(input: ProjectCreateInput): Promise<Project> {
    const validated = projectCreateInputSchema.parse(input)
    const duplicate = [...this.options.storage.projects.entries()]
      .find(([, project]) => normalizeName(project.name) === normalizeName(validated.name))
    if (duplicate !== undefined) {
      throw new ProjectError('PROJECT_DUPLICATE', `a project named "${duplicate[1].name}" already exists`)
    }
    const id = this.options.newId()
    const timestamp = this.options.now()
    const workspacePath = projectDirectory(this.options.workspaceRoot, projectSlug(validated.name, id))
    const project: Project = {
      id,
      name: validated.name,
      ...validated.researchQuestion === undefined ? {} : { researchQuestion: validated.researchQuestion },
      ...validated.background === undefined ? {} : { background: validated.background },
      ...validated.population === undefined ? {} : { population: validated.population },
      ...validated.interventionOrExposure === undefined ? {} : { interventionOrExposure: validated.interventionOrExposure },
      ...validated.comparison === undefined ? {} : { comparison: validated.comparison },
      ...validated.outcome === undefined ? {} : { outcome: validated.outcome },
      keywords: validated.keywords ?? [],
      workspacePath,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.options.files.write(projectJsonPath(workspacePath), serializeProjectFile(project))
    await this.options.workspaces.create(workspacePath, project.name)
    await this.options.storage.projects.put(project.id, project)
    await this.audit.append({
      action: 'project.create',
      projectId: project.id,
      detail: { name: project.name, workspacePath },
    })
    return project
  }

  /** List every project, newest first. */
  @Remote
  async list(): Promise<Project[]> {
    return [...this.options.storage.projects.entries()]
      .map(([, project]) => project)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /**
   * Read one project.
   * @param id - Project id.
   * @returns the project, or `undefined`.
   */
  @Remote
  async get(id: ProjectId): Promise<Project | undefined> {
    return this.options.storage.projects.get(id)
  }

  /**
   * Apply a patch to one project.
   * @param id - Project id.
   * @param patch - Fields to replace.
   * @param expectedVersion - `updatedAt` token of the caller's copy; a stale
   *   token fails the write before any mutation.
   * @returns the updated project.
   * @throws ProjectError when the project does not exist, is archived
   *   (`PROJECT_BUSY`), or the version token is stale (`PROJECT_VERSION_CONFLICT`).
   */
  @Remote
  async update(id: ProjectId, patch: ProjectPatch, expectedVersion?: string): Promise<Project> {
    const current = this.requireProject(id)
    if (current.status === 'archived') {
      throw new ProjectError('PROJECT_BUSY', `project ${id} is archived and read-only`)
    }
    if (expectedVersion !== undefined && expectedVersion !== current.updatedAt) {
      throw new ProjectError('PROJECT_VERSION_CONFLICT', `project ${id} changed since the caller read it`)
    }
    const updated = projectSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      workspacePath: current.workspacePath,
      updatedAt: this.options.now(),
    })
    await this.options.storage.projects.put(id, updated)
    await this.options.files.write(projectJsonPath(updated.workspacePath), serializeProjectFile(updated))
    return updated
  }

  /**
   * Archive one project: read-only and removed from the active roster, while
   * its sessions, sources, and run history stay in place.
   * @param id - Project id.
   * @returns the archived project.
   * @throws ProjectError when the project does not exist, a protected
   *   operation is still running, or it is already archived.
   */
  @Remote
  async archive(id: ProjectId): Promise<Project> {
    const current = this.requireProject(id)
    if (current.status === 'archived') {
      throw new ProjectError('PROJECT_BUSY', `project ${id} is already archived`)
    }
    for (const [, run] of this.options.storage.analysisRuns.entries()) {
      if (run.projectId === id && run.status === 'running') {
        throw new ProjectError('PROJECT_BUSY', `project ${id} has a running analysis (${run.id})`)
      }
    }
    return this.writeStatus(id, current, 'archived', 'project.archive')
  }

  /**
   * Restore an archived project under the same identity.
   * @param id - Project id.
   * @returns the restored project.
   * @throws ProjectError when the project does not exist or is not archived.
   */
  @Remote
  async restore(id: ProjectId): Promise<Project> {
    const current = this.requireProject(id)
    if (current.status !== 'archived') {
      throw new ProjectError('PROJECT_BUSY', `project ${id} is not archived`)
    }
    return this.writeStatus(id, current, 'active', 'project.restore')
  }

  /**
   * Flip one project's lifecycle status: storage first, then the on-disk
   * mirror, then the audit row.
   * @param id - Project id.
   * @param current - Record the caller just read.
   * @param status - Target status.
   * @param action - Audited action name.
   * @returns the stored project.
   */
  private async writeStatus(
    id: ProjectId,
    current: Project,
    status: Project['status'],
    action: 'project.archive' | 'project.restore',
  ): Promise<Project> {
    const updated = projectSchema.parse({ ...current, status, updatedAt: this.options.now() })
    await this.options.storage.projects.put(id, updated)
    await this.options.files.write(projectJsonPath(updated.workspacePath), serializeProjectFile(updated))
    await this.audit.append({ action, projectId: id, detail: { name: updated.name } })
    return updated
  }

  /** Read one project or fail with `PROJECT_NOT_FOUND`. */
  private requireProject(id: ProjectId): Project {
    const current = this.options.storage.projects.get(id)
    if (current === undefined) throw new ProjectError('PROJECT_NOT_FOUND', `no project ${id}`)
    return current
  }

  /**
   * Delete one project record. The workspace directory and its registration
   * are left in place; V1 has no destructive project delete (SPEC §40 requires
   * approval for asset deletion, which lands with the tool policy layer).
   * @param id - Project id.
   * @throws ProjectError when the project does not exist.
   */
  @Remote
  async delete(id: ProjectId): Promise<void> {
    const current = this.options.storage.projects.get(id)
    if (current === undefined) throw new ProjectError('PROJECT_NOT_FOUND', `no project ${id}`)
    await this.options.storage.projects.delete(id)
    await this.audit.append({ action: 'project.delete', projectId: id, detail: { name: current.name } })
  }

  /**
   * Count the records that belong to one project, one domain at a time. A
   * failing domain read reports `unavailable` instead of zero, so the client
   * can show unknown plus a retry for exactly that domain.
   * @param id - Project id.
   * @returns overview counters.
   * @throws ProjectError when the project does not exist.
   */
  @Remote
  async overview(id: ProjectId): Promise<ProjectOverview> {
    this.requireProject(id)
    const { storage } = this.options
    const count = <T extends { projectId?: string }>(entries: IterableIterator<[string, T]>): number => {
      let total = 0
      for (const [, record] of entries) if (record.projectId === id) total += 1
      return total
    }
    const countDomain = (read: () => number): ProjectOverviewCounter => {
      try {
        return { status: 'counted', value: read() }
      } catch {
        // One domain's storage failure must not zero or fail the other four
        // counters; the client renders this domain as unknown with a retry.
        return { status: 'unavailable' }
      }
    }
    return {
      projectId: id,
      updatedAt: this.options.now(),
      papers: countDomain(() => count(storage.projectPapers.entries())),
      evidences: countDomain(() => count(storage.evidences.entries())),
      datasets: countDomain(() => count(storage.datasets.entries())),
      analyses: countDomain(() => count(storage.analysisRuns.entries())),
      charts: countDomain(() => {
        let total = 0
        for (const [, artifact] of storage.artifacts.entries()) {
          if (artifact.projectId === id && artifact.type === 'figure') total += 1
        }
        return total
      }),
    }
  }

  /**
   * Bind one DSH session to a project (SPEC §41). A later binding replaces the
   * previous one; the session id is DSH-owned and opaque here.
   *
   * Host-only: the tools that establish context call it, and no Remote method
   * exposes it until a client needs to select a project itself.
   * @param sessionId - DSH session id.
   * @param projectId - Project the session is working on.
   * @returns the stored binding.
   * @throws ProjectError when the project does not exist.
   */
  async bindSession(sessionId: string, projectId: ProjectId): Promise<SessionProject> {
    if (this.options.storage.projects.get(projectId) === undefined) {
      throw new ProjectError('PROJECT_NOT_FOUND', `no project ${projectId}`)
    }
    const binding: SessionProject = { sessionId, projectId, updatedAt: this.options.now() }
    await this.options.storage.sessionProjects.put(sessionId, binding)
    return binding
  }

  /**
   * Client-facing project selection: bind the session and audit the switch.
   * @param sessionId - DSH session id.
   * @param projectId - Project the session is working on.
   * @returns the stored binding.
   * @throws ProjectError when the project does not exist.
   */
  @Remote
  async selectProject(sessionId: string, projectId: ProjectId): Promise<SessionProject> {
    const binding = await this.bindSession(sessionId, projectId)
    await this.audit.append({
      action: 'project.select',
      projectId,
      sessionId,
      detail: { updatedAt: binding.updatedAt },
    })
    return binding
  }

  /**
   * Read one session's project binding (SPEC §41).
   * @param sessionId - DSH session id.
   * @returns the binding, or `undefined` when the session has not selected a project.
   */
  @Remote
  async sessionProject(sessionId: string): Promise<SessionProject | undefined> {
    return this.options.storage.sessionProjects.get(sessionId)
  }

  /**
   * List the sessions bound to one project, oldest binding first.
   * @param id - Project id.
   * @returns the bindings.
   * @throws ProjectError when the project does not exist.
   */
  @Remote
  async sessions(id: ProjectId): Promise<SessionProject[]> {
    this.requireProject(id)
    return [...this.options.storage.sessionProjects.entries()]
      .map(([, binding]) => binding)
      .filter(binding => binding.projectId === id)
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
  }

  /** Read the latest persisted mode selection for one session. */
  private persistedMode(sessionId: string): AgentMode {
    let latest: { at: string; id: string; mode: AgentMode } | undefined
    for (const [, row] of this.options.storage.auditLogs.entries()) {
      if (row.action !== 'mode.change' || row.sessionId !== sessionId) continue
      const candidate = agentModeSchema.safeParse(row.detail.mode)
      if (!candidate.success) continue
      if (latest === undefined || row.at > latest.at || (row.at === latest.at && row.id > latest.id)) {
        latest = { at: row.at, id: row.id, mode: candidate.data }
      }
    }
    return latest?.mode ?? 'research'
  }

  /**
   * Apply a persisted mode when an agent is created or resumed. Host-only.
   * @param sessionId - DSH session id.
   */
  activateMode(sessionId: string): void {
    this.modes.apply(sessionId, this.persistedMode(sessionId))
  }

  /**
   * Release the mode restriction when an agent is disposed. Host-only.
   * @param sessionId - DSH session id.
   */
  deactivateMode(sessionId: string): void {
    this.modes.release(sessionId)
  }

  /**
   * Read the current session mode; persisted selections survive a restart.
   * @param sessionId - DSH session id.
   * @returns the active or persisted mode.
   */
  @Remote
  async getMode(sessionId: string): Promise<AgentMode> {
    const id = sessionId.trim()
    if (id === '') throw new Error('sessionId must not be empty')
    return this.modes.has(id) ? this.modes.current(id) : this.persistedMode(id)
  }

  /**
   * Change and audit the session mode, then enforce its tool allowlist.
   * @param sessionId - DSH session id.
   * @param mode - Mode whose tool allowlist should be installed.
   * @returns the validated mode.
   */
  @Remote
  async setMode(sessionId: string, mode: AgentMode): Promise<AgentMode> {
    const id = sessionId.trim()
    if (id === '') throw new Error('sessionId must not be empty')
    const parsed = agentModeSchema.parse(mode)
    const previous = await this.getMode(id)
    this.modes.apply(id, parsed)
    try {
      await this.audit.append({ action: 'mode.change', sessionId: id, detail: { mode: parsed } })
    } catch (error) {
      this.modes.apply(id, previous)
      throw error
    }
    return parsed
  }

  /**
   * Save one already-fetched paper into the project library. Idempotent.
   * @param id - Project id.
   * @param paperId - Paper to save; it must already be stored by the connector.
   * @returns the membership row.
   * @throws ProjectError when the project or the paper does not exist.
   */
  @Remote
  async savePaper(id: ProjectId, paperId: PaperId): Promise<ProjectPaper> {
    const project = this.requireProject(id)
    if (project.status === 'archived') {
      throw new ProjectError('PROJECT_BUSY', `project ${id} is archived and read-only`)
    }
    if (this.options.storage.papers.get(paperId) === undefined) {
      throw new ProjectError('PAPER_NOT_FOUND', `no stored paper ${paperId}; search PubMed first`)
    }
    const membership: ProjectPaper = { projectId: id, paperId, savedAt: this.options.now() }
    await this.options.storage.projectPapers.put(`${id}|${paperId}`, membership)
    return membership
  }
}
