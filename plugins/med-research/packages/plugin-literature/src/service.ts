/**
 * Literature service (SPEC ��9, ��19, ��20). Owns the stable capabilities behind
 * the `literature_*` tools: validating and persisting a proposed query plan,
 * executing a confirmed PubMed search, and reading one paper by PMID. Papers
 * returned by a search are persisted with their connector-assigned PMID/DOI,
 * so no later step ever needs the model to restate an identifier.
 *
 * This module implements the S02 executable-interface gaps: a real filter trace
 * recording exclusion reasons, honest Study Type / Full Text / language
 * filtering, an injectable AI rerank with explicit degradation, frozen search
 * runs paged by an opaque cursor, and independent provenance for counter /
 * related searches. Every network path is gated on an approved plan revision.
 * @module @medresearch/dsh-plugin-literature/src/service
 */

import type {
  LiteratureSearchInput,
  LiteratureSearchResult,
  MedLiteratureService,
  Paper,
  PaperId,
  PlanQueryInput,
  ProjectId,
  Query,
  QueryPurpose,
  ResearchQuery,
  ResearchQueryFilters,
  ResearchQueryId,
} from '@medresearch/dsh-medical-contracts'
import { bm25Rank, paperIdentityKey } from '@medresearch/dsh-medical-domain'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { PubmedConnector, PubmedRecord } from './pubmed/connector.ts'

/** Local identity of one frozen search run; opaque outside this service. */
export type SearchRunId = string

/** One reason a candidate was excluded by a filter (SPEC ��8: filter trace). */
export type FilterReason =
  | 'YEAR_BEFORE'
  | 'YEAR_AFTER'
  | 'STUDY_TYPE_MISMATCH'
  | 'STUDY_TYPE_UNKNOWN'
  | 'LANGUAGE_MISMATCH'
  | 'LANGUAGE_UNKNOWN'
  | 'FULLTEXT_UNAVAILABLE'

/** One deterministic filter decision over a frozen candidate (SPEC ��8). */
export interface FilterTraceEntry {
  /** Paper the decision concerns; every frozen candidate is persisted and keyed. */
  paperId: PaperId
  /** Whether the candidate passed every applied filter. */
  included: boolean
  /** Empty when `included` is true; otherwise the exclusion reasons. */
  reasons: FilterReason[]
}

/** Honest record of the filters actually applied to a run (SPEC ��8). */
export interface AppliedFilters {
  /** Year window from the approved plan, when present. */
  year?: { from?: string; to?: string }
  /** Study-type filter values and any records whose type was unknown. */
  studyType?: { values: string[]; unknownValues: string[] }
  /** Full-text filter actually used; `ANY` never excludes. */
  fullText?: 'ANY' | 'AVAILABLE'
  /**
   * Language filter requested on the call. It is recorded but never applied,
   * because the connector does not surface per-paper language metadata; we do
   * not pretend to filter on a field we cannot read (SPEC ��5).
   */
  languages?: { requested: string[]; applied: false; reason: string }
}

/** One bibliographic unit handed to the rerank capability (SPEC ��8). */
export interface RerankInput {
  /** Stable paper id the rank must preserve. */
  id: PaperId
  /** Title only; no identifier is ever sent to the model (SPEC ��8). */
  title: string
  /** Approved abstract, when one was retrieved. */
  abstract?: string
}

/** One reranked hit returned by the capability. */
export interface RerankHit {
  id: PaperId
  /** Larger means more relevant; ties break on initial rank. */
  score: number
}

/** Outcome of one rerank request (SPEC ��8: degradation contract). */
export interface RerankOutcome {
  /** Ranked hits; order is irrelevant, the service re-sorts by score then rank. */
  hits: RerankHit[]
  /**
   * True when the rank could not be produced (invalid model id, duplicate id,
   * missing score, ...). The service then uses lexical order AND marks the
   * result degraded; it never silently falls back (AGENTS.md ��2.8).
   */
  degraded: boolean
  /** Why the rank degraded; present exactly when `degraded` is true. */
  reason?: string
}

