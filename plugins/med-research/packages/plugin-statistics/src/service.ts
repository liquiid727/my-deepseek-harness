/**
 * Statistics service (SPEC §34–§37). Persists the agent-proposed plan, then
 * generated code, then runs the code through the injected {@link StatisticsRunner}.
 * A failed run keeps its code and stderr and never stores a result (FR-18, FR-20).
 * @module @medresearch/dsh-plugin-statistics/src/service
 */

import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type {
  AnalysisPlan,
  AnalysisRun,
  AnalysisRunId,
  Artifact,
  DatasetId,
  MedStatisticsService,
  ProjectId,
  RunOutput,
  StatisticsRunInput,
  StatisticsRunResult,
  StatisticsRunner,
} from '@medresearch/dsh-medical-contracts'

/** Minimal artifact-registration capability the statistics plugin needs. */
export interface ArtifactRegistrar {
  register(input: {
    projectId: ProjectId
    analysisRunId: AnalysisRunId
    outputs: readonly RunOutput[]
  }): Promise<Artifact[]>
}
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/** Stable planning failures exposed by the statistics tool surface (SPEC §46). */
export type StatisticsErrorCode = 'DATASET_NOT_FOUND' | 'STATISTICS_PLAN_INVALID'

/** A deterministic, machine-readable statistics planning failure. */
export class StatisticsError extends Error {
  override readonly name = 'StatisticsError'

  constructor(
    readonly code: StatisticsErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

/** Construction dependencies of {@link StatisticsService}. */
export interface StatisticsServiceOptions {
  storage: MedStorage
  runner: StatisticsRunner
  /** Resource limits and package allowlist applied to every execution. */
  limits: StatisticsRunInput['limits']
  allowlist: string[]
  /** Current time as an ISO string. */
  now: () => string
  /** New run identity. */
  newRunId: () => AnalysisRunId
  /** Artifact registrar; absent when the artifact plugin is not mounted. */
  artifacts?: ArtifactRegistrar
  /** Durable directory produced files are copied into; absent disables artifacts. */
  artifactRoot?: string
}

/** Statistics planning and execution capabilities. */
export class StatisticsService implements MedStatisticsService {
  /** Typert Gateway binding: the Web client reaches these methods as `medStatistics/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medStatistics')

  /** Audit trail for run approval and execution (SPEC §49). */
  private readonly audit: AuditWriter

  /**
   * @param options - Storage, runner, limits, and identity.
   */
  constructor(private readonly options: StatisticsServiceOptions) {
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
  }

  /**
   * Persist a proposed plan as a `planned` run. Nothing executes.
   * @param input - Project, dataset, question, and the agent's plan.
   * @returns the stored run.
   * @throws StatisticsError when the dataset does not exist.
   */
  @Remote
  async plan(input: { projectId: ProjectId; datasetId: DatasetId; question: string; plan: AnalysisPlan }): Promise<AnalysisRun> {
    const dataset = this.options.storage.datasets.get(input.datasetId)
    if (dataset === undefined) {
      throw new StatisticsError('DATASET_NOT_FOUND', `no dataset ${input.datasetId}`, {
        datasetId: input.datasetId,
      })
    }
    const run: AnalysisRun = {
      id: this.options.newRunId(),
      projectId: input.projectId,
      datasetId: input.datasetId,
      datasetHash: dataset.contentHash,
      question: input.question,
      analysisPlan: input.plan,
      language: 'python',
      generatedCode: '',
      codeHash: createHash('sha256').update('').digest('hex'),
      runtime: 'python',
      runtimeVersion: 'unknown',
      packageVersions: {},
      status: 'planned',
      artifactIds: [],
      createdAt: this.options.now(),
    }
    await this.options.storage.analysisRuns.put(run.id, run)
    return run
  }

  /**
   * Read one stored analysis run without a Remote round trip. In-process
   * callers (composition checks, tests) use this; the browser reads the same
   * record through {@link run}.
   * @param id - Run id.
   * @returns the run, or `undefined`.
   */
  peekRun(id: AnalysisRunId): AnalysisRun | undefined {
    return this.options.storage.analysisRuns.get(id)
  }

  /**
   * Read one stored analysis run for the authenticated client.
   * @param id - Run id.
   * @returns the run with its input versions, or `undefined`.
   */
  @Remote
  async run(id: AnalysisRunId): Promise<AnalysisRun | undefined> {
    return this.options.storage.analysisRuns.get(id)
  }

  /**
   * List the chart artifacts one project's successful runs published.
   *
   * Only artifacts belonging to a `succeeded` run are returned, so a failed or
   * cancelled run can never contribute a figure the UI would show as a result.
   * @param projectId - Project scope.
   * @returns chart artifacts, newest run first.
   */
  @Remote
  async listCharts(projectId: ProjectId): Promise<Artifact[]> {
    if (this.options.artifacts === undefined) return []
    const succeeded = new Set(
      [...this.options.storage.analysisRuns.entries()]
        .map(([, run]) => run)
        .filter(run => run.projectId === projectId && run.status === 'succeeded')
        .map(run => run.id),
    )
    const charts: Artifact[] = []
    for (const [, artifact] of this.options.storage.artifacts.entries()) {
      if (artifact.projectId !== projectId || artifact.analysisRunId === undefined || !succeeded.has(artifact.analysisRunId)) continue
      charts.push(artifact)
    }
    return charts.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))
  }

