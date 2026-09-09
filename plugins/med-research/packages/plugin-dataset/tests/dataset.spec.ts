import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import { datasetIdSchema, projectIdSchema } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { parseCsv, profileColumns } from '../src/csv.ts'
import { DatasetError, DatasetsService } from '../src/service.ts'

const FIXTURE = new URL('./fixtures/ponv.csv', import.meta.url).pathname
const PROJECT = projectIdSchema.parse('project-1')

async function service(readBytes?: (path: string) => Promise<Uint8Array>): Promise<DatasetsService> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  return new DatasetsService({
    storage,
    maxBytes: 1024 * 1024,
    maxRows: 1_000,
    readFile: path => readFile(path, 'utf8'),
    ...readBytes === undefined ? {} : { readBytes },
    now: () => '2026-01-01T00:00:00.000Z',
    newDatasetId: () => datasetIdSchema.parse('dataset-1'),
  })
}

describe('CSV parsing and profiling (SPEC §13, §33)', () => {
  it('parses quoted fields and infers column roles', async () => {
    const { headers, rows } = parseCsv('a,b\n"x,1",2\n"he said ""hi""",3\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toEqual([['x,1', '2'], ['he said "hi"', '3']])
  })

  it('profiles the fixture without exposing row values', async () => {
    const app = await service()
    const dataset = await app.upload({ projectId: PROJECT, fileRef: FIXTURE })
    expect(dataset.rowCount).toBe(8)
    expect(dataset.columnCount).toBe(4)

    const byName = new Map(dataset.schema.map(column => [column.name, column]))
    expect(byName.get('ponv')).toMatchObject({ inferredType: 'binary', nullable: false, uniqueCount: 2 })
    expect(byName.get('pain')).toMatchObject({ inferredType: 'continuous', nullable: true, missingCount: 1 })
    expect(byName.get('pain')!.mean).toBeCloseTo(4.957, 2)
    expect(byName.get('age')).toMatchObject({ inferredType: 'continuous', nullable: false })
    expect(byName.get('site')).toMatchObject({ inferredType: 'categorical', uniqueCount: 2 })

    expect(await app.schema(dataset.id)).toEqual(dataset.schema)
    expect(JSON.stringify(dataset)).not.toContain('7.2')
  })

  it('rejects a file over the configured size limit', async () => {
    const app = new DatasetsService({
      storage: (await service()) as never,
      maxBytes: 4,
      maxRows: 10,
      readFile: async () => 'a,b\n1,2\n',
      now: () => '2026-01-01T00:00:00.000Z',
      newDatasetId: () => datasetIdSchema.parse('dataset-2'),
    })
    await expect(app.upload({ projectId: PROJECT, fileRef: 'x.csv' })).rejects.toMatchObject({ code: 'DATASET_TOO_LARGE' })
  })

  it('fails loud when the dataset does not exist', async () => {
    const app = await service()
    await expect(app.schema(datasetIdSchema.parse('nope'))).rejects.toBeInstanceOf(DatasetError)
  })

  it('profiles an XLSX upload through the binary reader', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'med-xlsx-'))
    const path = join(dir, 'ponv.xlsx')
    await writeFile(path, zipSync({
      'xl/sharedStrings.xml': strToU8('<sst><si><t>ponv</t></si><si><t>pain</t></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData>'
        + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
        + '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>7.2</v></c></row>'
        + '<row r="3"><c r="A3"><v>0</v></c><c r="B3"><v>2.1</v></c></row>'
        + '</sheetData></worksheet>'),
    }))
    const app = await service(() => readFile(path))
    const dataset = await app.upload({ projectId: PROJECT, fileRef: path })
    expect(dataset.filename).toBe('ponv.xlsx')
    expect(dataset.rowCount).toBe(2)
    expect(dataset.columnCount).toBe(2)
    expect(dataset.schema.map(column => column.name)).toEqual(['ponv', 'pain'])
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects a file with no header row', () => {
    expect(() => parseCsv('')).toThrow(/no header/)
    expect(profileColumns(['x'], [])).toEqual([
      { name: 'x', inferredType: 'unknown', nullable: false, missingCount: 0, uniqueCount: 0 },
    ])
  })
})
