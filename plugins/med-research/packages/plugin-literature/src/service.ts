/**
 * Literature service (SPEC §9, §19). Owns the stable capabilities behind the
 * `literature_*` tools: validating and persisting a proposed query plan,
 * executing a confirmed PubMed search, and reading one paper by PMID. Papers
 * returned by a search are persisted with their connector-assigned PMID/DOI,
 * so no later step ever needs the model to restate an identifier.
 * @module @medresearch/dsh-plugin-literature/src/service
 */

import type {
  LiteratureSearchInput,
  LiteratureSearchResult,
  MedLiteratureService,
  Paper,
  PaperId,
  PlanQueryInput,
  ResearchQuery,
  ResearchQueryFilters,
  ResearchQueryId,
} from '@medresearch/dsh-medical-contracts'
import { paperIdentityKey, bm25Rank } from '@medresearch/dsh-medical-domain'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { PubmedConnector, PubmedRecord } from './pubmed/connector.ts'

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
}

/**
 * Validate that a proposed plan is executable in V1: at least one `primary`
 * and one `broad` query, per SPEC §18.
 * @param plan - Proposed query plan.
 * @throws Error naming the missing purpose when the plan is not executable.
 */
function assertExecutablePlan(plan: PlanQueryInput['plan']): void {
  for (const purpose of ['primary', 'broad'] as const) {
    if (!plan.queries.some(query => query.purpose === purpose)) {
      throw new Error(`query plan must contain at least one '${purpose}' query (SPEC §18)`)
    }
  }
}

/** Literature capabilities over one storage handle and one connector. */
export class LiteratureService implements MedLiteratureService {
  /** Typert Gateway binding: the Web client reaches these methods as `medLiterature/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medLiterature')

  private readonly options: LiteratureServiceOptions

  /**
   * @param options - Connector, storage, and injectable identity/clock.
   */
  constructor(options: LiteratureServiceOptions) {
    this.options = options
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
    const updated: ResearchQuery = {
      ...current,
      normalizedQuestion: input.normalizedQuestion,
      ...input.pico === undefined ? {} : { pico: input.pico },
      concepts: input.concepts,
      queries: input.queries,
      filters: input.filters ?? current.filters,
    }
    await this.options.storage.researchQueries.put(id, updated)
    return updated
  }

  /** Mark a stored plan as approved for subsequent searches. */
  @Remote
  async approveQuery(id: ResearchQueryId): Promise<ResearchQuery> {
    const current = this.options.storage.researchQueries.get(id)
    if (current === undefined) throw new Error(`research query ${id} not found`)
    const approved: ResearchQuery = { ...current, approvedAt: this.options.now() }
    await this.options.storage.researchQueries.put(id, approved)
    return approved
  }

  /** Execute a confirmed query while marking its independent counter purpose. */
  @Remote
  async counterSearch(input: LiteratureSearchInput): Promise<LiteratureSearchResult> {
    return this.search({ ...input, purpose: 'counter' })
  }

  /** Execute a confirmed query while marking its independent related purpose. */
  @Remote
  async relatedSearch(input: LiteratureSearchInput): Promise<LiteratureSearchResult> {
    return this.search({ ...input, purpose: 'related' })
  }

  /**
   * Execute one confirmed PubMed query and persist the returned papers.
   * @param input - Query, purpose, filters, and optional page cap.
   * @returns the persisted papers plus the connector's totals and warnings.
   */
  @Remote
  async search(input: LiteratureSearchInput): Promise<LiteratureSearchResult> {
    if (input.researchQueryId !== undefined) {
      const plan = this.options.storage.researchQueries.get(input.researchQueryId)
      if (plan === undefined || plan.projectId !== input.projectId || plan.approvedAt === undefined) {
        throw new Error('research query must be approved for this project before searching')
      }
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
    const papers = await this.persist(found.records)
    const expected = Math.min(found.totalCount, maxResults)
    const filterTrace = papers.map((paper, index) => ({ paperId: paper.id, included: index < 20, reasons: index < 20 ? [] : ['TOP_20_CAP'] }))
    const ranked = bm25Rank(input.query, papers.map(paper => ({ id: paper.id, text: `${paper.title} ${paper.abstract ?? ''}` })), 20)
    const byId = new Map<string, { paper: Paper; index: number }>(papers.map((paper, index) => [paper.id, { paper, index }]))
    const ranking = (ranked.length > 0 ? ranked : papers.slice(0, 20).map(paper => ({ id: paper.id, score: undefined }))).map((hit, index) => ({
      paperId: byId.get(hit.id)!.paper.id, originalRank: byId.get(hit.id)?.index ?? index, ...(hit.score === undefined ? {} : { score: hit.score }), reason: hit.score === undefined ? 'connector order' : 'lexical relevance',
    }))
    const ordered = ranking.map(item => byId.get(item.paperId)!.paper)
    return {
      query: { source: 'pubmed', query: input.query, purpose: input.purpose },
      papers: ordered,
      totalCount: found.totalCount,
      warnings: found.warnings,
      filterTrace,
      ranking,
      ...papers.length < expected
        ? { partialReason: `returned ${papers.length} of ${expected} requested records` }
        : {},
    }
  }

  /**
   * Read one paper by PMID, fetching and persisting it when absent locally.
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
