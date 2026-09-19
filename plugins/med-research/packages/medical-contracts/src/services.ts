/**
 * Service definitions for the nine `med`-prefixed host services (SPEC §5,
 * §30–§38). These are the seam contracts tools and the Web layer call; no tool
 * touches storage directly (SPEC §5). Implementations arrive with their
 * plugins in later phases, and every service key carries the `med` prefix to
 * avoid colliding with harness services.
 * @module @medresearch/dsh-medical-contracts/src/services
 */

import { z } from 'zod'
import type { AnalysisRunId, AnnotationId, ArtifactId, ClaimId, DatasetId, DocumentId, DraftId, EvidenceId, NoteId, PaperId, ParagraphId, ProjectId, ResearchQueryId, TagId, TaskId } from './ids.ts'
import type {
  Claim,
  Evidence,
  EvidenceChunk,
  EvidenceRelation,
  EvidenceSourceType,
  FulltextResolution,
  LocatorStatus,
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
  SessionProject,
  SupportStatus,
  AgentMode,
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
import type {
  Annotation,
  Draft,
  DraftRevision,
  KnowledgeSearchResult,
  Note,
  SourceAnchor,
  Tag,
} from './knowledge.ts'
import type {
  Task,
  TaskCreateInput,
  TaskPatch,
} from './tasks.ts'
import type {
  Skill,
  SkillDefinition,
  SkillInstallation,
  SkillTestRun,
  SkillVersion,
} from './skills.ts'
import type {
  CitationExport,
  WritingGeneration,
  WritingLanguage,
  WritingValidation,
} from './writing.ts'

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

/** Runtime schema input for project creation at service boundaries. */
export const projectCreateInputSchema = z.strictObject({
  name: z.string().trim().min(1),
  researchQuestion: z.string().optional(),
  background: z.string().optional(),
  population: z.string().optional(),
  interventionOrExposure: z.string().optional(),
  comparison: z.string().optional(),
  outcome: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

/** Mutable project fields; identity, workspace binding, and timestamps are owned by the service. */
export type ProjectPatch = Partial<Omit<Project, 'id' | 'workspacePath' | 'createdAt' | 'updatedAt'>>

/**
 * Trailing window the overview reports record growth over. A fixed spec
 * constant rather than a tunable: two clients asking the same question in the
 * same session must not disagree about what "recent" means.
 */
export const PROJECT_OVERVIEW_DELTA_WINDOW_DAYS = 30

/**
 * Records added inside the trailing window. Reported only when the counted
 * entity carries the timestamp that makes the comparison meaningful; a counter
 * without one omits `delta` entirely rather than reporting a zero increase as
 * if nothing had happened.
 */
export interface ProjectOverviewDelta {
  readonly value: number
  readonly windowDays: number
}

/** Availability of one overview counter (SPEC-R001-S01-002). */
export interface ProjectOverviewCounter {
  /** `counted` carries the persisted total; `unavailable` reports the domain read failure. */
  status: 'counted' | 'unavailable'
  /** Persisted count; present exactly when `status` is `counted`. */
  value?: number
  /** Growth over {@link PROJECT_OVERVIEW_DELTA_WINDOW_DAYS}; absent when unknown. */
  delta?: ProjectOverviewDelta
}

/**
 * One counted overview domain, or the record that reading it failed. An
 * `unavailable` domain is never reported as zero: the client shows unknown.
 */
export type ProjectOverviewDomain =
  | 'papers'
  | 'evidences'
  | 'notes'
  | 'documents'
  | 'datasets'
  | 'sessions'
  | 'tasks'
  | 'analyses'
  | 'charts'

/** Project overview counters (US-001, SPEC-R001-S01-002). */
export interface ProjectOverview {
  projectId: ProjectId
  /** ISO time the overview was computed. */
  updatedAt: string
  /** Papers saved into the project library. */
  papers: ProjectOverviewCounter
  evidences: ProjectOverviewCounter
  /** Notes that are not soft-deleted. */
  notes: ProjectOverviewCounter
  /** Parsed documents of the project's saved papers. */
  documents: ProjectOverviewCounter
  datasets: ProjectOverviewCounter
  /** Sessions bound to this project. */
  sessions: ProjectOverviewCounter
  /** Tasks that are neither done nor dropped. */
  tasks: ProjectOverviewCounter
  analyses: ProjectOverviewCounter
  charts: ProjectOverviewCounter
}

/** Project lifecycle service (SPEC §32, SPEC-R001-S01-001..002). */
export interface MedProjectsService {
  /** Create the project record, its directory, and its `project.json`. */
  create(input: ProjectCreateInput): Promise<Project>
  /** List projects, including archived ones, newest first. */
  list(): Promise<Project[]>
  /** Read one project; `undefined` when it does not exist. */
  get(id: ProjectId): Promise<Project | undefined>
  /**
   * Apply a patch and return the updated project.
   * @param expectedVersion - `updatedAt` token of the caller's copy; a stale
   *   token fails with `PROJECT_VERSION_CONFLICT` and no partial write.
   */
  update(id: ProjectId, patch: ProjectPatch, expectedVersion?: string): Promise<Project>
  /** Delete a project and its owned records. */
  delete(id: ProjectId): Promise<void>
  /**
   * Make a project read-only and move it out of the active roster, keeping its
   * sessions, sources, and run history. Fails with `PROJECT_BUSY` while a
   * protected operation is still running.
   */
  archive(id: ProjectId): Promise<Project>
  /** Restore an archived project under the same identity. */
  restore(id: ProjectId): Promise<Project>
  /** Session bindings of one project, oldest first. */
  sessions(id: ProjectId): Promise<SessionProject[]>
  /**
   * Read one session's project binding.
   * @param sessionId - DSH session id.
   * @returns the binding, or `undefined` when the session has no project.
   */
  sessionProject(sessionId: string): Promise<SessionProject | undefined>
  /**
   * Bind a session to a project, replacing any previous binding, and audit the
   * selection. The client calls this when the user switches projects.
   * @param sessionId - DSH session id.
   * @param projectId - Project the session works on.
   */
  selectProject(sessionId: string, projectId: ProjectId): Promise<SessionProject>
  /** Counts shown on the project overview; per-domain availability. */
  overview(id: ProjectId): Promise<ProjectOverview>
  /** Save one already-fetched paper into the project library. */
  savePaper(id: ProjectId, paperId: PaperId): Promise<ProjectPaper>
  /**
   * Read the current session mode; defaults to research.
   * @param sessionId - DSH session id.
   * @returns the active or persisted mode.
   */
  getMode(sessionId: string): Promise<AgentMode>
  /**
   * Set and enforce the current session mode.
   * @param sessionId - DSH session id.
   * @param mode - Mode whose tool allowlist should be installed.
   * @returns the validated mode.
   */
  setMode(sessionId: string, mode: AgentMode): Promise<AgentMode>
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
  /** Deterministic filter decisions, in connector order. */
  filterTrace?: Array<{ paperId: PaperId; included: boolean; reasons: string[] }>
  /** Final ranking metadata; at most twenty entries. */
  ranking?: Array<{ paperId: PaperId; originalRank: number; score?: number; reason: string }>
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
  /** Approved plan revision; required together with researchQueryId for network calls. */
  researchQueryRevision?: number
}

/** Literature planning and search service (SPEC §9, §19). */
export interface MedLiteratureService {
  /**
   * Validate and persist the agent's proposed query plan. Issues no network
   * request, so nothing reaches PubMed before the user confirms (FR-2).
   */
  planQuery(input: PlanQueryInput): Promise<ResearchQuery>
  /** Update a stored plan before it is executed. */
  editQuery(id: ResearchQueryId, input: PlanQueryInput['plan'] & { filters?: ResearchQueryFilters }): Promise<ResearchQuery>
  /** Confirm the current plan revision for connector execution. */
  approveQuery(id: ResearchQueryId): Promise<ResearchQuery>
  /** Execute an approved counter-evidence query with independent provenance. */
  counterSearch(input: LiteratureSearchInput): Promise<LiteratureSearchResult>
  /** Execute an approved related-paper query with independent provenance. */
  relatedSearch(input: LiteratureSearchInput): Promise<LiteratureSearchResult>
  /** Execute one confirmed query against PubMed. */
  search(input: LiteratureSearchInput): Promise<LiteratureSearchResult>
  /** Read one paper by PMID from the connector. */
  getPaper(pmid: string): Promise<Paper | undefined>
  /** Papers already persisted in one project's search history or library. */
  listForProject(projectId: ProjectId): Promise<Paper[]>
  /** Remove one membership without deleting the underlying paper or sources. */
  unsave(projectId: ProjectId, paperId: PaperId): Promise<void>
}

/** Paper reading and full-text service (SPEC §31). */
export interface MedPapersService {
  /** Read one saved paper. */
  get(id: PaperId): Promise<Paper | undefined>
  /** Parsed documents of one paper. */
  document(id: PaperId): Promise<PaperDocument[]>
  /** Sections of one document, ordered. */
  sections(id: DocumentId): Promise<PaperSection[]>
  /**
   * Every paragraph of one document, in reading order. The reader page renders
   * a section's body, so it needs the document's paragraphs and not only the
   * single paragraph an evidence span points at.
   * @param id - document id.
   * @returns paragraphs ordered by section order, then paragraph order.
   */
  paragraphs(id: DocumentId): Promise<PaperParagraph[]>
  /** Read one paragraph by id. */
  paragraph(paragraphId: ParagraphId): Promise<PaperParagraph | undefined>
  /** Resolve a programmatically allowed full-text channel. */
  resolveFulltext(id: PaperId): Promise<FulltextResolution>
  /** Persist a user-uploaded paper. */
  upload(projectId: ProjectId, fileRef: string): Promise<Paper>
  /** Search paragraph text inside one paper. */
  search(id: PaperId, query: string): Promise<PaperParagraph[]>
  /** Render a source-faithful summary with explicit missing-field markers. */
  summary(input: { projectId: ProjectId; paperId: PaperId; documentId?: DocumentId; scope?: 'whole' | 'section'; mode: 'oneSentence' | 'threeMinute' | 'structured' }): Promise<PaperSummary>
  /** Validate a caller-provided translation without replacing the original. */
  translate(input: { documentId: DocumentId; paragraphIds?: ParagraphId[]; translatedText: string; targetLanguage: 'zh' | 'en' }): Promise<TranslationCheck>
  /** Create a note owned by the reader. */
  createNote(input: NoteCreateInput): Promise<Note>
  /** Update note body/title while retaining its anchor. */
  updateNote(id: NoteId, patch: { title?: string; content?: string }, expectedVersion?: number): Promise<Note>
  /** Soft-delete a note. */
  deleteNote(id: NoteId): Promise<void>
  /** Read one note. */
  getNote(id: NoteId): Promise<Note | undefined>
  /** List notes visible in a project or paper. */
  listNotes(input: { projectId: ProjectId; paperId?: PaperId }): Promise<Note[]>
  /** Create a highlight annotation. */
  createAnnotation(input: AnnotationCreateInput): Promise<Annotation>
  /** Delete a highlight annotation. */
  deleteAnnotation(id: AnnotationId): Promise<void>
  /** List annotations for a paper. */
  listAnnotations(projectId: ProjectId, paperId: PaperId): Promise<Annotation[]>
  /** Resolve an anchor for reader focus. */
  focus(anchor: SourceAnchor): Promise<{ status: 'FOUND' | 'STALE_ANCHOR'; paragraph?: PaperParagraph }>
}

/** Input for a reader note. */
export interface NoteCreateInput {
  projectId: ProjectId
  paperId?: PaperId
  scope: 'project' | 'paper' | 'selection'
  title: string
  content: string
  anchor?: SourceAnchor
}

/** Input for a reader highlight. */
export interface AnnotationCreateInput {
  projectId: ProjectId
  paperId: PaperId
  documentId: DocumentId
  paragraphId: ParagraphId
  startOffset: number
  endOffset: number
  color: 'yellow' | 'blue' | 'green' | 'pink'
}

/** Source-faithful summary result. */
/**
 * The structured summary fields a V1 paper summary must cover, in the order the
 * spec lists them. A field the source does not report is emitted as `未报告`
 * with `reported: false` instead of being omitted or inferred.
 */
export const PAPER_SUMMARY_FIELD_KEYS = [
  'researchQuestion',
  'studyDesign',
  'population',
  'sampleSize',
  'interventionExposure',
  'comparator',
  'outcome',
  'methods',
  'statistics',
  'keyResults',
  'effectSize',
  'conclusion',
  'limitations',
  'bias',
  'projectRelevance',
  'references',
] as const

/** One structured summary field with its source location. */
export type PaperSummaryFieldKey = (typeof PAPER_SUMMARY_FIELD_KEYS)[number]

/** One structured summary field. */
export interface PaperSummaryField {
  key: PaperSummaryFieldKey
  /** Dictionary key the client resolves for the field title. */
  titleKey: string
  value: string
  /** False when the source does not report this field; `value` is then the placeholder. */
  reported: boolean
  /** Exact stored location the value came from; required for an effect size. */
  anchor?: SourceAnchor
}

/** Paper summary projected from a parsed document. */
export interface PaperSummary {
  paperId: PaperId
  documentId?: DocumentId
  mode: 'oneSentence' | 'threeMinute' | 'structured'
  sections: Array<{ title: string; text: string; paragraphIds: ParagraphId[] }>
  /** The fields the requested mode covers; every field is present. */
  fields: PaperSummaryField[]
  /** Field keys reported as unavailable; a subset of `fields` with `reported: false`. */
  missingFields: string[]
}

/** Translation integrity result. */
export interface TranslationCheck {
  originalText: string
  translatedText: string
  targetLanguage: 'zh' | 'en'
  status: 'VALID' | 'TRANSLATION_MISMATCH'
  mismatches: string[]
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
   *
   * `relation` re-binds the evidence to the claim proposition, so a claim whose
   * text changes must be re-verified. An `UNCERTAIN` relation keeps the support
   * status at `PENDING`, never `VERIFIED`.
   */
  verify(id: EvidenceId, verdict: SupportStatus, options?: {
    relation?: EvidenceRelation
    reason?: string
    verificationVersion?: string
  }): Promise<Evidence>
  /**
   * Withdraw one evidence. Withdrawal is immediate: the record stops
   * qualifying and every dependent claim and draft must be invalidated.
   */
  withdraw(id: EvidenceId, reason?: string): Promise<Evidence>
  /** All evidence bound to one claim. */
  listForClaim(id: ClaimId): Promise<Evidence[]>
  /**
   * Every claim of one project, newest first. The evidence page groups its
   * cards by claim, so it needs the claims themselves and not only the
   * evidence hanging off one of them.
   * @param projectId - owning project.
   */
  listClaims(projectId: ProjectId): Promise<Claim[]>
  /** Create and gate a claim from currently stored evidence. */
  gateClaim(input: { projectId: ProjectId; researchQueryId: ResearchQueryId; text: string; evidenceIds: EvidenceId[]; counterEvidenceIds?: EvidenceId[] }): Promise<ClaimGateResult>
  /** Serialize the current claim evidence into deterministic citation entries. */
  serializeCitations(claimId: ClaimId): Promise<CitationMap>
  /** Compare selected evidence without aggregating unsupported effects. */
  compare(projectId: ProjectId, evidenceIds: EvidenceId[]): Promise<EvidenceComparison>
  /**
   * Chase a secondary citation to its original paper through a declared
   * connector. Every hop records parent/child source, status, and reason; a
   * visited set prevents cycles and `maxHops` bounds the walk. A successful
   * chase creates a NEW direct evidence and re-verifies it; the original
   * secondary record keeps its own locator status.
   */
  chase(input: ChaseInput): Promise<ChaseResult>
}

/** One reference hop of a Reference Chasing walk (SPEC §8 of S04). */
export interface ChaseInput {
  /** Secondary evidence whose reference is being chased. */
  evidenceId: EvidenceId
  /** Reference identifier as printed in the source (never invented). */
  reference: { doi?: string; pmid?: string; title?: string }
  /** Maximum hops for this walk; resolved from plugin Config when absent. */
  maxHops?: number
}

/** Outcome of one Reference Chasing walk. */
export interface ChaseResult {
  status: 'RESOLVED' | 'UNRESOLVED' | 'CHASE_LIMIT'
  /** The direct evidence created when the original paper was found. */
  evidence?: Evidence
  hops: ChaseHop[]
  reason?: string
}

/** One recorded hop of a Reference Chasing walk. */
export interface ChaseHop {
  source: string
  identifier: string
  status: 'RESOLVED' | 'UNRESOLVED' | 'SKIPPED_VISITED'
  reason: string
}

/** One claim gate outcome including the counts the UI must show (SPEC §12). */
export interface ClaimGateCounts {
  /** Distinct qualified SUPPORT evidence ids. */
  support: number
  /** Distinct qualified AGAINST evidence ids. */
  against: number
  /** Bound evidence still awaiting verification. */
  pending: number
  /** Bound evidence that is only a secondary citation. */
  secondary: number
}

/** Claim gate result. */
export interface ClaimGateResult {
  status: 'CONSISTENT' | 'INSUFFICIENT' | 'CONFLICTING'
  claim?: import('./research.ts').Claim
  reasons: string[]
  counts: ClaimGateCounts
}

/** Deterministic citation map entry. */
export interface CitationMap {
  revision: string
  entries: Array<{
    index: number
    evidenceId: EvidenceId
    paperId: PaperId
    pmid?: string
    doi?: string
    anchor?: SourceAnchor
  }>
}

/** One row of an Evidence comparison (SPEC §26). */
export interface EvidenceComparisonRow {
  evidence: Evidence
  paper: Paper | undefined
  quote: string
  /** Study design as reported by the source; empty when the source does not report it. */
  studyDesign?: string
  /** Outcome as reported by the source; empty when the source does not report it. */
  outcome?: string
  /** Effect as reported by the source; empty when the source does not report it. */
  effect?: string
  relation: EvidenceRelation
  sourceType: EvidenceSourceType
  locatorStatus: LocatorStatus
  supportStatus: SupportStatus
  status: string
  /** True when a withdrawal or unreadable source makes this record non-qualifying. */
  withdrawn: boolean
}

/** Evidence comparison projection. */
export interface EvidenceComparison {
  projectId: ProjectId
  rows: EvidenceComparisonRow[]
}

/** Dataset upload and profiling service (SPEC §33). */
export interface MedDatasetsService {
  /** Validate, hash, parse, profile, and persist one uploaded file. */
  upload(input: { projectId: ProjectId; fileRef: string }): Promise<Dataset>
  /** Re-read the stored profile of one dataset. */
  profile(id: DatasetId): Promise<Dataset | undefined>
  /** Column schema of one dataset. */
  schema(id: DatasetId): Promise<DatasetColumn[]>
  /** Return a bounded preview for the authenticated UI only. */
  preview(id: DatasetId, rows?: number): Promise<{ headers: string[]; rows: string[][] }>
  /** List project-scoped dataset profiles. */
  list(projectId: ProjectId): Promise<Dataset[]>
}

/** Statistics planning and execution service (SPEC §34–§35). */
export interface MedStatisticsService {
  /** Persist the agent-proposed plan as a `planned` run; never executes. */
  plan(input: { projectId: ProjectId; datasetId: DatasetId; question: string; plan: AnalysisPlan }): Promise<AnalysisRun>
  /** Persist generated code for a planned run; moves it to `waiting_approval`. */
  generateCode(id: AnalysisRun['id'], code: string): Promise<AnalysisRun>
  /** Approve the exact generated code and dataset/profile identity. */
  approveCode(id: AnalysisRun['id']): Promise<AnalysisRun>
  /** Execute approved code through the isolated runner. */
  execute(input: StatisticsRunInput & { analysisRunId: AnalysisRun['id'] }): Promise<StatisticsRunResult>
  /** Project-scoped immutable run history. */
  listRuns(projectId: ProjectId): Promise<AnalysisRun[]>
  /** Read one run for the authenticated client, with its input versions. */
  run(id: AnalysisRunId): Promise<AnalysisRun | undefined>
  /**
   * Chart artifacts published by one project's successful runs. A failed or
   * cancelled run contributes nothing, so the UI can never show a figure that
   * came from a run that did not succeed.
   */
  listCharts(projectId: ProjectId): Promise<Artifact[]>
  /** In-process read of one run; not part of the Remote surface. */
  peekRun(id: AnalysisRunId): AnalysisRun | undefined
}

/** Artifact lookup and export service (SPEC §38). */
export interface MedArtifactsService {
  /** Read one artifact record. */
  get(id: ArtifactId): Promise<Artifact | undefined>
  /** Export an artifact's bytes in the requested format. */
  export(id: ArtifactId, format: 'png' | 'svg' | 'csv' | 'json'): Promise<Uint8Array>
}

/**
 * Project task service (0917 图 1 的「当前任务」). Tasks are project records, not
 * the agent's per-turn todo list, so they outlive the session that created them.
 */
export interface MedTasksService {
  /** Create one task. */
  create(input: TaskCreateInput): Promise<Task>
  /**
   * List one project's tasks. Open work comes first, then priority, then the
   * nearest deadline — the order the project page's task list reads in.
   * @param projectId - owning project.
   * @param options - `includeClosed` also returns done and dropped tasks.
   */
  list(projectId: ProjectId, options?: { includeClosed?: boolean }): Promise<Task[]>
  /** Read one task. */
  get(id: TaskId): Promise<Task | undefined>
  /**
   * Apply a patch.
   * @param id - task id.
   * @param patch - fields to change; `dueAt: null` clears the deadline.
   */
  update(id: TaskId, patch: TaskPatch): Promise<Task>
  /** Delete one task. */
  remove(id: TaskId): Promise<void>
}

/** Project knowledge aggregation service (SPEC-R001-S06). */
export interface MedKnowledgeService {
  listPapers(input: { projectId: ProjectId; scope?: 'currentProject' | 'myLibrary' | 'uploaded'; query?: string }): Promise<Paper[]>
  /** Project ids that currently save one paper; an aggregate view shows these. */
  memberships(paperId: PaperId): Promise<string[]>
  search(input: { projectId: ProjectId; query: string; kinds?: Array<'paper' | 'evidence' | 'note' | 'draft'> }): Promise<KnowledgeSearchResult[]>
  createTag(projectId: ProjectId, name: string): Promise<Tag>
  renameTag(id: TagId, name: string): Promise<Tag>
  deleteTag(id: TagId): Promise<void>
  tag(entityType: 'paper' | 'evidence' | 'note' | 'draft', entityId: string, tagId: TagId): Promise<void>
  listTags(projectId: ProjectId): Promise<Tag[]>
  createDraft(input: { projectId: ProjectId; title: string; outline?: string[]; body?: string }): Promise<Draft>
  getDraft(id: DraftId): Promise<Draft | undefined>
  listDrafts(projectId: ProjectId): Promise<Draft[]>
  saveDraftRevision(input: { draftId: DraftId; outline: string[]; body: string; facts: import('./knowledge.ts').DraftFact[]; claimIds: string[]; evidenceIds: EvidenceId[]; expectedRevision?: number }): Promise<DraftRevision>
  /**
   * Return a Draft to `DRAFT`. The qualified states are produced by
   * evidence-backed writing validation, so a caller may only invalidate.
   */
  setDraftStatus(id: DraftId, status: 'DRAFT'): Promise<Draft>
  /**
   * Answer from the CURRENT Project corpus only. Results carry the corpus
   * version, candidate scores, and citations; no qualifying material produces
   * an explicit insufficiency instead of an invented answer, and a removed
   * membership can never be answered from a stale index.
   */
  rag(input: { projectId: ProjectId; query: string; maxCandidates?: number }): Promise<import('./knowledge.ts').ProjectRagAnswer>
}

/** Local skill catalog and installation service (SPEC-R001-S07). */
export interface MedSkillsService {
  catalog(query?: string): Promise<Skill[]>
  get(id: import('./ids.ts').SkillId): Promise<Skill | undefined>
  saveDraft(definition: SkillDefinition, expectedRevision?: number): Promise<Skill>
  validate(id: import('./ids.ts').SkillId): Promise<SkillVersion>
  test(id: import('./ids.ts').SkillId, input: unknown): Promise<SkillTestRun>
  publish(id: import('./ids.ts').SkillId): Promise<SkillVersion>
  install(input: { projectId: ProjectId; skillId: import('./ids.ts').SkillId; versionId: import('./ids.ts').SkillVersionId; enable?: boolean; permissions: string[] }): Promise<SkillInstallation>
  setEnabled(id: import('./ids.ts').SkillInstallationId, enabled: boolean): Promise<SkillInstallation>
  uninstall(id: import('./ids.ts').SkillInstallationId): Promise<void>
}

/** Evidence-backed writing service (SPEC-R001-S08). */
export interface MedWritingService {
  generate(input: { projectId: ProjectId; draftId: DraftId; evidenceIds: EvidenceId[]; outline: string[]; language: WritingLanguage }): Promise<WritingGeneration>
  validate(draftId: DraftId): Promise<WritingValidation>
  translate(input: { draftId: DraftId; sourceText: string; translatedText?: string; targetLanguage: WritingLanguage }): Promise<{ text: string; validation: WritingValidation }>
  export(input: { projectId: ProjectId; draftId?: DraftId; paperIds?: PaperId[]; format: 'ris' | 'bibtex' | 'markdown'; mode: 'complete' | 'preview' }): Promise<CitationExport>
}

/**
 * Shared shape of a selection-scoped action contribution (interfaces.md
 * §Reader, Note and Evidence). The Reader and the Draft editor both accept
 * additive contributions so a business package can attach behaviour without
 * the host importing it.
 */
export interface SelectionActionRequest {
  projectId: ProjectId
  /** Session that asked; opaque and DSH-owned. */
  sessionId?: string
  /** Paper the selection came from, absent for a Draft-editor request. */
  paperId?: PaperId
  documentId?: DocumentId
  /** Exact stored location of the selection, when one exists. */
  anchor?: SourceAnchor
  /** Verbatim selected text; the only text an action may treat as the input. */
  selectionText?: string
  /** Draft the request concerns, absent for a Reader request. */
  draftId?: DraftId
}

/** Result of invoking one selection-scoped action. */
export interface SelectionActionResult {
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  /** Opaque reference the UI resolves (EvidenceId, NoteId, exportId, ...). */
  reference?: string
  /** Localized-key reason, present for FAILED and CANCELLED. */
  message?: string
}

/**
 * One additive selection-scoped action. `id` is stable across versions because
 * a profile's required set is checked by id; `labelKey` is a dictionary key so
 * the contribution never hardcodes product copy.
 */
export interface SelectionAction {
  id: string
  order: number
  labelKey: string
  /** True when the action is meaningless without a non-empty selection. */
  requiresSelection: boolean
  invoke(request: SelectionActionRequest, signal?: AbortSignal): Promise<SelectionActionResult>
}

/**
 * Registry of selection-scoped actions (SPEC-R001-S03-004, SPEC-R001-S06-004).
 *
 * `register` returns the disposer, so a contribution disappears with its
 * plugin. `missing` reports the required ids a profile has not been given:
 * callers surface that as a dependency diagnostic instead of a disabled button,
 * because a V1 profile without the required contributions is not V1.
 */
export interface MedSelectionActionsService {
  /**
   * Add one contribution.
   * @returns the disposer that removes it.
   */
  register(action: SelectionAction): () => void
  /** Contributions applicable to one request, lowest `order` first. */
  list(request: SelectionActionRequest): SelectionAction[]
  /** Invoke one contribution by id. */
  invoke(id: string, request: SelectionActionRequest, signal?: AbortSignal): Promise<SelectionActionResult>
  /** Required action ids this registry is missing. */
  missing(): string[]
  /** Declare the ids a complete profile must provide. */
  require(ids: readonly string[]): () => void
}
