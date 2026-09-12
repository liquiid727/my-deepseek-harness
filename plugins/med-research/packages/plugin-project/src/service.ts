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
export type ProjectErrorCode = 'PROJECT_NOT_FOUND' | 'PAPER_NOT_FOUND'

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
   */
  @Remote
  async create(input: ProjectCreateInput): Promise<Project> {
    const validated = projectCreateInputSchema.parse(input)
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
   * @returns the updated project.
   * @throws ProjectError when the project does not exist.
   */
  @Remote
  async update(id: ProjectId, patch: ProjectPatch): Promise<Project> {
    const current = this.options.storage.projects.get(id)
    if (current === undefined) throw new ProjectError('PROJECT_NOT_FOUND', `no project ${id}`)
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
   * Count the records that belong to one project.
   * @param id - Project id.
   * @returns overview counters.
   * @throws ProjectError when the project does not exist.
   */
  @Remote
  async overview(id: ProjectId): Promise<ProjectOverview> {
    if (this.options.storage.projects.get(id) === undefined) {
      throw new ProjectError('PROJECT_NOT_FOUND', `no project ${id}`)
    }
    const count = <T extends { projectId?: string }>(entries: IterableIterator<[string, T]>): number => {
      let total = 0
      for (const [, record] of entries) if (record.projectId === id) total += 1
      return total
    }
    const { storage } = this.options
    return {
      projectId: id,
      questions: count(storage.researchQueries.entries()),
      papers: count(storage.projectPapers.entries()),
      evidences: count(storage.evidences.entries()),
      datasets: count(storage.datasets.entries()),
      analyses: count(storage.analysisRuns.entries()),
      charts: count(storage.artifacts.entries()),
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
   * Read one session's project binding (SPEC §41).
   * @param sessionId - DSH session id.
   * @returns the binding, or `undefined` when the session has not selected a project.
   */
  async sessionProject(sessionId: string): Promise<SessionProject | undefined> {
    return this.options.storage.sessionProjects.get(sessionId)
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
    if (this.options.storage.projects.get(id) === undefined) {
      throw new ProjectError('PROJECT_NOT_FOUND', `no project ${id}`)
    }
    if (this.options.storage.papers.get(paperId) === undefined) {
      throw new ProjectError('PAPER_NOT_FOUND', `no stored paper ${paperId}; search PubMed first`)
    }
    const membership: ProjectPaper = { projectId: id, paperId, savedAt: this.options.now() }
    await this.options.storage.projectPapers.put(`${id}|${paperId}`, membership)
    return membership
  }
}
