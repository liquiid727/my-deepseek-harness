/**
 * Service definitions for the nine `med`-prefixed host services (SPEC §5,
 * §30–§38). These are the seam contracts tools and the Web layer call; no tool
 * touches storage directly (SPEC §5). Implementations arrive with their
 * plugins in later phases, and every service key carries the `med` prefix to
 * avoid colliding with harness services.
 * @module @medresearch/dsh-medical-contracts/src/services
 */

import type { ArtifactId, ClaimId, DatasetId, DocumentId, EvidenceId, PaperId, ParagraphId, ProjectId, ResearchQueryId } from './ids.ts'
import type {
  Evidence,
  EvidenceChunk,
  EvidenceRelation,
  EvidenceSourceType,
  FulltextResolution,
  Paper,
  PaperDocument,
  PaperParagraph,
  PaperSection,
  Project,
  ProjectPaper,
  Query,
  QueryPlan,
  QueryPurpose,
  ResearchQuery,
  ResearchQueryFilters,
  ResearchQueryInput,
  SupportStatus,
} from './research.ts'
import type {
  AnalysisPlan,
  AnalysisRun,
  Artifact,
  Dataset,
  DatasetColumn,
  StatisticsRunInput,
  StatisticsRunResult,
} from './statistics.ts'

/** Fields accepted when creating a project (SPEC §32). */
export interface ProjectCreateInput {
  name: string
  researchQuestion?: string
  background?: string
  population?: string
  interventionOrExposure?: string
  comparison?: string
  outcome?: string
  keywords?: string[]
}

/** Mutable project fields; identity, workspace binding, and timestamps are owned by the service. */
export type ProjectPatch = Partial<Omit<Project, 'id' | 'workspacePath' | 'createdAt' | 'updatedAt'>>

/** Project overview counters (US-001). */
export interface ProjectOverview {
  projectId: ProjectId
  questions: number
  papers: number
  evidences: number
  datasets: number
  analyses: number
  charts: number
}

/** Project lifecycle service (SPEC §32). */
export interface MedProjectsService {
  /** Create the project record, its directory, and its `project.json`. */
  create(input: ProjectCreateInput): Promise<Project>
  /** List projects visible in this deployment. */
  list(): Promise<Project[]>
  /** Read one project; `undefined` when it does not exist. */
  get(id: ProjectId): Promise<Project | undefined>
  /** Apply a patch and return the updated project. */
  update(id: ProjectId, patch: ProjectPatch): Promise<Project>
  /** Delete a project and its owned records. */
  delete(id: ProjectId): Promise<void>
  /** Counts shown on the project overview. */
  overview(id: ProjectId): Promise<ProjectOverview>
  /** Save one already-fetched paper into the project library. */
  savePaper(id: ProjectId, paperId: PaperId): Promise<ProjectPaper>
}

/** One page of PubMed search results (SPEC §12). */
export interface LiteratureSearchResult {
  /** The executed query and why it was run. */
  query: Query
  papers: Paper[]
  /** Total matching records reported by the connector, not the page length. */
  totalCount: number
  /** Non-fatal PubMed messages (ignored phrases, no items, …). */
  warnings: string[]
  /** Present when the search returned fewer results than requested. */
  partialReason?: string
}

/** Input of one query-plan persistence call (SPEC §18). */
export interface PlanQueryInput {
  projectId: ProjectId
  /** The question as the user typed it. */
  question: string
  /** The agent's proposed plan; the service validates, normalizes, and stores it. */
  plan: QueryPlan
  filters?: ResearchQueryFilters
}

/** Input of one confirmed PubMed search (SPEC §19, FR-2). */
export interface LiteratureSearchInput {
  projectId: ProjectId
  /** Executable PubMed query string. */
  query: string
  purpose: QueryPurpose
  /** Page cap; resolved from plugin Config when absent. */
  maxResults?: number
  dateFrom?: string
  dateTo?: string
  publicationTypes?: string[]
  languages?: string[]
  /** Provenance link to the plan this query came from. */
  researchQueryId?: ResearchQueryId
}

/** Literature planning and search service (SPEC §9, §19). */
export interface MedLiteratureService {
  /**
   * Validate and persist the agent's proposed query plan. Issues no network
   * request, so nothing reaches PubMed before the user confirms (FR-2).
   */
  planQuery(input: PlanQueryInput): Promise<ResearchQuery>
  /** Execute one confirmed query against PubMed. */
  search(input: LiteratureSearchInput): Promise<LiteratureSearchResult>
  /** Read one paper by PMID from the connector. */
  getPaper(pmid: string): Promise<Paper | undefined>
}

