/**
 * Dataset service (SPEC §33). Validates size and row limits from configuration,
 * parses CSV, profiles columns, and persists schema plus profile. Row-level
 * values are never returned to a caller (SPEC §47).
 * @module @medresearch/dsh-plugin-dataset/src/service
 */

import { createHash } from 'node:crypto'
import type {
  Dataset,
  DatasetColumn,
  DatasetId,
  MedDatasetsService,
  ProjectId,
} from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { parseCsv, profileColumns } from './csv.ts'
import { parseXlsx } from './xlsx.ts'

/** Construction dependencies of {@link DatasetsService}. */
export interface DatasetServiceOptions {
  storage: MedStorage
  /** Maximum accepted file size in bytes. */
  maxBytes: number
  /** Maximum accepted data rows. */
  maxRows: number
  /** Read a text file reference; injected so tests stay independent of the fs stack. */
  readFile: (fileRef: string) => Promise<string>
  /** Read a binary file reference; required for `.xlsx` uploads. */
  readBytes?: (fileRef: string) => Promise<Uint8Array>
  /** Current time as an ISO string. */
  now: () => string
  /** New dataset identity. */
  newDatasetId: () => DatasetId
}

/** Stable dataset failure codes. */
export type DatasetErrorCode = 'DATASET_TOO_LARGE' | 'DATASET_PARSE_FAILED' | 'DATASET_NOT_FOUND'

/** Thrown when a dataset cannot be accepted or found. */
export class DatasetError extends Error {
  override readonly name = 'DatasetError'

  /**
   * @param code - Stable discriminant.
   * @param message - Diagnostic detail.
   */
  constructor(
    readonly code: DatasetErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** Dataset upload and profiling capabilities. */
export class DatasetsService implements MedDatasetsService {
  /** Typert Gateway binding: the Web client reaches these methods as `medDatasets/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medDatasets')

  /** Audit trail for dataset uploads (SPEC §49). */
  private readonly audit: AuditWriter
  /** Bounded rows retained only for the authenticated preview surface. */
  private readonly previews = new Map<DatasetId, { headers: string[]; rows: string[][] }>()

  /**
   * @param options - Storage, limits, file reader, and identity.
   */
  constructor(private readonly options: DatasetServiceOptions) {
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
  }

  /**
   * Validate, hash, parse, profile, and persist one uploaded file.
   * @param input - Project and file reference.
   * @returns the stored dataset.
   * @throws DatasetError when the file exceeds a configured limit or is not CSV.
   */
  @Remote
  async upload(input: { projectId: ProjectId; fileRef: string }): Promise<Dataset> {
    const isXlsx = /\.xlsx$/iu.test(input.fileRef)
    let text = ''
    let rawBytes: Uint8Array | undefined
    let headers: string[]
    let rows: string[][]
    try {
      if (isXlsx) {
        if (this.options.readBytes === undefined) {
          throw new Error('XLSX uploads need a binary reader')
        }
        const bytes = await this.options.readBytes(input.fileRef)
        rawBytes = bytes
        if (bytes.byteLength > this.options.maxBytes) {
          throw new DatasetError('DATASET_TOO_LARGE', `file is ${bytes.byteLength} bytes, limit is ${this.options.maxBytes}`)
        }
        ;({ headers, rows } = parseXlsx(bytes))
      } else {
        text = await this.options.readFile(input.fileRef)
        const bytes = Buffer.byteLength(text, 'utf8')
        if (bytes > this.options.maxBytes) {
          throw new DatasetError('DATASET_TOO_LARGE', `file is ${bytes} bytes, limit is ${this.options.maxBytes}`)
        }
        ;({ headers, rows } = parseCsv(text))
      }
    } catch (cause) {
      if (cause instanceof DatasetError) throw cause
      throw new DatasetError('DATASET_PARSE_FAILED', (cause as Error).message)
    }
    if (rows.length > this.options.maxRows) {
      throw new DatasetError('DATASET_TOO_LARGE', `${rows.length} rows exceed the ${this.options.maxRows} row limit`)
    }
    const schema = profileColumns(headers, rows)
    const dataset: Dataset = {
      id: this.options.newDatasetId(),
      projectId: input.projectId,
      filename: input.fileRef.split(/[\\/]/u).pop() ?? input.fileRef,
      contentHash: createHash('sha256').update(rawBytes ?? text).digest('hex'),
      rowCount: rows.length,
      columnCount: headers.length,
      schema,
      createdAt: this.options.now(),
    }
    await this.options.storage.datasets.put(dataset.id, dataset)
    this.previews.set(dataset.id, { headers: [...headers], rows: rows.slice(0, 5).map(row => [...row]) })
    for (const column of schema) {
      await this.options.storage.datasetColumns.put(`${dataset.id}|${column.name}`, column)
    }
    await this.audit.append({
      action: 'dataset.upload',
      projectId: dataset.projectId,
      detail: {
        datasetId: dataset.id,
        filename: dataset.filename,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
      },
    })
    return dataset
  }

  /**
   * Read one stored dataset profile.
   * @param id - Dataset id.
   * @returns the dataset, or `undefined`.
   */
  @Remote
  async profile(id: DatasetId): Promise<Dataset | undefined> {
    return this.options.storage.datasets.get(id)
  }

  /**
   * Read one dataset's column schema.
   * @param id - Dataset id.
   * @returns columns in file order.
   */
  @Remote
  async schema(id: DatasetId): Promise<DatasetColumn[]> {
    const dataset = this.options.storage.datasets.get(id)
    if (dataset === undefined) throw new DatasetError('DATASET_NOT_FOUND', `no dataset ${id}`)
    return dataset.schema
  }

  /** Return at most the first five rows to the authenticated UI, never model calls. */
  @Remote
  async preview(id: DatasetId, rows = 5): Promise<{ headers: string[]; rows: string[][] }> {
    if (this.options.storage.datasets.get(id) === undefined) throw new DatasetError('DATASET_NOT_FOUND', `no dataset ${id}`)
    const preview = this.previews.get(id)
    if (preview === undefined) return { headers: [], rows: [] }
    return { headers: [...preview.headers], rows: preview.rows.slice(0, Math.min(Math.max(rows, 0), 5)).map(row => [...row]) }
  }

  /** List profiles in one project without exposing row-level data. */
  @Remote
  async list(projectId: ProjectId): Promise<Dataset[]> {
    return [...this.options.storage.datasets.entries()].map(([, dataset]) => dataset).filter(dataset => dataset.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }
}
