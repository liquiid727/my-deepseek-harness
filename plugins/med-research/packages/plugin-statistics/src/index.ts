/**
 * Statistics plugin entry (SPEC §6, §34–§37, §40). Provides
 * `ctx.medStatistics`, registers the `statistics_*` tools, and installs the
 * `tools/pre-execute` approval policy for `statistics_execute`.
 * @module @medresearch/dsh-plugin-statistics
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  analysisRunIdSchema,
  analysisPlanSchema,
  asToolJson,
  datasetIdSchema,
  projectIdSchema,
  renderToolEnvelope,
  TOOL_ENVELOPE_SCHEMA,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { approvalDecision } from './approval.ts'
import { StatisticsError, StatisticsService, type ArtifactRegistrar } from './service.ts'

export { approvalDecision, APPROVAL_REQUIRED_TOOLS } from './approval.ts'
export { StatisticsError, StatisticsService } from './service.ts'
export { ChartSpecError, renderChartSvg, type ChartSpec } from './charts.ts'

/** Cordis plugin name. */
export const name = 'med-statistics'
/**
 * Execution requires the runner, storage, tool registries, and the artifact
 * registrar: a succeeded run's outputs must become artifacts (Gate 5), and
 * resolving the registrar at apply time would otherwise race a later
 * activation and silently drop them.
 */
export const inject = ['tools', 'storageDomain', 'medRunner', 'medArtifacts']

/** Raw plugin configuration. */
export interface Config {
  /** Wall-clock limit per execution. */
  timeoutMs?: number
  /** CPU-second limit passed to the runner. */
  cpuSeconds?: number
  /** Address-space limit in MB. */
  memoryMb?: number
  /** Maximum captured stdout+stderr bytes. */
  maxOutputBytes?: number
  /** Third-party packages generated code may import. */
  allowlist?: string[]
  /** Durable directory a run's outputs are copied into before artifact registration (Gate 5). */
  artifactRoot: string
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  timeoutMs: z.number().step(1).min(1).default(120_000),
  cpuSeconds: z.number().step(1).min(1).default(60),
  memoryMb: z.number().step(1).min(16).default(1024),
  maxOutputBytes: z.number().step(1).min(1).default(200_000),
  allowlist: z.array(z.string()).default([]),
  artifactRoot: z.string().required(),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    medStatistics: StatisticsService
  }
}

function statisticsTools(service: StatisticsService): ToolDefinition[] {
  const toDomainError = (error: StatisticsError) => ({
    code: error.code,
    message: error.message,
    retryable: false,
    partialDataAvailable: false,
    source: 'statistics',
    ...error.details === undefined ? {} : { details: error.details },
  })

  return [
    defineTool({
      name: 'statistics_plan',
      description:
        'Persist an analysis plan for a dataset. Nothing executes: the plan is stored with status '
        + 'planned and waits for the user to confirm before code generation.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project the analysis belongs to.' },
        datasetId: { type: 'string', required: true, description: 'Dataset id returned by dataset_profile.' },
        question: { type: 'string', required: true, description: 'Statistical question.' },
        plan: { type: 'json', required: true, description: 'AnalysisPlan: objective, outcome, exposures, covariates, steps, assumptions, warnings.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const run = await service.plan({
            projectId: projectIdSchema.parse(args.projectId),
            datasetId: datasetIdSchema.parse(args.datasetId),
            question: args.question,
            plan: analysisPlanSchema.parse(args.plan),
          })
          return { ok: true, result: asToolJson(run) }
        } catch (error) {
          if (error instanceof StatisticsError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'statistics_generate_code',
      description:
        'Attach generated Python to a planned run and mark it approved. The code is stored with its '
        + 'hash for provenance; it still does not execute until statistics_execute is approved.',
      parameters: {
        analysisRunId: { type: 'string', required: true, description: 'Run returned by statistics_plan.' },
        code: { type: 'string', required: true, description: 'Generated Python source.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const run = await service.generateCode(analysisRunIdSchema.parse(args.analysisRunId), args.code)
          return { ok: true, result: asToolJson(run) }
        } catch (error) {
          if (error instanceof StatisticsError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'statistics_execute',
      description:
        'Execute an approved run in the isolated runner. This call requires user approval; a failed '
        + 'run keeps its code and stderr and produces no result table.',
      parameters: {
        analysisRunId: { type: 'string', required: true, description: 'Approved run to execute.' },
        datasetPath: { type: 'string', required: true, description: 'Absolute path of the dataset file.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const result = await service.execute({
            analysisRunId: analysisRunIdSchema.parse(args.analysisRunId),
            datasetPath: args.datasetPath,
          })
          return { ok: true, result: asToolJson(result) }
        } catch (error) {
          if (error instanceof StatisticsError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'statistics_approve_code',
      description: 'Approve the exact generated code and dataset hash after human review.',
      parameters: { analysisRunId: { type: 'string', required: true, description: 'Run waiting for approval.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try { return { ok: true, result: asToolJson(await service.approveCode(analysisRunIdSchema.parse(args.analysisRunId))) } } catch (error) {
          if (error instanceof StatisticsError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'statistics_list_runs',
      description: 'List immutable analysis history for a project.',
      parameters: { projectId: { type: 'string', required: true, description: 'Project id.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) { return { ok: true, result: asToolJson(await service.listRuns(projectIdSchema.parse(args.projectId))) } },
    }),
  ]
}

/**
 * Mount the statistics capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.statistics.storage')
  const resolved = config as Required<Config>
  const service = new StatisticsService({
    storage,
    runner: ctx.medRunner,
    limits: {
      timeoutMs: resolved.timeoutMs,
      cpuSeconds: resolved.cpuSeconds,
      memoryMb: resolved.memoryMb,
      maxOutputBytes: resolved.maxOutputBytes,
    },
    allowlist: resolved.allowlist,
    now: () => new Date().toISOString(),
    newRunId: () => analysisRunIdSchema.parse(randomUUID()),
    artifacts: ctx.medArtifacts as unknown as ArtifactRegistrar,
    artifactRoot: resolved.artifactRoot,
  })
  ctx.effect(() => ctx.provide('medStatistics', service), 'med.statistics.service')
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = approvalDecision(exec.name)
    return decision.kind === 'allow' ? next() : decision
  })
  for (const tool of statisticsTools(service)) ctx.tools.register(tool)
}