/** Injectable AI rerank; the connector is the network seam, this is the model seam. */
export interface RerankCapability {
  /**
   * Rank bibliography entries for relevance.
   * @param requests - Bibliographic units (title + approved abstract only).
   * @param modelId - Model id the caller requested; the capability decides validity.
   * @returns the ranked hits, or a degraded outcome the service must surface.
   */
  rerank(requests: readonly RerankInput[], modelId: string): Promise<RerankOutcome>
}

/** One frozen search run: a snapshot of a single `search` execution. */
export interface SearchRun {
  /** Opaque run identity; referenced by the page cursor. */
  id: SearchRunId
  projectId: ProjectId
  /** The executed query and its purpose. */
  query: Query
  /** PubMed-ordered frozen candidates (at most 100, all persisted). */
  frozenPapers: Paper[]
  /** Index in `frozenPapers` per paper id (its connector rank). */
  originalRank: Map<PaperId, number>
  /** Included candidates in final relevance order. */
  orderedPaperIds: PaperId[]
  /** Per-paper rank metadata applied to `orderedPaperIds`. */
  rankMeta: Map<PaperId, { score?: number; reason: string }>
  /** Full filter trace over the frozen set. */
  filterTrace: FilterTraceEntry[]
  /** Filters actually applied, including unknown values. */
  appliedFilters: AppliedFilters
  /** PubMed total match count (may exceed the frozen set). */
  totalCount: number
  /** Number of candidates whose metadata we actually retrieved. */
  localCandidateCount: number
  warnings: string[]
  /** True when the rerank degraded and lexical order was used. */
  degraded: boolean
  /** Why the rerank degraded; present exactly when `degraded` is true. */
  degradationReason?: string
  /** Independent provenance tag: the search purpose that produced the run. */
  provenance: QueryPurpose
  /** Relationship label for related-paper runs. */
  relationship?: string
  /** Source label for related-paper runs. */
  source?: string
  /** Query identity that produced a related-paper run. */
  queryIdentity?: ResearchQueryId
  createdAt: string
}

/** Durable store for frozen search runs; in-memory by default (see report). */
export interface SearchRunStore {
  /** Persist a run. */
  put(run: SearchRun): Promise<void>
  /** Read a run by id, or `undefined` when no such run exists. */
  get(id: SearchRunId): SearchRun | undefined
  /** Mint a fresh run id. */
  newId(): SearchRunId
}

/** In-memory {@link SearchRunStore}; run state lives for the service process. */
class MemorySearchRunStore implements SearchRunStore {
  private readonly runs = new Map<SearchRunId, SearchRun>()
  private sequence = 0

  async put(run: SearchRun): Promise<void> {
    this.runs.set(run.id, run)
  }

  get(id: SearchRunId): SearchRun | undefined {
    return this.runs.get(id)
  }

  newId(): SearchRunId {
    this.sequence += 1
    return `run-${this.sequence}`
  }
}

/** Construction dependencies of {@link LiteratureService}. */
export interface LiteratureServiceOptions {
  connector: PubmedConnector
  storage: MedStorage
  /** Page cap applied when a call omits `maxResults`. */
  defaultMaxResults: number
  /** Current time as an ISO string; injectable for deterministic tests. */
  now: () => string
  /** New paper identity; injectable for deterministic tests. */
  newPaperId: () => PaperId
  /** New research-query identity; injectable for deterministic tests. */
  newResearchQueryId: () => ResearchQueryId
  /** Injectable AI rerank; absent means lexical-only ranking (SPEC ��8). */
  rerank?: RerankCapability
  /** Durable search-run store; in-memory by default. */
  searchRunStore?: SearchRunStore
}

/** Search input extended with cursor paging, full-text filter, and rerank model. */
export interface LiteratureSearchInputWithCursor extends LiteratureSearchInput {
  /** Opaque page cursor returned by a prior search in the same run. */
  cursor?: string
  /** Page size; defaults to `maxResults` then to `defaultMaxResults`. */
  pageSize?: number
  /** Full-text filter applied after retrieval (SPEC ��8). */
  fullText?: 'ANY' | 'AVAILABLE'
  /** Model id requested for the AI rerank; validity is the capability's call. */
  rerankModel?: string
}

