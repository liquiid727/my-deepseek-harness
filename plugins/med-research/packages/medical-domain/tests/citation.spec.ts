import { describe, expect, it } from 'vitest'
import * as c from '@medresearch/dsh-medical-contracts'
import { CitationError, serializeCitations } from '../src/citation.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const PAPER_A = c.paperIdSchema.parse('paper-a')
const PAPER_B = c.paperIdSchema.parse('paper-b')

function evidence(id: string, paperId: c.PaperId): c.Evidence {
  return {
    id: c.evidenceIdSchema.parse(id), projectId: PROJECT, paperId,
    documentId: c.documentIdSchema.parse('doc-1'), sourceType: 'fulltext',
    originalText: 'q', normalizedText: 'q', offsetBase: 'normalized_paragraph',
    relation: 'SUPPORT', locatorStatus: 'FOUND', supportStatus: 'VERIFIED',
    extractorVersion: 'v1', extractorModel: 'm', promptVersion: 'p',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const lookup = new Map([
  [c.evidenceIdSchema.parse('e1'), evidence('e1', PAPER_A)],
  [c.evidenceIdSchema.parse('e2'), evidence('e2', PAPER_B)],
  [c.evidenceIdSchema.parse('e3'), evidence('e3', PAPER_A)],
])

describe('serializeCitations (SPEC §29, FR-15)', () => {
  it('numbers citations in first-appearance order and maps to paper ids', () => {
    const answer = serializeCitations([
      { text: 'Claim one', evidenceIds: [c.evidenceIdSchema.parse('e2'), c.evidenceIdSchema.parse('e1')] },
      { text: 'Claim two', evidenceIds: [c.evidenceIdSchema.parse('e1'), c.evidenceIdSchema.parse('e3')], counterEvidenceIds: [c.evidenceIdSchema.parse('e2')] },
    ], lookup)

    expect(answer.claims[0]).toEqual({ text: 'Claim one', citations: [1, 2], counterCitations: [] })
    expect(answer.claims[1]).toEqual({ text: 'Claim two', citations: [2, 3], counterCitations: [1] })
    expect(answer.citations).toEqual([
      { index: 1, evidenceId: 'e2', paperId: PAPER_B },
      { index: 2, evidenceId: 'e1', paperId: PAPER_A },
      { index: 3, evidenceId: 'e3', paperId: PAPER_A },
    ])
  })

  it('rejects a claim citing unknown evidence (FR-12)', () => {
    expect(() => serializeCitations(
      [{ text: 'x', evidenceIds: [c.evidenceIdSchema.parse('ghost')] }], lookup,
    )).toThrow(CitationError)
  })

  it('never invents a citation for a claim without evidence', () => {
    const answer = serializeCitations([{ text: 'No evidence', evidenceIds: [] }], lookup)
    expect(answer.claims[0]!.citations).toEqual([])
    expect(answer.citations).toEqual([])
  })
})