  /**
   * Persist generated code and mark the run approved.
   * @param id - Run id.
   * @param code - Generated Python.
   * @returns the updated run.
   * @throws StatisticsError when the run does not exist or is not `planned`.
   */
  @Remote
  async generateCode(id: AnalysisRunId, code: string): Promise<AnalysisRun> {
    const run = this.options.storage.analysisRuns.get(id)
    if (run === undefined) {
      throw new StatisticsError('STATISTICS_PLAN_INVALID', `no analysis run ${id}`, {
        analysisRunId: id,
      })
    }
    if (run.status !== 'planned') {
      throw new StatisticsError('STATISTICS_PLAN_INVALID', `run ${id} is ${run.status}, not planned`, {
        analysisRunId: id,
        status: run.status,
      })
    }
    const updated: AnalysisRun = {
      ...run,
      generatedCode: code,
      codeHash: createHash('sha256').update(code).digest('hex'),
      status: 'waiting_approval',
    }
    await this.options.storage.analysisRuns.put(id, updated)
    return updated
  }

  /** Approve the generated code after the user has reviewed its immutable hashes. */
  @Remote
  async approveCode(id: AnalysisRunId): Promise<AnalysisRun> {
    const run = this.options.storage.analysisRuns.get(id)
    if (run === undefined || run.status !== 'waiting_approval') {
      throw new StatisticsError('STATISTICS_PLAN_INVALID', `run ${id} is not waiting for approval`, { analysisRunId: id, status: run?.status })
    }
    const approved: AnalysisRun = {
      ...run,
      status: 'approved',
      approval: {
        datasetHash: run.datasetHash,
        codeHash: run.codeHash,
        planHash: createHash('sha256').update(JSON.stringify(run.analysisPlan)).digest('hex'),
        policyVersion: 'med-statistics-runner-v1',
        approvedAt: this.options.now(),
      },
    }
    await this.options.storage.analysisRuns.put(id, approved)
    await this.audit.append({
      action: 'statistics.approve',
      projectId: run.projectId,
      detail: { analysisRunId: id, codeHash: approved.codeHash, planHash: approved.approval?.planHash },
    })
    return approved
  }

  /**
   * Execute an approved run's code through the isolated runner.
   * @param input - Run id plus the dataset path to execute against.
   * @returns the runner's machine-only result.
   * @throws StatisticsError when the run is missing or not approved.
   */
  @Remote
  async execute(input: { analysisRunId: AnalysisRunId; datasetPath: string }): Promise<StatisticsRunResult> {
    const run = this.options.storage.analysisRuns.get(input.analysisRunId)
    if (run === undefined) {
      throw new StatisticsError('STATISTICS_PLAN_INVALID', `no analysis run ${input.analysisRunId}`, {
        analysisRunId: input.analysisRunId,
      })
    }
    if (run.status !== 'approved') {
      throw new StatisticsError('STATISTICS_PLAN_INVALID', `run ${input.analysisRunId} is ${run.status}, not approved`, {
        analysisRunId: input.analysisRunId,
        status: run.status,
      })
    }
    if (run.approval === undefined || run.approval.datasetHash !== run.datasetHash || run.approval.codeHash !== run.codeHash || run.approval.planHash !== createHash('sha256').update(JSON.stringify(run.analysisPlan)).digest('hex')) {
      throw new StatisticsError('STATISTICS_PLAN_INVALID', `run ${input.analysisRunId} approval is stale`, { analysisRunId: input.analysisRunId })
    }
    const running: AnalysisRun = { ...run, status: 'running' }
    await this.options.storage.analysisRuns.put(run.id, running)

    const outputDir = this.options.artifacts === undefined || this.options.artifactRoot === undefined
      ? undefined
      : join(this.options.artifactRoot, run.id)
    const result = await this.options.runner.execute({
      datasetPath: input.datasetPath,
      code: run.generatedCode,
      limits: this.options.limits,
      allowlist: this.options.allowlist,
      ...outputDir === undefined ? {} : { outputDir },
    })
    const finished: AnalysisRun = {
      ...running,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      ...result.resultJson === undefined ? {} : { resultJson: result.resultJson },
      runtime: result.runtime.language,
      runtimeVersion: result.runtime.version,
      packageVersions: result.runtime.packages,
      finishedAt: this.options.now(),
    }
    // Persist the terminal status first: artifact registration reads the run
    // back and refuses anything that is not already `succeeded`.
    await this.options.storage.analysisRuns.put(run.id, finished)
    // The audit row records the execution itself; it precedes artifact
    // registration so a registration failure cannot erase the fact that code
    // ran and what it returned.
    await this.audit.append({
      action: 'code.execute',
      projectId: run.projectId,
      detail: { analysisRunId: run.id, status: result.status, outputs: result.outputs.length },
    })
    if (result.status === 'succeeded' && result.outputs.length > 0 && this.options.artifacts !== undefined) {
      const artifacts = await this.options.artifacts.register({
        projectId: run.projectId,
        analysisRunId: run.id,
        outputs: result.outputs,
      })
      await this.options.storage.analysisRuns.put(run.id, {
        ...finished,
        artifactIds: artifacts.map(artifact => artifact.id),
      })
    }
    return result
  }

  /** List immutable analysis history for one project. */
  @Remote
  async listRuns(projectId: ProjectId): Promise<AnalysisRun[]> {
    return [...this.options.storage.analysisRuns.entries()].map(([, run]) => run).filter(run => run.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }
}