/** Search result extended with run/paging/provenance/degradation metadata. */
export interface LiteratureSearchResultExtended extends LiteratureSearchResult {
  /** PubMed total reported separately from the local candidate count (SPEC ��8). */
  totalCount: number
  /** Number of candidates whose metadata we retrieved locally. */
  localCandidateCount: number
  /** Full filter trace over the frozen set; always present on a real result. */
  filterTrace: FilterTraceEntry[]
  /** Final ranking metadata; at most twenty entries, always present. */
  ranking: Array<{ paperId: PaperId; originalRank: number; score?: number; reason: string }>
  /** Frozen run this result belongs to. */
  runId: SearchRunId
  /** Opaque cursor for the next page, absent on the last page. */
  nextCursor?: string
  /** Filters actually applied, with unknown values flagged. */
  appliedFilters: AppliedFilters
  /** True when the AI rerank degraded to lexical order (SPEC ��8). */
  degraded: boolean
  /** Why the rerank degraded; present exactly when `degraded` is true. */
  degradationReason?: string
  /** Independent provenance: the search purpose that produced the result. */
  provenance: QueryPurpose
  /** Relationship label for related-paper results. */
  relationship?: string
  /** Source label for related-paper results. */
  source?: string
  /** Query identity that produced related-paper results. */
  queryIdentity?: ResearchQueryId
}

/** Decode a page cursor into its run and offset. */
function decodeCursor(cursor: string): { runId: SearchRunId; offset: number; pageSize: number } {
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
  } catch {
    throw new Error('invalid search cursor')
  }
  if (
    typeof decoded !== 'object' || decoded === null
    || typeof (decoded as Record<string, unknown>).runId !== 'string'
    || typeof (decoded as Record<string, unknown>).offset !== 'number'
    || typeof (decoded as Record<string, unknown>).pageSize !== 'number'
  ) {
    throw new Error('invalid search cursor')
  }
  const value = decoded as { runId: SearchRunId; offset: number; pageSize: number }
  if (value.offset < 0 || value.pageSize < 1) throw new Error('invalid search cursor')
  return value
}

/** Encode a page cursor from its components. */
function encodeCursor(runId: SearchRunId, offset: number, pageSize: number): string {
  return Buffer.from(JSON.stringify({ runId, offset, pageSize })).toString('base64')
}

/** Validate that a proposed plan is executable in V1: at least one `primary` and one `broad` query (SPEC ��18). */
function assertExecutablePlan(plan: PlanQueryInput['plan']): void {
  for (const purpose of ['primary', 'broad'] as const) {
    if (!plan.queries.some(query => query.purpose === purpose)) {
      throw new Error(`query plan must contain at least one '${purpose}' query (SPEC ��18)`)
    }
  }
}

/** Literature capabilities over one storage handle and one connector. */
export class LiteratureService implements MedLiteratureService {
  /** Typert Gateway binding: the Web client reaches these methods as `medLiterature/*` (SPEC ��30). */
  readonly typertRemote = bindTypertRemote(this, 'medLiterature')

  private readonly options: LiteratureServiceOptions
  private readonly runs: SearchRunStore

  /**
   * @param options - Connector, storage, and injectable identity/clock/rerank.
   */
  constructor(options: LiteratureServiceOptions) {
    this.options = options
    this.runs = options.searchRunStore ?? new MemorySearchRunStore()
  }

  /**
   * Validate and persist a proposed query plan. No network request is made.
   * @param input - Project, question, proposed plan, and optional filters.
   * @returns the stored research query.
   */
  @Remote
  async planQuery(input: PlanQueryInput): Promise<ResearchQuery> {
    assertExecutablePlan(input.plan)
    const record: ResearchQuery = {
      id: this.options.newResearchQueryId(),
      projectId: input.projectId,
      question: input.question,
      normalizedQuestion: input.plan.normalizedQuestion,
      ...input.plan.pico === undefined ? {} : { pico: input.plan.pico },
      concepts: input.plan.concepts,
      queries: input.plan.queries,
      filters: input.filters ?? {},
      revision: 1,
      createdAt: this.options.now(),
    }
    await this.options.storage.researchQueries.put(record.id, record)
    return record
  }

