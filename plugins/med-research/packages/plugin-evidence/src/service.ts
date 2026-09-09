/**
 * Evidence service (SPEC §24–§26). Retrieval ranks stored chunks; saving
 * locates the model's quote deterministically and computes `locatorStatus`;
 * verification applies a semantic verdict under the SPEC §11 hard rule that a
 * `NOT_FOUND` locator can never become `VERIFIED`.
 * @module @medresearch/dsh-plugin-evidence/src/service
 */

import type {
  ClaimId,
  Evidence,
  EvidenceCandidate,
  EvidenceChunk,
  EvidenceId,
  EvidenceRetrieveInput,
  EvidenceSourceType,
  ExtractionProvenance,
  MedEvidenceService,
  ProjectId,
  SupportStatus,
} from '@medresearch/dsh-medical-contracts'
import {
  alignQuote,
  applyLocatorResult,
  assertEvidenceStatusPair,
  bm25Rank,
  normalizeParagraph,
  type AlignmentOptions,
} from '@medresearch/dsh-medical-domain'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/** Construction dependencies of {@link EvidenceService}. */
export interface EvidenceServiceOptions {
  storage: MedStorage
  /** Alignment knobs resolved from plugin configuration. */
  alignment: AlignmentOptions
  /** Cap on retrieval units per call. */
  maxRetrieval: number
  /** Current time as an ISO string. */
  now: () => string
  /** New evidence identity; injectable for deterministic tests. */
  newEvidenceId: () => EvidenceId
}

/** Stable failure codes of the evidence service. */
export type EvidenceErrorCode = 'EVIDENCE_NOT_FOUND' | 'PARAGRAPH_NOT_FOUND'

/** Thrown when an evidence operation names a record that does not exist. */
export class EvidenceError extends Error {
  override readonly name = 'EvidenceError'

