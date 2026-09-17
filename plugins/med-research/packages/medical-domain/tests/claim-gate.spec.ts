import { describe, expect, it } from 'vitest'
import * as c from '@medresearch/dsh-medical-contracts'
import { CLAIM_REASONS, verifyClaim } from '../src/claim-gate.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const PAPER = c.paperIdSchema.parse('paper-1')
const OTHER_PAPER = c.paperIdSchema.parse('paper-2')
const DOCUMENT = c.documentIdSchema.parse('document-1')

/** Evidence factory with explicit knobs; every call produces a complete record. */
function evidence(
  id: string,
  locatorStatus: c.LocatorStatus = 'FOUND',
  supportStatus: c.SupportStatus = 'VERIFIED',
  paperId: c.PaperId = PAPER,
): c.Evidence {
  return {
    id: c.evidenceIdSchema.parse(id),
    projectId: PROJECT,
    paperId,
    documentId: DOCUMENT,
    sourceType: 'fulltext',
    originalText: 'the quote',
    normalizedText: 'the quote',
    offsetBase: 'normalized_paragraph',
    relation: 'SUPPORT',
    locatorStatus,
    supportStatus,
    extractorVersion: 'v1',
    extractorModel: 'model-x',
    promptVersion: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Paper factory; only identity is read by the gate. */
function paper(id: string): c.Paper {
  return {
    id: c.paperIdSchema.parse(id),
    title: 'A paper',
    authors: [{ name: 'A. Author' }],
    publicationTypes: [],
    meshTerms: [],
    keywords: [],
    source: 'pubmed',
    fulltextStatus: 'available',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Claim factory. */
function claim(evidenceIds: string[], counterEvidenceIds: string[] = []): c.Claim {
  return {
    id: c.claimIdSchema.parse('claim-1'),
    projectId: PROJECT,
    researchQueryId: c.researchQueryIdSchema.parse('query-1'),
    text: 'A claim',
    evidenceIds: evidenceIds.map(id => c.evidenceIdSchema.parse(id)),
    counterEvidenceIds: counterEvidenceIds.map(id => c.evidenceIdSchema.parse(id)),
    evidenceStatus: 'CONSISTENT',
    supportStatus: 'PENDING',
    rejectionReasons: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function gate(
  target: c.Claim,
  evidenceRecords: c.Evidence[],
  papers: c.Paper[] = [paper('paper-1')],
  relocate: (item: c.Evidence) => boolean = () => true,
) {
  return verifyClaim({
    claim: target,
    evidence: new Map(evidenceRecords.map(item => [item.id, item])),
    papers: new Map(papers.map(item => [item.id, item])),
    relocate,
  })
}

describe('verifyClaim (SPEC §28 Citation Gate)', () => {
  it('passes a claim whose evidence is verified, located, and relocatable', () => {
    const result = gate(claim(['e1']), [evidence('e1')])
    expect(result).toEqual({ claimId: c.claimIdSchema.parse('claim-1'), passed: true, reasons: [] })
  })

  it('rejects a claim that binds an evidence_id that does not exist (FR-12)', () => {
    const result = gate(claim(['ghost']), [evidence('e1')])
    expect(result.passed).toBe(false)
    expect(result.reasons).toContain(`${CLAIM_REASONS.missingEvidence}:ghost`)
    expect(result.reasons).toContain(CLAIM_REASONS.noSupport)
  })

  it('rejects evidence that is not VERIFIED', () => {
    const result = gate(claim(['e1']), [evidence('e1', 'FOUND', 'PENDING')])
    expect(result.reasons).toContain(`${CLAIM_REASONS.notVerified}:e1`)
  })

  it('rejects evidence whose locator is NOT_FOUND', () => {
    const result = gate(claim(['e1']), [evidence('e1', 'NOT_FOUND', 'REJECTED')])
    expect(result.reasons).toContain(`${CLAIM_REASONS.notLocated}:e1`)
  })

  it('rejects evidence whose paper does not exist', () => {
    const result = gate(claim(['e1']), [evidence('e1', 'FOUND', 'VERIFIED', OTHER_PAPER)])
    expect(result.reasons).toContain(`${CLAIM_REASONS.missingPaper}:paper-2`)
  })

  it('rejects evidence whose quote no longer relocates', () => {
    const result = gate(claim(['e1']), [evidence('e1')], [paper('paper-1')], () => false)
    expect(result.reasons).toContain(`${CLAIM_REASONS.notRelocatable}:e1`)
  })

  it('reports no supporting evidence when the claim binds none (FR-13/FR-14)', () => {
    const result = gate(claim([]), [])
    expect(result.passed).toBe(false)
    expect(result.reasons).toEqual([CLAIM_REASONS.noSupport])
  })

  it('accepts verified counter evidence and rejects a dangling counter id', () => {
    const accepted = gate(claim(['e1'], ['e2']), [evidence('e1'), evidence('e2')])
    expect(accepted.passed).toBe(true)

    const dangling = gate(claim(['e1'], ['ghost']), [evidence('e1')])
    expect(dangling.passed).toBe(false)
    expect(dangling.reasons).toContain(`${CLAIM_REASONS.missingEvidence}:ghost`)
  })

  it('passes when one of several supporting evidence records satisfies every check', () => {
    const result = gate(claim(['bad', 'good']), [
      evidence('bad', 'FOUND', 'PENDING'),
      evidence('good'),
    ])
    expect(result.passed).toBe(false)
    expect(result.reasons).toEqual([`${CLAIM_REASONS.notVerified}:bad`])
  })
})