  /** Replace a stored plan without contacting PubMed; approval is revoked. */
  @Remote
  async editQuery(id: ResearchQueryId, input: PlanQueryInput['plan'] & { filters?: ResearchQueryFilters }): Promise<ResearchQuery> {
    const current = this.options.storage.researchQueries.get(id)
    if (current === undefined) throw new Error(`research query ${id} not found`)
    assertExecutablePlan(input)
    const { approvedAt: _approvedAt, approvedRevision: _approvedRevision, ...withoutApproval } = current
    const updated: ResearchQuery = {
      ...withoutApproval,
      normalizedQuestion: input.normalizedQuestion,
      ...input.pico === undefined ? {} : { pico: input.pico },
      concepts: input.concepts,
      queries: input.queries,
      filters: input.filters ?? current.filters,
      revision: (current.revision ?? 1) + 1,
    }
    await this.options.storage.researchQueries.put(id, updated)
    return updated
  }

  /** Mark a stored plan as approved for subsequent searches. */
  @Remote
  async approveQuery(id: ResearchQueryId): Promise<ResearchQuery> {
    const current = this.options.storage.researchQueries.get(id)
    if (current === undefined) throw new Error(`research query ${id} not found`)
    const approved: ResearchQuery = { ...current, approvedAt: this.options.now(), approvedRevision: current.revision ?? 1 }
    await this.options.storage.researchQueries.put(id, approved)
    return approved
  }

  /** Execute a confirmed query while marking its independent counter purpose (SPEC ��8). */
  @Remote
  async counterSearch(input: LiteratureSearchInput): Promise<LiteratureSearchResultExtended> {
    return this.search({ ...input, purpose: 'counter' })
  }

  /** Execute a confirmed query while marking its independent related purpose (SPEC ��8). */
  @Remote
  async relatedSearch(input: LiteratureSearchInput): Promise<LiteratureSearchResultExtended> {
    return this.search({ ...input, purpose: 'related' })
  }

