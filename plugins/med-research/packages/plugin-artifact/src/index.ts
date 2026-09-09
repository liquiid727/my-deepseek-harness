/**
 * Artifact plugin entry (SPEC §6, §38). Provides `ctx.medArtifacts` and
 * registers `artifact_get` / `artifact_export`.
 * @module @medresearch/dsh-plugin-artifact
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  artifactIdSchema,
  asToolJson,
  MED_ARTIFACT_CONTENT_TYPES,
  MED_ARTIFACT_EXPORT_PATH,
  MED_ARTIFACT_FORMATS,
  renderToolEnvelope,
  TOOL_ENVELOPE_SCHEMA,
  type MedArtifactFormat,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { ArtifactError, ArtifactService } from './service.ts'

export { ArtifactError, ArtifactService } from './service.ts'

/** Cordis plugin name. */
export const name = 'med-artifact'
/** Storage carries artifact records; tools registers the tools. */
export const inject = ['tools', 'storageDomain']

/** Raw plugin configuration. */
export interface Config {
  /** Durable directory artifact files are copied into. */
  artifactRoot: string
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  artifactRoot: z.string().required(),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    medArtifacts: ArtifactService
  }
}

function artifactTools(service: ArtifactService): ToolDefinition[] {
  return [
    defineTool({
      name: 'artifact_get',
      description:
        'Read one artifact record, including the analysis run, dataset hash, and code hash it came from.',
      parameters: {
        artifactId: { type: 'string', required: true, description: 'Artifact id.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const artifact = await service.get(artifactIdSchema.parse(args.artifactId))
        if (artifact === undefined) {
          return {
            ok: false,
            error: asToolJson({
              code: 'ARTIFACT_NOT_FOUND',
              message: `no artifact ${args.artifactId}`,
              retryable: false,
              partialDataAvailable: false,
              source: 'artifact',
            }),
          }
        }
        return { ok: true, result: asToolJson(artifact) }
      },
    }),
    defineTool({
      name: 'artifact_export',
      description:
        'Export one artifact\'s bytes in its own format. Returns base64 plus size; the UI reads the '
        + 'service directly for large files.',
      parameters: {
        artifactId: { type: 'string', required: true, description: 'Artifact to export.' },
        format: { type: 'string', required: true, enum: ['png', 'svg', 'csv', 'json'], description: 'Export format.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const bytes = await service.export(
            artifactIdSchema.parse(args.artifactId),
            args.format as 'png' | 'svg' | 'csv' | 'json',
          )
          return {
            ok: true,
            result: asToolJson({ artifactId: args.artifactId, format: args.format, size: bytes.byteLength, base64: Buffer.from(bytes).toString('base64') }),
          }
        } catch (error) {
          if (error instanceof ArtifactError) {
            return {
              ok: false,
              error: asToolJson({
                code: error.code === 'RUN_NOT_SUCCEEDED' ? 'ARTIFACT_RUN_NOT_SUCCEEDED' : 'ARTIFACT_NOT_FOUND',
                message: error.message,
                retryable: false,
                partialDataAvailable: false,
                source: 'artifact',
              }),
            }
          }
          throw error
        }
      },
    }),
  ]
}

/**
 * Build the artifact download response for one authenticated Fetch request.
 * @param service - artifact service owning the stored bytes.
 * @param request - request whose `id` and `format` query parameters name the export.
 * @returns the bytes with their media type, or a diagnostic status.
 */
export async function artifactExportResponse(
  service: ArtifactService,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const format = url.searchParams.get('format')
  if (id === null || id === '' || format === null
    || !(MED_ARTIFACT_FORMATS as readonly string[]).includes(format)) {
    return new Response('missing or invalid id/format query parameter', { status: 400 })
  }
  try {
    const bytes = await service.export(artifactIdSchema.parse(id), format as MedArtifactFormat)
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': MED_ARTIFACT_CONTENT_TYPES[format as MedArtifactFormat],
        'content-length': String(bytes.byteLength),
      },
    })
  } catch (error) {
    if (error instanceof ArtifactError) {
      return new Response(error.message, { status: error.code === 'ARTIFACT_NOT_FOUND' ? 404 : 409 })
    }
    throw error
  }
}

/** Connection shape this plugin uses; the service is Web-only. */
interface ExportConnection {
  fetch: { register(route: {
    readonly path: string
    readonly methods: readonly ('GET' | 'HEAD')[]
    readonly requestBody: 'buffered'
    readonly fetch: (request: Request) => Promise<Response>
  }): () => Promise<void> }
}

/**
 * Mount the artifact capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.artifact.storage')
  await mkdir(config.artifactRoot, { recursive: true })
  const service = new ArtifactService({
    storage,
    artifactRoot: config.artifactRoot,
    copy: async (from, to) => { await copyFile(from, to) },
    readBytes: async path => readFile(path),
    now: () => new Date().toISOString(),
    newArtifactId: () => artifactIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medArtifacts', service), 'med.artifact.service')
  for (const tool of artifactTools(service)) ctx.tools.register(tool)

  // The download route needs a browser channel; a composition without one
  // (headless, ACP) has no Web surface to serve.
  const connection = ctx.get('connection') as ExportConnection | undefined
  if (connection !== undefined) {
    ctx.effect(() => connection.fetch.register({
      path: MED_ARTIFACT_EXPORT_PATH,
      methods: ['GET', 'HEAD'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const response = await artifactExportResponse(service, request)
        if (request.method === 'GET') return response
        await response.body?.cancel()
        return new Response(null, { status: response.status, headers: response.headers })
      },
    }), 'med.artifact.exportRoute')
  }
}
