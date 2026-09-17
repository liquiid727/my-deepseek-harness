/**
 * Dataset plugin entry (SPEC §6, §33). Provides `ctx.medDatasets` and registers
 * `dataset_profile` / `dataset_get_schema`.
 * @module @medresearch/dsh-plugin-dataset
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  asToolJson,
  datasetIdSchema,
  projectIdSchema,
  renderToolEnvelope,
  TOOL_ENVELOPE_SCHEMA,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { DatasetError, DatasetsService } from './service.ts'

export { parseCsv, profileColumns } from './csv.ts'
export { DatasetError, DatasetsService } from './service.ts'

/** Cordis plugin name. */
export const name = 'med-dataset'
/** Storage carries datasets; tools registers the tools. */
export const inject = ['tools', 'storageDomain']

/** Raw plugin configuration. */
export interface Config {
  /** Maximum accepted file size in bytes (SPEC §33: CSV <= 100 MB). */
  maxBytes?: number
  /** Maximum accepted data rows (SPEC §33: <= 1,000,000). */
  maxRows?: number
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  maxBytes: z.number().step(1).min(1).default(100 * 1024 * 1024),
  maxRows: z.number().step(1).min(1).default(1_000_000),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    medDatasets: DatasetsService
  }
}

function datasetTools(service: DatasetsService): ToolDefinition[] {
  return [
    defineTool({
      name: 'dataset_profile',
      description:
        'Parse and profile a CSV file for a project. Returns rows, columns, and per-column type, '
        + 'missing/unique counts, and range/mean/median for continuous columns. Row-level values are never returned.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project the dataset belongs to.' },
        fileRef: { type: 'string', required: true, description: 'Absolute path of the CSV file.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const dataset = await service.upload({
            projectId: projectIdSchema.parse(args.projectId),
            fileRef: args.fileRef,
          })
          return { ok: true, result: asToolJson(dataset) }
        } catch (error) {
          if (error instanceof DatasetError) {
            return {
              ok: false,
              error: asToolJson({
                code: error.code,
                message: error.message,
                retryable: false,
                partialDataAvailable: false,
                source: 'dataset',
              }),
            }
          }
          throw error
        }
      },
    }),
    defineTool({
      name: 'dataset_get_schema',
      description: 'Return one dataset\'s profiled column schema.',
      parameters: {
        datasetId: { type: 'string', required: true, description: 'Dataset id returned by dataset_profile.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const columns = await service.schema(datasetIdSchema.parse(args.datasetId))
          return { ok: true, result: asToolJson(columns) }
        } catch (error) {
          if (error instanceof DatasetError) {
            return {
              ok: false,
              error: asToolJson({
                code: error.code,
                message: error.message,
                retryable: false,
                partialDataAvailable: false,
                source: 'dataset',
              }),
            }
          }
          throw error
        }
      },
    }),
    defineTool({
      name: 'dataset_preview',
      description: 'Return at most five rows for the authenticated UI preview; this is not model context.',
      parameters: { datasetId: { type: 'string', required: true, description: 'Dataset id.' }, rows: { type: 'integer', description: 'Maximum five preview rows.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try { return { ok: true, result: asToolJson(await service.preview(datasetIdSchema.parse(args.datasetId), args.rows)) } } catch (error) {
          if (error instanceof DatasetError) return { ok: false, error: asToolJson({ code: error.code, message: error.message, retryable: false, partialDataAvailable: false, source: 'dataset' }) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'dataset_list',
      description: 'List project-scoped dataset profiles without returning rows.',
      parameters: { projectId: { type: 'string', required: true, description: 'Project id.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) { return { ok: true, result: asToolJson(await service.list(projectIdSchema.parse(args.projectId))) } },
    }),
  ]
}

/**
 * Mount the dataset capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.dataset.storage')
  const resolved = config as Required<Config>
  const service = new DatasetsService({
    storage,
    maxBytes: resolved.maxBytes,
    maxRows: resolved.maxRows,
    readFile: path => readFile(path, 'utf8'),
    readBytes: path => readFile(path),
    now: () => new Date().toISOString(),
    newDatasetId: () => datasetIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medDatasets', service), 'med.dataset.service')
  for (const tool of datasetTools(service)) ctx.tools.register(tool)
}