  /**
   * Execute one confirmed PubMed query, freeze the candidate set into a search
   * run, and return the first page. With a `cursor` the call replays the same
   * frozen run and never issues a network request.
   * @param input - Query, purpose, filters, full-text filter, rerank model, and optional cursor.
   * @returns the persisted papers plus the connector's totals and warnings.
   * @throws Error when approval is missing or the cursor is invalid.
   */
  @Remote
  async search(input: LiteratureSearchInputWithCursor): Promise<LiteratureSearchResultExtended> {
    if (input.cursor !== undefined) return this.page(input.cursor)

    if (input.researchQueryId === undefined) {
      throw new Error('researchQueryId is required; create and approve a query plan before searching')
    }
    const plan = this.options.storage.researchQueries.get(input.researchQueryId)
    if (plan === undefined || plan.projectId !== input.projectId || plan.approvedAt === undefined || (plan.approvedRevision ?? plan.revision ?? 1) !== (input.researchQueryRevision ?? plan.revision ?? 1)) {
      throw new Error('research query must be approved for this project and revision before searching')
    }

    const maxResults = input.maxResults ?? this.options.defaultMaxResults
    const found = await this.options.connector.search({
      query: input.query,
      maxResults,
      ...input.dateFrom === undefined ? {} : { dateFrom: input.dateFrom },
      ...input.dateTo === undefined ? {} : { dateTo: input.dateTo },
      ...input.publicationTypes === undefined ? {} : { publicationTypes: input.publicationTypes },
      ...input.languages === undefined ? {} : { languages: input.languages },
    })

    // SPEC ��8: freeze at most 100 unique candidates in PubMed order.
    const frozenRecords = found.records.slice(0, Math.min(found.records.length, 100))
    const frozenPapers = await this.persist(frozenRecords)
    const originalRank = new Map<PaperId, number>(frozenPapers.map((paper, index) => [paper.id, index]))

    // Real filter trace: record why each candidate was excluded (SPEC ��8).
    const filterTrace: FilterTraceEntry[] = frozenPapers.map(paper => {
      const record = frozenRecords[originalRank.get(paper.id)!]!
      const reasons = this.exclusionReasons(record, plan.filters, input.fullText)
      return { paperId: paper.id, included: reasons.length === 0, reasons }
    })
    const unknownStudyType = filterTrace
      .filter(entry => entry.reasons.includes('STUDY_TYPE_UNKNOWN'))
      .map(entry => entry.paperId)
    const appliedFilters = this.appliedFilters(plan.filters, input.fullText, input.languages, unknownStudyType)
    const included = frozenPapers.filter(paper => filterTrace[originalRank.get(paper.id)!]!.included)

    const { orderedPaperIds, rankMeta, degraded, degradationReason } = await this.rank(
      input.query,
      frozenPapers,
      included,
      input.rerankModel ?? '',
    )

    const run: SearchRun = {
      id: this.runs.newId(),
      projectId: input.projectId,
      query: { source: 'pubmed', query: input.query, purpose: input.purpose },
      frozenPapers,
      originalRank,
      orderedPaperIds,
      rankMeta,
      filterTrace,
      appliedFilters,
      totalCount: found.totalCount,
      localCandidateCount: frozenPapers.length,
      warnings: found.warnings,
      degraded,
      ...degradationReason === undefined ? {} : { degradationReason },
      provenance: input.purpose,
      ...input.purpose === 'related'
        ? { relationship: 'related', source: 'pubmed', queryIdentity: input.researchQueryId }
        : {},
      createdAt: this.options.now(),
    }
    await this.runs.put(run)
    return this.renderPage(run, 0, this.pageSize(input, maxResults))
  }

  /** Replay one page of a frozen run; never touches the network (SPEC ��8). */
  private page(cursor: string): LiteratureSearchResultExtended {
    const { runId, offset, pageSize } = decodeCursor(cursor)
    const run = this.runs.get(runId)
    if (run === undefined) throw new Error('invalid search cursor')
    return this.renderPage(run, offset, pageSize)
  }

  /** Build one page result from a frozen run. */
  private renderPage(run: SearchRun, offset: number, pageSize: number): LiteratureSearchResultExtended {
    const end = Math.min(offset + pageSize, run.orderedPaperIds.length)
    const pageIds = run.orderedPaperIds.slice(offset, end)
    const byId = new Map<PaperId, Paper>(run.frozenPapers.map(paper => [paper.id, paper]))
    const papers = pageIds.map(id => byId.get(id)!).filter((paper): paper is Paper => paper !== undefined)
    const ranking = pageIds.map(id => ({
      paperId: id,
      originalRank: run.originalRank.get(id) ?? 0,
      ...run.rankMeta.get(id)?.score === undefined ? {} : { score: run.rankMeta.get(id)!.score },
      reason: run.rankMeta.get(id)?.reason ?? 'connector order',
    }))
    const nextOffset = end < run.orderedPaperIds.length ? end : undefined
    const warnings = [...run.warnings]
    if (run.degraded && run.degradationReason !== undefined) warnings.push(`rerank degraded: ${run.degradationReason}`)

    return {
      query: run.query,
      papers,
      totalCount: run.totalCount,
      warnings,
      filterTrace: run.filterTrace,
      ranking,
      localCandidateCount: run.localCandidateCount,
      runId: run.id,
      ...nextOffset === undefined ? {} : { nextCursor: encodeCursor(run.id, nextOffset, pageSize) },
      appliedFilters: run.appliedFilters,
      degraded: run.degraded,
      ...run.degradationReason === undefined ? {} : { degradationReason: run.degradationReason },
      provenance: run.provenance,
      ...run.relationship === undefined ? {} : { relationship: run.relationship },
      ...run.source === undefined ? {} : { source: run.source },
      ...run.queryIdentity === undefined ? {} : { queryIdentity: run.queryIdentity },
      ...papers.length < Math.min(run.totalCount, 100)
        ? { partialReason: `returned ${papers.length} of ${Math.min(run.totalCount, 100)} requested records` }
        : {},
    }
  }

