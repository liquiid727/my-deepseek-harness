/**
 * Statistics-chain records and inputs (SPEC §13–§14, §34–§38). Row-level
 * dataset content never appears here: the model-visible surface is schema,
 * profile, and aggregate results only (SPEC §47, §50).
 * @module @medresearch/dsh-medical-contracts/src/statistics
 */

import { z } from 'zod'
import { analysisRunIdSchema, artifactIdSchema, datasetIdSchema, projectIdSchema } from './ids.ts'

/** Inferred statistical role of a dataset column (SPEC §13). */
export const columnTypeSchema = z.enum([
  'continuous',
  'ordinal',
  'binary',
  'categorical',
  'date',
  'id',
  'unknown',
])
/** Inferred statistical role of a dataset column (SPEC §13). */
export type ColumnType = z.infer<typeof columnTypeSchema>

/** One profiled dataset column (SPEC §13). */
export const datasetColumnSchema = z.strictObject({
  name: z.string().min(1),
  inferredType: columnTypeSchema,
  nullable: z.boolean(),
  missingCount: z.number().int().nonnegative(),
  uniqueCount: z.number().int().nonnegative(),
  min: z.number().optional(),
  max: z.number().optional(),
  mean: z.number().optional(),
  median: z.number().optional(),
})
/** One profiled dataset column (SPEC §13). */
export type DatasetColumn = z.infer<typeof datasetColumnSchema>

/** One uploaded and profiled dataset (SPEC §13). */
export const datasetSchema = z.strictObject({
  id: datasetIdSchema,
  projectId: projectIdSchema,
  filename: z.string().min(1),
  contentHash: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  columnCount: z.number().int().nonnegative(),
  schema: z.array(datasetColumnSchema),
  createdAt: z.string(),
})
/** One uploaded and profiled dataset (SPEC §13). */
export type Dataset = z.infer<typeof datasetSchema>

/** One planned analysis step (SPEC §34). */
export const analysisStepSchema = z.strictObject({
  id: z.string().min(1),
  method: z.string().min(1),
  reason: z.string().min(1),
  variables: z.array(z.string()),
})
/** One planned analysis step (SPEC §34). */
export type AnalysisStep = z.infer<typeof analysisStepSchema>

/** Analysis plan shown for approval before any code runs (SPEC §34). */
export const analysisPlanSchema = z.strictObject({
  objective: z.string().min(1),
  outcome: z.string().optional(),
  exposures: z.array(z.string()),
  covariates: z.array(z.string()),
  steps: z.array(analysisStepSchema),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
})
/** Analysis plan shown for approval before any code runs (SPEC §34). */
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>

/** Lifecycle of one analysis run (SPEC §14). */
export const analysisRunStatusSchema = z.enum(['planned', 'waiting_approval', 'approved', 'running', 'succeeded', 'failed', 'cancelled'])
/** Lifecycle of one analysis run (SPEC §14). */
export type AnalysisRunStatus = z.infer<typeof analysisRunStatusSchema>

/** One executed (or planned) statistical analysis with full provenance (SPEC §14). */
export const analysisRunSchema = z.strictObject({
  id: analysisRunIdSchema,
  projectId: projectIdSchema,
  datasetId: datasetIdSchema,
  datasetHash: z.string().min(1),
  question: z.string().min(1),
  analysisPlan: analysisPlanSchema,
  language: z.literal('python'),
  generatedCode: z.string(),
  codeHash: z.string().min(1),
  /** Approval identity; execution is valid only while these hashes match. */
  approval: z.strictObject({
    datasetHash: z.string().min(1),
    codeHash: z.string().min(1),
    planHash: z.string().min(1),
    policyVersion: z.string().min(1),
    approvedAt: z.string(),
  }).optional(),
  runtime: z.string().min(1),
  runtimeVersion: z.string().min(1),
  packageVersions: z.record(z.string(), z.string()),
  status: analysisRunStatusSchema,
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  resultJson: z.unknown().optional(),
  artifactIds: z.array(artifactIdSchema),
  createdAt: z.string(),
  finishedAt: z.string().optional(),
})
/** One executed (or planned) statistical analysis with full provenance (SPEC §14). */
export type AnalysisRun = z.infer<typeof analysisRunSchema>

/** Artifact kind (SPEC §38). */
export const artifactTypeSchema = z.enum(['figure', 'table', 'file'])
/** Artifact kind (SPEC §38). */
export type ArtifactType = z.infer<typeof artifactTypeSchema>

/** One produced figure, table, or file, traceable to its run (SPEC §38). */
export const artifactSchema = z.strictObject({
  id: artifactIdSchema,
  projectId: projectIdSchema,
  analysisRunId: analysisRunIdSchema.optional(),
  type: artifactTypeSchema,
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  datasetHash: z.string().optional(),
  codeHash: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
})
/** One produced figure, table, or file, traceable to its run (SPEC §38). */
export type Artifact = z.infer<typeof artifactSchema>

/** Kind of a runner output entry (SPEC §37). */
export const runOutputSchema = z.strictObject({
  type: z.enum(['table', 'figure', 'file']),
  path: z.string().min(1),
  mimeType: z.string().min(1),
})
/** Kind of a runner output entry (SPEC §37). */
export type RunOutput = z.infer<typeof runOutputSchema>

/** Runtime identity recorded with every run (SPEC §37). */
export const runRuntimeSchema = z.strictObject({
  language: z.literal('python'),
  version: z.string().min(1),
  packages: z.record(z.string(), z.string()),
})
/** Runtime identity recorded with every run (SPEC §37). */
export type RunRuntime = z.infer<typeof runRuntimeSchema>

/** Machine-only result returned by the isolated runner (SPEC §37). */
export const statisticsRunResultSchema = z.strictObject({
  status: z.enum(['succeeded', 'failed']),
  stdout: z.string(),
  stderr: z.string(),
  resultJson: z.unknown().optional(),
  outputs: z.array(runOutputSchema),
  runtime: runRuntimeSchema,
})
/** Machine-only result returned by the isolated runner (SPEC §37). */
export type StatisticsRunResult = z.infer<typeof statisticsRunResultSchema>

/** Resource limits every execution must carry (SPEC §35). */
export const runnerLimitsSchema = z.strictObject({
  timeoutMs: z.number().int().positive(),
  cpuSeconds: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  maxOutputBytes: z.number().int().positive(),
})
/** Resource limits every execution must carry (SPEC §35). */
export type RunnerLimits = z.infer<typeof runnerLimitsSchema>

/** Input of one isolated execution (SPEC §35). */
export const statisticsRunInputSchema = z.strictObject({
  datasetPath: z.string().min(1),
  code: z.string().min(1),
  limits: runnerLimitsSchema,
  allowlist: z.array(z.string().min(1)),
  /** Durable directory produced files are copied into; absent leaves them in the runner's temp area. */
  outputDir: z.string().min(1).optional(),
})
/** Input of one isolated execution (SPEC §35). */
export type StatisticsRunInput = z.infer<typeof statisticsRunInputSchema>

/**
 * The statistics execution seam (SPEC §35). Business code depends on this
 * interface only; the V1 provider is `medical-runner-container`, and DSH's
 * experimental `code-runtime-python` is not a valid provider (AGENTS.md §2.5).
 */
export interface StatisticsRunner {
  /**
   * Execute generated analysis code against one read-only dataset.
   * @param input - Dataset path, code, resource limits, and package allowlist.
   * @returns the machine-only run result; a failed run reports `status: 'failed'`.
   */
  execute(input: StatisticsRunInput): Promise<StatisticsRunResult>
}
