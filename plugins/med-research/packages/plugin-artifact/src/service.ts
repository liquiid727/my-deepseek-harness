/**
 * Artifact service (SPEC §38, Gate 5). Every artifact is created from a
 * succeeded {@link AnalysisRun} and carries that run's id, dataset hash, and
 * code hash, so each figure or table traces back to a real execution.
 * @module @medresearch/dsh-plugin-artifact/src/service
 */

import { extname, join } from 'node:path'
import type {
  AnalysisRunId,
  Artifact,
  ArtifactId,
  MedArtifactsService,
  ProjectId,
  RunOutput,
} from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/** Construction dependencies of {@link ArtifactService}. */
export interface ArtifactServiceOptions {
  storage: MedStorage
  /** Durable root the artifact files are copied into. */
  artifactRoot: string
  /** Copy one produced file to its durable path. */
  copy: (from: string, to: string) => Promise<void>
  /** Read a durable artifact file. */
  readBytes: (path: string) => Promise<Uint8Array>
  /** Current time as an ISO string. */
  now: () => string
  /** New artifact identity. */
  newArtifactId: () => ArtifactId
}

/** Stable artifact failure codes. */
export type ArtifactErrorCode = 'ARTIFACT_NOT_FOUND' | 'RUN_NOT_FOUND' | 'RUN_NOT_SUCCEEDED' | 'FORMAT_MISMATCH' | 'FIGURE_FORMAT_UNSUPPORTED'

/** Thrown when an artifact cannot be registered, read, or exported. */
export class ArtifactError extends Error {
  override readonly name = 'ArtifactError'

  /**
   * @param code - Stable discriminant.
   * @param message - Diagnostic detail.
   */
  constructor(readonly code: ArtifactErrorCode, message: string) {
    super(message)
  }
}

/** MIME type expected for one export format. */
const FORMAT_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  json: 'application/json',
}

/** Run-linked artifact capabilities. */
export class ArtifactService implements MedArtifactsService {
  /** Typert Gateway binding: the Web client reaches these methods as `medArtifacts/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medArtifacts')

  /** Audit trail for exports (SPEC §49). */
  private readonly audit: AuditWriter

  /**
   * @param options - Storage, durable root, and file access.
   */
  constructor(private readonly options: ArtifactServiceOptions) {
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
  }

  /**
   * Register the outputs of one succeeded run as durable artifacts.
   * @param input - Project, run, and produced outputs.
   * @returns the created artifacts.
   * @throws ArtifactError when the run is missing or did not succeed (Gate 5).
   */
  async register(input: {
    projectId: ProjectId
    analysisRunId: AnalysisRunId
    outputs: readonly RunOutput[]
  }): Promise<Artifact[]> {
    const run = this.options.storage.analysisRuns.get(input.analysisRunId)
    if (run === undefined) throw new ArtifactError('RUN_NOT_FOUND', `no analysis run ${input.analysisRunId}`)
    if (run.status !== 'succeeded') {
      throw new ArtifactError('RUN_NOT_SUCCEEDED', `run ${input.analysisRunId} is ${run.status}, not succeeded`)
    }
    for (const output of input.outputs) {
      if (output.type !== 'figure') continue
      const extension = extname(output.path).toLowerCase()
      const valid = output.mimeType === 'image/png' && extension === '.png'
        || output.mimeType === 'image/svg+xml' && extension === '.svg'
      if (!valid) {
        throw new ArtifactError('FIGURE_FORMAT_UNSUPPORTED', `figure output ${output.path} does not match the PNG/SVG export contract`)
      }
    }
    const artifacts: Artifact[] = []
    for (const output of input.outputs) {
      const id = this.options.newArtifactId()
      const storageKey = join(this.options.artifactRoot, `${id}${extname(output.path)}`)
      await this.options.copy(output.path, storageKey)
      const artifact: Artifact = {
        id,
        projectId: input.projectId,
        analysisRunId: run.id,
        type: output.type,
        mimeType: output.mimeType,
        storageKey,
        datasetHash: run.datasetHash,
        codeHash: run.codeHash,
        metadata: {},
        createdAt: this.options.now(),
      }
      await this.options.storage.artifacts.put(id, artifact)
      artifacts.push(artifact)
    }
    return artifacts
  }

  /**
   * Read one artifact record.
   * @param id - Artifact id.
   * @returns the artifact, or `undefined`.
   */
  @Remote
  async get(id: ArtifactId): Promise<Artifact | undefined> {
    return this.options.storage.artifacts.get(id)
  }

  /**
   * Export one artifact's bytes in the requested format.
   * @param id - Artifact id.
   * @param format - Requested format.
   * @returns the stored bytes.
   * @throws ArtifactError when the artifact is missing or the format does not match.
   */
  async export(id: ArtifactId, format: 'png' | 'svg' | 'csv' | 'json'): Promise<Uint8Array> {
    const artifact = this.options.storage.artifacts.get(id)
    if (artifact === undefined) throw new ArtifactError('ARTIFACT_NOT_FOUND', `no artifact ${id}`)
    if (FORMAT_MIME[format] !== artifact.mimeType) {
      throw new ArtifactError('FORMAT_MISMATCH', `artifact ${id} is ${artifact.mimeType}, not ${format}`)
    }
    const bytes = await this.options.readBytes(artifact.storageKey)
    await this.audit.append({
      action: 'artifact.export',
      projectId: artifact.projectId,
      detail: { artifactId: id, format, size: bytes.byteLength },
    })
    return bytes
  }
}