  /** Resolve the page size for a search. */
  private pageSize(input: LiteratureSearchInputWithCursor, maxResults: number): number {
    return input.pageSize ?? maxResults
  }

  /**
   * Rank the included candidates, using the injected rerank or lexical BM25.
   * @returns ordered ids, per-id metadata, and whether the rerank degraded.
   */
  private async rank(
    query: string,
    frozen: Paper[],
    included: Paper[],
    modelId: string,
  ): Promise<{ orderedPaperIds: PaperId[]; rankMeta: Map<PaperId, { score?: number; reason: string }>; degraded: boolean; degradationReason?: string }> {
    const rankMeta = new Map<PaperId, { score?: number; reason: string }>()
    let degraded = false
    let degradationReason: string | undefined
    let source: 'lexical' | 'ai' = 'lexical'

    let hits: Array<{ id: PaperId; score?: number }>
    if (this.options.rerank !== undefined) {
      const outcome = await this.options.rerank.rerank(
        included.map(paper => ({
          id: paper.id,
          title: paper.title,
          ...paper.abstract === undefined ? {} : { abstract: paper.abstract },
        })),
        modelId,
      )
      if (outcome.degraded) {
        degraded = true
        degradationReason = outcome.reason
        hits = this.lexicalHits(query, included)
      } else {
        source = 'ai'
        hits = outcome.hits.map(hit => ({ id: hit.id, score: hit.score }))
      }
    } else {
      hits = this.lexicalHits(query, included)
    }

    const byId = new Map<PaperId, number>(frozen.map((paper, index) => [paper.id, index]))
    const ordered = [...hits]
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || (byId.get(left.id) ?? 0) - (byId.get(right.id) ?? 0))
      .map(hit => hit.id)
    for (const hit of hits) {
      rankMeta.set(hit.id, {
        ...hit.score === undefined ? {} : { score: hit.score },
        reason: degraded
          ? 'lexical relevance (rerank degraded)'
          : (source === 'ai' ? 'ai relevance' : (hit.score === undefined ? 'connector order' : 'lexical relevance')),
      })
    }
    return { orderedPaperIds: ordered, rankMeta, degraded, ...degradationReason === undefined ? {} : { degradationReason } }
  }

  /** Lexical BM25 ranking; falls back to connector order when nothing scores. */
  private lexicalHits(query: string, included: Paper[]): Array<{ id: PaperId; score?: number }> {
    const scored = bm25Rank(query, included.map(paper => ({ id: paper.id, text: `${paper.title} ${paper.abstract ?? ''}` })), 100)
    if (scored.length > 0) return scored.map(hit => ({ id: hit.id as PaperId, score: hit.score }))
    return included.map(paper => ({ id: paper.id }))
  }

  /** Compute the honest applied-filter record (SPEC ��8). */
  private appliedFilters(
    planFilters: ResearchQueryFilters,
    fullText: 'ANY' | 'AVAILABLE' | undefined,
    languages: string[] | undefined,
    unknownStudyType: PaperId[],
  ): AppliedFilters {
    const applied: AppliedFilters = {}
    if (planFilters.dateFrom !== undefined || planFilters.dateTo !== undefined) {
      applied.year = {
        ...planFilters.dateFrom === undefined ? {} : { from: planFilters.dateFrom },
        ...planFilters.dateTo === undefined ? {} : { to: planFilters.dateTo },
      }
    }
    if (planFilters.publicationTypes !== undefined && planFilters.publicationTypes.length > 0) {
      applied.studyType = { values: planFilters.publicationTypes, unknownValues: unknownStudyType }
    }
    if (fullText !== undefined) applied.fullText = fullText
    if (languages !== undefined && languages.length > 0) {
      applied.languages = { requested: languages, applied: false, reason: 'connector does not surface per-paper language metadata' }
    }
    return applied
  }

  /** Determine the exclusion reasons for one candidate (SPEC ��8). */
  private exclusionReasons(record: PubmedRecord, planFilters: ResearchQueryFilters, fullText: 'ANY' | 'AVAILABLE' | undefined): FilterReason[] {
    const reasons: FilterReason[] = []
    const year = record.publicationDate?.slice(0, 4)
    if (planFilters.dateFrom !== undefined && (year === undefined || year < planFilters.dateFrom.slice(0, 4))) reasons.push('YEAR_BEFORE')
    if (planFilters.dateTo !== undefined && (year === undefined || year > planFilters.dateTo.slice(0, 4))) reasons.push('YEAR_AFTER')

    if (planFilters.publicationTypes !== undefined && planFilters.publicationTypes.length > 0) {
      const types = record.publicationTypes
      if (types.length === 0) reasons.push('STUDY_TYPE_UNKNOWN')
      else if (!types.some(type => planFilters.publicationTypes!.includes(type))) reasons.push('STUDY_TYPE_MISMATCH')
    }

    if (fullText === 'AVAILABLE') {
      // SPEC ��8: only a resolver-verified upload or compliant PMC source counts;
      // an abstract alone is not full text, and the unknown state must not pretend.
      if (record.fulltextStatus !== 'available' && record.fulltextStatus !== 'user_upload') reasons.push('FULLTEXT_UNAVAILABLE')
    }
    return reasons
  }

  /**
   * Read one paper by PMID, fetching and persisting it when absent locally.
   * Direct PMID/DOI resolution is outside the approval-gated search paths and is
   * used only for already-confirmed citation resolution (SPEC ��8).
   * @param pmid - PubMed identifier.
   * @returns the paper, or `undefined` when PubMed has no such PMID.
   */
  @Remote
  async getPaper(pmid: string): Promise<Paper | undefined> {
    for (const [, paper] of this.options.storage.papers.entries()) {
      if (paper.pmid === pmid) return paper
    }
    const record = await this.options.connector.fetchByPmid(pmid)
    if (record === undefined) return undefined
    return (await this.persist([record]))[0]
  }

  /** Read papers currently saved to a project's library. */
  @Remote
  async listForProject(projectId: ProjectId): Promise<Paper[]> {
    const ids = new Set([...this.options.storage.projectPapers.entries()].map(([, membership]) => membership).filter(membership => membership.projectId === projectId).map(membership => membership.paperId))
    return [...this.options.storage.papers.entries()].map(([, paper]) => paper).filter(paper => ids.has(paper.id))
  }

  /** Remove only a project membership; paper/source history remains intact. */
  @Remote
  async unsave(projectId: ProjectId, paperId: PaperId): Promise<void> {
    await this.options.storage.projectPapers.delete(`${projectId}|${paperId}`)
  }

  /** Upsert records by identity, reusing the stored paper when one already exists. */
  private async persist(records: readonly PubmedRecord[]): Promise<Paper[]> {
    const byIdentity = new Map<string, Paper>()
    for (const [, paper] of this.options.storage.papers.entries()) {
      byIdentity.set(paperIdentityKey(paper), paper)
    }
    const papers: Paper[] = []
    for (const record of records) {
      const key = paperIdentityKey(record)
      const existing = byIdentity.get(key)
      if (existing !== undefined) {
        papers.push(existing)
        continue
      }
      const timestamp = this.options.now()
      const paper: Paper = {
        id: this.options.newPaperId(),
        ...record,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await this.options.storage.papers.put(paper.id, paper)
      await this.options.storage.paperSources.put(`${paper.id}|pubmed|${record.pmid ?? record.doi ?? paper.title}`, {
        paperId: paper.id,
        source: 'pubmed',
        sourceId: record.pmid ?? record.doi ?? paper.title,
        rawMetadata: record,
      })
      byIdentity.set(key, paper)
      papers.push(paper)
    }
    return papers
  }
}
