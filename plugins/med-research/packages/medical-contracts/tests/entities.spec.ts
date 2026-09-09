import { describe, expect, it } from 'vitest'
import * as c from '../src/index.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const PAPER = c.paperIdSchema.parse('paper-1')
const DOCUMENT = c.documentIdSchema.parse('document-1')

function evidenceRecord(): Record<string, unknown> {
  return {
    id: 'evidence-1',
    projectId: PROJECT,
    paperId: PAPER,
    documentId: DOCUMENT,
    sourceType: 'fulltext',
    originalText: 'the quote',
    normalizedText: 'the quote',
    offsetBase: 'normalized_paragraph',
    startOffset: 0,
    endOffset: 9,
    relation: 'SUPPORT',
    locatorStatus: 'FOUND',
    supportStatus: 'VERIFIED',
    extractorVersion: 'v1',
    extractorModel: 'model-x',
    promptVersion: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('evidence schema (FR-7, FR-10)', () => {
  it('accepts a complete record and preserves the offset base', () => {
    const parsed = c.evidenceSchema.parse(evidenceRecord())
    expect(parsed.offsetBase).toBe('normalized_paragraph')
    expect(parsed.startOffset).toBe(0)
    expect(parsed.endOffset).toBe(9)
  })

  it.each(['extractorVersion', 'extractorModel', 'promptVersion'])(
    'rejects a record missing %s provenance (FR-10)',
    (field) => {
      const record = evidenceRecord()
      delete record[field]
      expect(c.evidenceSchema.safeParse(record).success).toBe(false)
    },
  )

  it('rejects a missing original or normalized text (FR-7)', () => {
    for (const field of ['originalText', 'normalizedText']) {
      const record = evidenceRecord()
      delete record[field]
      expect(c.evidenceSchema.safeParse(record).success).toBe(false)
    }
  })

  it('rejects an unknown offset base', () => {
    expect(c.evidenceSchema.safeParse({ ...evidenceRecord(), offsetBase: 'document' }).success).toBe(false)
  })

  it('rejects an undeclared field instead of stripping it', () => {
    const result = c.evidenceSchema.safeParse({ ...evidenceRecord(), modelGuess: 'trust me' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown relation and an unknown locator status', () => {
    expect(c.evidenceSchema.safeParse({ ...evidenceRecord(), relation: 'NEUTRAL' }).success).toBe(false)
    expect(c.evidenceSchema.safeParse({ ...evidenceRecord(), locatorStatus: 'MAYBE' }).success).toBe(false)
  })
})

describe('shared vocabularies', () => {
  it('rejects an unknown domain error code', () => {
    expect(c.domainErrorSchema.safeParse({
      code: 'NOT_A_CODE', message: 'x', retryable: false, partialDataAvailable: false,
    }).success).toBe(false)
  })

  it('rejects an unknown dataset column type', () => {
    expect(c.datasetColumnSchema.safeParse({
      name: 'x', inferredType: 'ratio', nullable: false, missingCount: 0, uniqueCount: 1,
    }).success).toBe(false)
  })

  it('requires a positive runner limit and a non-empty allowlist entry', () => {
    const base = { datasetPath: '/d.csv', code: 'print(1)', limits: { timeoutMs: 1, cpuSeconds: 1, memoryMb: 1, maxOutputBytes: 1 }, allowlist: ['pandas'] }
    expect(c.statisticsRunInputSchema.safeParse(base).success).toBe(true)
    expect(c.statisticsRunInputSchema.safeParse({ ...base, limits: { ...base.limits, timeoutMs: 0 } }).success).toBe(false)
    expect(c.statisticsRunInputSchema.safeParse({ ...base, allowlist: [''] }).success).toBe(false)
  })

  it('brands identifiers so a plain string is not assignable', () => {
    const id: c.ProjectId = c.projectIdSchema.parse('p')
    expect(typeof id).toBe('string')
    // @ts-expect-error a raw string must not stand in for a branded ProjectId
    const raw: c.ProjectId = 'p'
    expect(raw).toBe(id)
  })
})