  /**
   * @param code - Stable discriminant.
   * @param message - Diagnostic detail naming the missing record.
   */
  constructor(
    readonly code: EvidenceErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** Evidence retrieval, location, and verification capabilities. */
export class EvidenceService implements MedEvidenceService {
  /** Typert Gateway binding: the Web client reaches these methods as `medEvidence/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medEvidence')

  private readonly options: EvidenceServiceOptions
  /** Audit trail for support verdicts (SPEC §49). */
  private readonly audit: AuditWriter

  /**
   * @param options - Storage, alignment knobs, retrieval cap, and identity.
   */
  constructor(options: EvidenceServiceOptions) {
    this.options = options
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
  }

  /**
   * Rank retrieval units for one claim within the project library.
   * @param input - Project, claim text, concept terms, and scope.
   * @returns top-ranked chunks, highest score first.
   */
  @Remote
  async retrieve(input: EvidenceRetrieveInput): Promise<EvidenceChunk[]> {
    const inProject = new Set<string>()
    for (const [, membership] of this.options.storage.projectPapers.entries()) {
      if (membership.projectId === input.projectId) inProject.add(membership.paperId)
    }
    if (input.paperIds !== undefined) {
      const requested = new Set<string>(input.paperIds)
      for (const id of [...inProject]) if (!requested.has(id)) inProject.delete(id)
    }

    const candidates: Array<{ chunk: EvidenceChunk; text: string }> = []
    for (const [, chunk] of this.options.storage.chunks.entries()) {
      const document = this.options.storage.documents.get(chunk.documentId)
      if (document === undefined || !inProject.has(document.paperId)) continue
      candidates.push({ chunk, text: chunk.text })
    }

    const query = [input.claimText, ...input.conceptTerms].join(' ')
    const limit = Math.min(input.maxResults, this.options.maxRetrieval)
    return bm25Rank(query, candidates.map(entry => ({ id: entry.chunk.id, text: entry.text })), limit)
      .map(hit => candidates.find(entry => entry.chunk.id === hit.id)!.chunk)
  }

  /**
   * Locate one model-proposed quote and persist it.
   *
   * `locatorStatus` is computed from the paragraph; a quote that cannot be
   * located is stored as `NOT_FOUND` / `REJECTED` and can never become
   * `VERIFIED`.
   * @param input - Project, candidate, provenance, and optional source class.
   * @returns the stored evidence.
   * @throws EvidenceError when the paragraph does not exist.
   */
  @Remote
  async save(input: {
    projectId: ProjectId
    candidate: EvidenceCandidate
    provenance: ExtractionProvenance
    sourceType?: EvidenceSourceType
  }): Promise<Evidence> {
    const paragraph = this.options.storage.paragraphs.get(input.candidate.paragraphId)
    if (paragraph === undefined) {
      throw new EvidenceError('PARAGRAPH_NOT_FOUND', `no paragraph ${input.candidate.paragraphId}`)
    }
    const section = this.options.storage.sections.get(paragraph.sectionId)
    const document = section === undefined ? undefined : this.options.storage.documents.get(section.documentId)
    if (section === undefined || document === undefined) {
      throw new EvidenceError('PARAGRAPH_NOT_FOUND', `paragraph ${paragraph.id} has no owning document`)
    }

    const located = alignQuote(paragraph.text, input.candidate.quote, this.options.alignment)
    const supportStatus = applyLocatorResult(located.status, 'PENDING')
    assertEvidenceStatusPair(located.status, supportStatus)
    const sourceType = input.sourceType ?? (document.sourceType === 'abstract' ? 'abstract' : 'fulltext')

    const evidence: Evidence = {
      id: this.options.newEvidenceId(),
      projectId: input.projectId,
      paperId: document.paperId,
      documentId: document.id,
      sourceType,
      section: section.title,
      paragraphId: paragraph.id,
      ...paragraph.page === undefined ? {} : { page: paragraph.page },
      originalText: input.candidate.quote,
      normalizedText: normalizeParagraph(input.candidate.quote),
      offsetBase: 'normalized_paragraph',
      ...located.startOffset === undefined ? {} : { startOffset: located.startOffset },
      ...located.endOffset === undefined ? {} : { endOffset: located.endOffset },
      relation: input.candidate.relation,
      locatorStatus: located.status,
      supportStatus,
      extractorVersion: input.provenance.extractorVersion,
      extractorModel: input.provenance.extractorModel,
      promptVersion: input.provenance.promptVersion,
      createdAt: this.options.now(),
    }
    await this.options.storage.evidences.put(evidence.id, evidence)
    return evidence
  }

  /**
   * Apply a semantic verdict to one evidence.
   * @param id - Evidence id.
   * @param verdict - Requested support status.
   * @returns the updated evidence; `NOT_FOUND` always resolves to `REJECTED`.
   * @throws EvidenceError when the evidence does not exist.
   */
  @Remote
  async verify(id: EvidenceId, verdict: SupportStatus): Promise<Evidence> {
    const evidence = this.options.storage.evidences.get(id)
    if (evidence === undefined) throw new EvidenceError('EVIDENCE_NOT_FOUND', `no evidence ${id}`)
    const supportStatus = applyLocatorResult(evidence.locatorStatus, verdict)
    assertEvidenceStatusPair(evidence.locatorStatus, supportStatus)
    const updated: Evidence = { ...evidence, supportStatus }
    await this.options.storage.evidences.put(updated.id, updated)
    await this.audit.append({
      action: 'evidence.verify',
      projectId: updated.projectId,
      detail: {
        evidenceId: updated.id,
        supportStatus: updated.supportStatus,
        locatorStatus: updated.locatorStatus,
      },
    })
    return updated
  }

  /**
   * List every evidence bound to one claim.
   * @param id - Claim id.
   * @returns bound evidence in binding order.
   * @throws EvidenceError when a binding names a missing evidence.
   */
  @Remote
  async listForClaim(id: ClaimId): Promise<Evidence[]> {
    const evidence: Evidence[] = []
    for (const [, binding] of this.options.storage.claimEvidences.entries()) {
      if (binding.claimId !== id) continue
      const record = this.options.storage.evidences.get(binding.evidenceId)
      if (record === undefined) {
        throw new EvidenceError('EVIDENCE_NOT_FOUND', `claim ${id} binds missing evidence ${binding.evidenceId}`)
      }
      evidence.push(record)
    }
    return evidence
  }
}
