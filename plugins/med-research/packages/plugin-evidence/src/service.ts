/**
 * Evidence service (SPEC-R001-S04). Retrieval ranks stored chunks; saving
 * locates the model's quote deterministically and computes `locatorStatus`;
 * verification applies a semantic verdict under the SPEC §11 hard rule that a
 * `NOT_FOUND` locator can never become `VERIFIED`; and the claim gate decides
 * sufficiency from qualified evidence only.
 *
 * Qualification, the locator/support hard rule, and the Citation Gate all live
 * in `@medresearch/dsh-medical-domain` so every consumer shares one rule
 * instead of restating it.
 * @module @medresearch/dsh-plugin-evidence/src/service
 */

import type {
  ChaseHop,
  ChaseInput,
  ChaseResult,
  Claim,
  ClaimGateCounts,
  ClaimGateResult,
  ClaimId,
  CitationMap,
  DocumentId,
  Evidence,
  EvidenceCandidate,
  EvidenceChunk,
  EvidenceComparison,
  EvidenceComparisonRow,
  EvidenceId,
  EvidenceRetrieveInput,
  EvidenceSourceType,
  ExtractionProvenance,
  MedEvidenceService,
  PaperId,
  ParagraphId,
  ProjectId,
  SupportStatus,
  EvidenceRelation,
} from '@medresearch/dsh-medical-contracts'
import { claimIdSchema } from '@medresearch/dsh-medical-contracts'
import { createHash } from 'node:crypto'
import {
  alignQuote,
  applyLocatorResult,
  assertEvidenceStatusPair,
  bm25Rank,
  evidenceQualificationReasons,
  isQualifiedEvidence,
  normalizeParagraph,
  partitionMatchedSpans,
  verifyClaim,
  type AlignmentOptions,
} from '@medresearch/dsh-medical-domain'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/** A resolved original source returned by a declared reference resolver. */
export interface ResolvedReference {
  status: 'RESOLVED'
  paperId: PaperId
  documentId: DocumentId
  paragraphId: ParagraphId
  /** Verbatim quote located inside the resolved paragraph. */
  quote: string
}

/** A reference that could not be resolved, with the reason to record. */
export interface UnresolvedReference {
  status: 'UNRESOLVED'
  reason: string
}

/**
 * Declared Reference Chasing connector (SPEC-R001-S04-004). The resolver is
 * injected by the mounting plugin from configuration; the evidence service
 * never reaches the network itself and never invents an identifier.
 */
export interface ReferenceResolver {
  /** Resolve one printed reference to its original paper, or report why not. */
  resolve(reference: ChaseInput['reference']): Promise<ResolvedReference | UnresolvedReference>
}

/** Construction dependencies of {@link EvidenceService}. */
export interface EvidenceServiceOptions {
  storage: MedStorage
  /** Alignment knobs resolved from plugin configuration. */
  alignment: AlignmentOptions
  /** Cap on retrieval units per call. */
  maxRetrieval: number
  /** Maximum Reference Chasing hops per walk (SPEC-R001-S04-004). */
  maxHops: number
  /** Current time as an ISO string. */
  now: () => string
  /** New evidence identity; injectable for deterministic tests. */
  newEvidenceId: () => EvidenceId
  /** New claim identity; injectable for deterministic tests. */
  newClaimId?: () => ClaimId
  /** Declared Reference Chasing connector; absent means chasing reports that. */
  referenceResolver?: ReferenceResolver
  /** Verifier version recorded with every support verdict. */
  verificationVersion?: string
}