/** Paper reading and full-text service (SPEC §31). */
export interface MedPapersService {
  /** Read one saved paper. */
  get(id: PaperId): Promise<Paper | undefined>
  /** Parsed documents of one paper. */
  document(id: PaperId): Promise<PaperDocument[]>
  /** Sections of one document, ordered. */
  sections(id: DocumentId): Promise<PaperSection[]>
  /** Read one paragraph by id. */
  paragraph(paragraphId: ParagraphId): Promise<PaperParagraph | undefined>
  /** Resolve a programmatically allowed full-text channel. */
  resolveFulltext(id: PaperId): Promise<FulltextResolution>
  /** Persist a user-uploaded paper. */
  upload(projectId: ProjectId, fileRef: string): Promise<Paper>
  /** Search paragraph text inside one paper. */
  search(id: PaperId, query: string): Promise<PaperParagraph[]>
}

/** Full-text resolution seam (SPEC §21). */
export interface MedFulltextService {
  /**
   * Resolve a paper's full text through the allowed channel priority.
   * @param paper - The paper whose full text is requested.
   * @returns the resolution; `unavailable` is a real outcome, never an error.
   */
  resolve(paper: Paper): Promise<FulltextResolution>
}

/** Retrieval input for the evidence engine (SPEC §24). */
export interface EvidenceRetrieveInput {
  projectId: ProjectId
  /** Candidate claim text being researched. */
  claimText: string
  conceptTerms: string[]
  /** Restrict retrieval to specific papers; absent means the whole project library. */
  paperIds?: PaperId[]
  maxResults: number
}

/** One model-proposed evidence candidate awaiting deterministic location (SPEC §25). */
export interface EvidenceCandidate {
  paragraphId: ParagraphId
  quote: string
  relation: EvidenceRelation
  reason: string
}

/** Extraction provenance written with every saved evidence (SPEC §11, §25). */
export interface ExtractionProvenance {
  extractorVersion: string
  extractorModel: string
  promptVersion: string
}

/** Evidence retrieval, location, and verification service (SPEC §24–§26). */
export interface MedEvidenceService {
  /** Rank retrieval units (chunks) for one claim within the project scope. */
  retrieve(input: EvidenceRetrieveInput): Promise<EvidenceChunk[]>
  /**
   * Locate and persist one candidate. Locator status is computed from the
   * paragraph, never supplied; provenance is required.
   */
  save(input: {
    projectId: ProjectId
    candidate: EvidenceCandidate
    provenance: ExtractionProvenance
    sourceType?: EvidenceSourceType
  }): Promise<Evidence>
  /**
   * Apply a semantic verdict. The hard rule wins: a `NOT_FOUND` locator always
   * resolves to `REJECTED` regardless of the requested status.
   */
  verify(id: EvidenceId, verdict: SupportStatus): Promise<Evidence>
  /** All evidence bound to one claim. */
  listForClaim(id: ClaimId): Promise<Evidence[]>
}

/** Dataset upload and profiling service (SPEC §33). */
export interface MedDatasetsService {
  /** Validate, hash, parse, profile, and persist one uploaded file. */
  upload(input: { projectId: ProjectId; fileRef: string }): Promise<Dataset>
  /** Re-read the stored profile of one dataset. */
  profile(id: DatasetId): Promise<Dataset | undefined>
  /** Column schema of one dataset. */
  schema(id: DatasetId): Promise<DatasetColumn[]>
}

/** Statistics planning and execution service (SPEC §34–§35). */
export interface MedStatisticsService {
  /** Persist the agent-proposed plan as a `planned` run; never executes. */
  plan(input: { projectId: ProjectId; datasetId: DatasetId; question: string; plan: AnalysisPlan }): Promise<AnalysisRun>
  /** Persist generated code for a planned run; marks it `approved`. */
  generateCode(id: AnalysisRun['id'], code: string): Promise<AnalysisRun>
  /** Execute approved code through the isolated runner. */
  execute(input: StatisticsRunInput & { analysisRunId: AnalysisRun['id'] }): Promise<StatisticsRunResult>
}

/** Artifact lookup and export service (SPEC §38). */
export interface MedArtifactsService {
  /** Read one artifact record. */
  get(id: ArtifactId): Promise<Artifact | undefined>
  /** Export an artifact's bytes in the requested format. */
  export(id: ArtifactId, format: 'png' | 'svg' | 'csv' | 'json'): Promise<Uint8Array>
}