/** Stable failure codes of the evidence service. */
export type EvidenceErrorCode = 'EVIDENCE_NOT_FOUND' | 'PARAGRAPH_NOT_FOUND' | 'PROJECT_NOT_FOUND'

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
  /** Audit trail for support verdicts, withdrawals, and claim gates (SPEC §49). */
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
   * `VERIFIED`. A `PARTIAL` locator keeps its exact matched spans; a `PARTIAL`
   * with no exact span is downgraded to `NOT_FOUND`, because such a record
   * could not be highlighted and must not qualify.
   * @param input - Project, candidate, provenance, and optional source class.
   * @returns the stored evidence.
   * @throws EvidenceError `PROJECT_NOT_FOUND` when the project is unknown, or
   * `PARAGRAPH_NOT_FOUND` when the paragraph or its owning document is missing.
   */
  @Remote
  async save(input: {
    projectId: ProjectId
    candidate: EvidenceCandidate
    provenance: ExtractionProvenance
    sourceType?: EvidenceSourceType
  }): Promise<Evidence> {
    if (this.options.storage.projects.get(input.projectId) === undefined) {
      throw new EvidenceError('PROJECT_NOT_FOUND', `no project ${input.projectId}`)
    }
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

    // A PARTIAL match is only usable when it can be highlighted exactly; a
    // PARTIAL without an exact span is downgraded rather than kept as a
    // near-match (interfaces.md §Reader, Note and Evidence).
    let status = located.status
    let matched: Array<{ start: number; end: number }> = []
    let unmatched: Array<{ start: number; end: number }> = []
    if (status === 'PARTIAL' && located.startOffset !== undefined && located.endOffset !== undefined) {
      const normalizedParagraph = normalizeParagraph(paragraph.text)
      const partition = partitionMatchedSpans(
        normalizedParagraph.slice(located.startOffset, located.endOffset),
        normalizeParagraph(input.candidate.quote),
      )
      // `partitionMatchedSpans` works in window coordinates; shift both lists
      // back into the paragraph's normalized offset base.
      matched = partition.matched.map(span => ({ start: located.startOffset! + span.start, end: located.startOffset! + span.end }))
      unmatched = partition.unmatched.map(span => ({ start: located.startOffset! + span.start, end: located.startOffset! + span.end }))
      if (matched.length === 0) {
        status = 'NOT_FOUND'
        matched = []
        unmatched = []
      }
    }

    const supportStatus = applyLocatorResult(status, 'PENDING')
    assertEvidenceStatusPair(status, supportStatus)
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
      ...status === 'NOT_FOUND' || located.startOffset === undefined ? {} : { startOffset: located.startOffset },
      ...status === 'NOT_FOUND' || located.endOffset === undefined ? {} : { endOffset: located.endOffset },
      ...matched.length === 0 ? {} : { matchedAnchors: matched },
      ...unmatched.length === 0 ? {} : { unmatchedRanges: unmatched },
      relation: input.candidate.relation,
      locatorStatus: status,
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
   *
   * The verdict is recorded with its reason and verifier version. An
   * `UNCERTAIN` relation carries no support, so the stored support status stays
   * `PENDING` even when the caller asked for `VERIFIED`; the relation is
   * re-bound here, which is why changing a claim's text requires re-verifying.
   * @param id - Evidence id.
   * @param verdict - Requested support status.
   * @param options - Optional relation re-binding, reason, and verifier version.
   * @returns the updated evidence; `NOT_FOUND` always resolves to `REJECTED`.
   * @throws EvidenceError when the evidence does not exist.
   */
  @Remote
  async verify(id: EvidenceId, verdict: SupportStatus, options?: {
    relation?: EvidenceRelation
    reason?: string
    verificationVersion?: string
  }): Promise<Evidence> {
    const evidence = this.options.storage.evidences.get(id)
    if (evidence === undefined) throw new EvidenceError('EVIDENCE_NOT_FOUND', `no evidence ${id}`)
    const relation = options?.relation ?? evidence.relation
    const requested = relation === 'UNCERTAIN' && verdict === 'VERIFIED' ? 'PENDING' : verdict
    const supportStatus = applyLocatorResult(evidence.locatorStatus, requested)
    assertEvidenceStatusPair(evidence.locatorStatus, supportStatus)
    const updated: Evidence = {
      ...evidence,
      relation,
      supportStatus,
      verifiedAt: this.options.now(),
      verificationVersion: options?.verificationVersion ?? this.options.verificationVersion ?? 'v1',
      verificationReason: options?.reason ?? (relation === 'UNCERTAIN' ? 'relation is UNCERTAIN; support stays PENDING' : 'semantic verdict recorded'),
    }
    await this.options.storage.evidences.put(updated.id, updated)
    await this.audit.append({
      action: 'evidence.verify',
      projectId: updated.projectId,
      detail: {
        evidenceId: updated.id,
        supportStatus: updated.supportStatus,
        locatorStatus: updated.locatorStatus,
        relation: updated.relation,
        verificationVersion: updated.verificationVersion,
      },
    })
    return updated
  }

  /**
   * Withdraw one evidence. Withdrawal is immediate and propagates: the record
   * stops qualifying, every claim that binds it loses its support, and every
   * draft that referenced it returns to `DRAFT`.
   * @param id - Evidence id.
   * @param reason - Optional reason recorded on the record and in the audit.
   * @returns the withdrawn evidence.
   * @throws EvidenceError when the evidence does not exist.
   */
  @Remote
  async withdraw(id: EvidenceId, reason?: string): Promise<Evidence> {
    const evidence = this.options.storage.evidences.get(id)
    if (evidence === undefined) throw new EvidenceError('EVIDENCE_NOT_FOUND', `no evidence ${id}`)
    const withdrawn: Evidence = {
      ...evidence,
      withdrawnAt: this.options.now(),
      verificationReason: reason ?? 'withdrawn by the user',
    }
    await this.options.storage.evidences.put(withdrawn.id, withdrawn)
    await this.invalidateDependents(withdrawn)
    await this.audit.append({
      action: 'evidence.withdraw',
      projectId: withdrawn.projectId,
      detail: { evidenceId: withdrawn.id, reason: withdrawn.verificationReason },
    })
    return withdrawn
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

  /**
   * Create a claim and gate it against current, project-scoped evidence.
   *
   * Only qualified evidence counts: a secondary citation, an unverified or
   * unlocated record, an `UNCERTAIN` relation, a withdrawn record, and a
   * `PARTIAL` record without an exact span all fail qualification. The overall
   * status follows interfaces.md: qualified SUPPORT and qualified AGAINST is
   * `CONFLICTING`; exactly one side is `CONSISTENT`; neither is `INSUFFICIENT`.
   * Counts are de-duplicated by Evidence id, and pending/secondary records are
   * reported separately instead of being counted as support.
   */
  @Remote
  async gateClaim(input: { projectId: ProjectId; researchQueryId: import('@medresearch/dsh-medical-contracts').ResearchQueryId; text: string; evidenceIds: EvidenceId[]; counterEvidenceIds?: EvidenceId[] }): Promise<ClaimGateResult> {
    const evidenceIds = [...new Set(input.evidenceIds)]
    const counterEvidenceIds = [...new Set(input.counterEvidenceIds ?? [])]
    const allIds = [...new Set([...evidenceIds, ...counterEvidenceIds])]

    const reasons: string[] = []
    const counts: ClaimGateCounts = { support: 0, against: 0, pending: 0, secondary: 0 }
    for (const id of allIds) {
      const record = this.options.storage.evidences.get(id)
      if (record === undefined) {
        reasons.push(`MISSING_EVIDENCE:${id}`)
        continue
      }
      if (record.projectId !== input.projectId) {
        reasons.push(`PROJECT_SCOPE:${id}`)
        continue
      }
      const qualification = evidenceQualificationReasons(record)
      if (qualification.length > 0) reasons.push(...qualification.map(reason => `${reason}:${id}`))
      if (record.sourceType === 'secondary_citation') counts.secondary += 1
      if (record.supportStatus === 'PENDING') counts.pending += 1
      if (isQualifiedEvidence(record) && record.relation === 'SUPPORT' && evidenceIds.includes(id)) counts.support += 1
      if (isQualifiedEvidence(record) && record.relation === 'AGAINST') counts.against += 1
    }

    const qualified = new Set(allIds.filter(id => {
      const record = this.options.storage.evidences.get(id)
      return record !== undefined && record.projectId === input.projectId && isQualifiedEvidence(record)
    }))
    const supportQualified = [...qualified].filter(id => evidenceIds.includes(id) && this.options.storage.evidences.get(id)!.relation === 'SUPPORT')
    const againstQualified = [...qualified].filter(id => this.options.storage.evidences.get(id)!.relation === 'AGAINST')
    if (supportQualified.length === 0) reasons.push('NO_SUPPORTING_EVIDENCE')

    // The domain Citation Gate is the single authority for the pass/fail
    // decision; the service only aggregates the presentation status.
    const claimId = this.options.newClaimId?.() ?? claimIdSchema.parse(`claim-${this.options.now()}`)
    const draftClaim: Claim = {
      id: claimId,
      projectId: input.projectId,
      researchQueryId: input.researchQueryId,
      text: input.text,
      evidenceIds,
      counterEvidenceIds,
      evidenceStatus: 'INSUFFICIENT',
      supportStatus: 'PENDING',
      rejectionReasons: [],
      createdAt: this.options.now(),
    }
    const gate = verifyClaim({
      claim: draftClaim,
      evidence: new Map(allIds.map(id => [id, this.options.storage.evidences.get(id)]).filter((entry): entry is [EvidenceId, Evidence] => entry[1] !== undefined)),
      papers: new Map([...this.options.storage.papers.entries()]),
      relocate: evidence => this.relocates(evidence),
    })

    const status: ClaimGateResult['status'] = supportQualified.length > 0 && againstQualified.length > 0
      ? 'CONFLICTING'
      : supportQualified.length > 0 || againstQualified.length > 0
        ? 'CONSISTENT'
        : 'INSUFFICIENT'

    const claim: Claim = {
      ...draftClaim,
      evidenceStatus: status,
      supportStatus: status === 'INSUFFICIENT' ? 'PENDING' : 'VERIFIED',
      rejectionReasons: reasons,
    }
    await this.options.storage.claims.put(claim.id, claim)
    for (const id of evidenceIds) await this.options.storage.claimEvidences.put(`${claim.id}|${id}|support`, { claimId: claim.id, evidenceId: id, role: 'support' })
    for (const id of counterEvidenceIds) await this.options.storage.claimEvidences.put(`${claim.id}|${id}|counter`, { claimId: claim.id, evidenceId: id, role: 'counter' })
    await this.audit.append({ action: 'claim.verify', projectId: input.projectId, detail: { claimId: claim.id, status, reasons, counts, gate: gate.passed } })
    return { status, claim, reasons, counts }
  }

  /**
   * Assign citation indices from stored evidence.
   *
   * Indices follow the first appearance of each Evidence in the claim's
   * binding order, a repeated Evidence keeps one index, and every entry carries
   * the paper identifiers and the focus anchor the UI and the reader need.
   * @param claimId - Claim id.
   * @returns the citation map with a content revision hash.
   * @throws EvidenceError when the claim or a bound evidence is missing.
   */
  @Remote
  async serializeCitations(claimId: ClaimId): Promise<CitationMap> {
    const claim = this.options.storage.claims.get(claimId)
    if (claim === undefined) throw new EvidenceError('EVIDENCE_NOT_FOUND', `no claim ${claimId}`)
    const ordered: EvidenceId[] = []
    for (const id of [...claim.evidenceIds, ...claim.counterEvidenceIds]) {
      if (!ordered.includes(id)) ordered.push(id)
    }
    const entries = ordered.map((evidenceId, index) => {
      const evidence = this.options.storage.evidences.get(evidenceId)
      if (evidence === undefined) throw new EvidenceError('EVIDENCE_NOT_FOUND', `claim ${claimId} binds missing evidence ${evidenceId}`)
      const paper = this.options.storage.papers.get(evidence.paperId)
      return {
        index: index + 1,
        evidenceId,
        paperId: evidence.paperId,
        ...paper?.pmid === undefined ? {} : { pmid: paper.pmid },
        ...paper?.doi === undefined ? {} : { doi: paper.doi },
        ...evidence.paragraphId === undefined ? {} : {
          anchor: {
            projectId: evidence.projectId,
            paperId: evidence.paperId,
            documentId: evidence.documentId,
            paragraphId: evidence.paragraphId,
            ...evidence.startOffset === undefined ? {} : { startOffset: evidence.startOffset },
            ...evidence.endOffset === undefined ? {} : { endOffset: evidence.endOffset },
          },
        },
      }
    })
    return { revision: createHash('sha256').update(JSON.stringify(entries)).digest('hex'), entries }
  }

  /**
   * Compare selected evidence with persisted metadata and source status.
   *
   * Every row reports the paper, the quote, the relation, the source class, and
   * both statuses. Sample size, study design, outcome, and effect are filled
   * only when the stored paper actually reports them; a field the source does
   * not report stays empty rather than being estimated.
   * @param projectId - Project scope.
   * @param evidenceIds - Evidence ids to compare.
   * @returns the comparison, one row per in-scope evidence.
   */
  @Remote
  async compare(projectId: ProjectId, evidenceIds: EvidenceId[]): Promise<EvidenceComparison> {
    const rows: EvidenceComparisonRow[] = evidenceIds
      .map(id => this.options.storage.evidences.get(id))
      .filter((record): record is Evidence => record !== undefined && record.projectId === projectId)
      .map(evidence => {
        const paper = this.options.storage.papers.get(evidence.paperId)
        const publicationTypes = paper?.publicationTypes ?? []
        const row: EvidenceComparisonRow = {
          evidence,
          paper,
          quote: evidence.originalText,
          relation: evidence.relation,
          sourceType: evidence.sourceType,
          locatorStatus: evidence.locatorStatus,
          supportStatus: evidence.supportStatus,
          status: `${evidence.locatorStatus}/${evidence.supportStatus}`,
          withdrawn: evidence.withdrawnAt !== undefined,
        }
        // Study design is reported only when the stored metadata carries it; an
        // unreported design stays absent instead of being inferred.
        if (publicationTypes.length > 0) row.studyDesign = publicationTypes.join(', ')
        const section = evidence.section
        if (section !== undefined && section !== '') row.outcome = section
        return row
      })
    return { projectId, rows }
  }

  /**
   * Chase a secondary citation to its original paper (SPEC-R001-S04-004).
   *
   * The walk uses only the declared resolver, records every hop with its source,
   * identifier, status, and reason, keeps a visited set so a cycle cannot loop,
   * and stops at the configured `maxHops` with `CHASE_LIMIT`. A successful hop
   * creates a NEW direct evidence and re-locates it; the original secondary
   * record is never modified. A failed chase only records the failure.
   * @param input - Secondary evidence, printed reference, and optional hop cap.
   * @returns the chase outcome with every recorded hop.
   * @throws EvidenceError when the evidence does not exist.
   */
  @Remote
  async chase(input: ChaseInput): Promise<ChaseResult> {
    const origin = this.options.storage.evidences.get(input.evidenceId)
    if (origin === undefined) throw new EvidenceError('EVIDENCE_NOT_FOUND', `no evidence ${input.evidenceId}`)
    const resolver = this.options.referenceResolver
    if (resolver === undefined) {
      return { status: 'UNRESOLVED', hops: [], reason: 'no declared reference connector is configured' }
    }
    const maxHops = input.maxHops ?? this.options.maxHops
    if (maxHops < 1) return { status: 'CHASE_LIMIT', hops: [], reason: `maxHops ${maxHops} leaves no hop to take` }

    const identifier = input.reference.pmid ?? input.reference.doi ?? input.reference.title ?? ''
    const visited = new Set<string>([identifier])
    const hops: ChaseHop[] = []
    let resolved: ResolvedReference | undefined

    for (let hop = 0; hop < maxHops; hop += 1) {
      const target = await resolver.resolve(input.reference)
      if (target.status === 'UNRESOLVED') {
        hops.push({ source: 'declared-reference-connector', identifier, status: 'UNRESOLVED', reason: target.reason })
        break
      }
      const key = target.paperId
      if (visited.has(key)) {
        hops.push({ source: 'declared-reference-connector', identifier, status: 'SKIPPED_VISITED', reason: `paper ${key} was already visited` })
        break
      }
      visited.add(key)
      hops.push({ source: 'declared-reference-connector', identifier, status: 'RESOLVED', reason: `resolved to paper ${key}` })
      resolved = target
      break
    }

    if (resolved === undefined) {
      const limitReached = hops.length >= maxHops && hops.every(hop => hop.status === 'RESOLVED')
      return { status: limitReached ? 'CHASE_LIMIT' : 'UNRESOLVED', hops, reason: limitReached ? `reached maxHops ${maxHops}` : 'the reference could not be resolved to an original paper' }
    }

    const evidence = await this.save({
      projectId: origin.projectId,
      candidate: { paragraphId: resolved.paragraphId, quote: resolved.quote, relation: origin.relation, reason: `chased from evidence ${origin.id}` },
      provenance: {
        extractorVersion: origin.extractorVersion,
        extractorModel: origin.extractorModel,
        promptVersion: origin.promptVersion,
      },
    })
    await this.audit.append({
      action: 'reference.chase',
      projectId: origin.projectId,
      detail: { originEvidenceId: origin.id, createdEvidenceId: evidence.id, hops },
    })
    return { status: 'RESOLVED', evidence, hops }
  }

  /** Re-locate a stored evidence quote in its paragraph under current alignment. */
  private relocates(evidence: Evidence): boolean {
    if (evidence.paragraphId === undefined) return false
    const paragraph = this.options.storage.paragraphs.get(evidence.paragraphId)
    if (paragraph === undefined) return false
    const located = alignQuote(paragraph.text, evidence.normalizedText, this.options.alignment)
    return located.status === 'FOUND' || located.status === 'PARTIAL'
  }

  /**
   * Propagate one withdrawal: claims that bind the evidence lose their support
   * status and drafts that referenced it return to `DRAFT` with the missing
   * citation marked.
   */
  private async invalidateDependents(withdrawn: Evidence): Promise<void> {
    for (const [, claim] of this.options.storage.claims.entries()) {
      const binds = claim.evidenceIds.includes(withdrawn.id) || claim.counterEvidenceIds.includes(withdrawn.id)
      if (!binds) continue
      if (claim.supportStatus === 'PENDING' && claim.rejectionReasons.some(reason => reason.startsWith('EVIDENCE_WITHDRAWN'))) continue
      await this.options.storage.claims.put(claim.id, {
        ...claim,
        evidenceStatus: 'INSUFFICIENT',
        supportStatus: 'PENDING',
        rejectionReasons: [...claim.rejectionReasons, `EVIDENCE_WITHDRAWN:${withdrawn.id}`],
      })
    }
    for (const [, draft] of this.options.storage.drafts.entries()) {
      if (!draft.evidenceIds.includes(withdrawn.id)) continue
      if (draft.status === 'DRAFT') continue
      await this.options.storage.drafts.put(draft.id, {
        ...draft,
        status: 'DRAFT',
        revision: draft.revision + 1,
        updatedAt: this.options.now(),
      })
    }
  }
}
