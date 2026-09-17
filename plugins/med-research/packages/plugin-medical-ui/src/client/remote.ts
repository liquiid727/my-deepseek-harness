/**
 * Browser-side Remote client for the nine `med` services (SPEC §30). The Web
 * layer never touches host storage directly: every call goes through the
 * connection RPC channel to a `@Remote` host method and unwraps the typed
 * success/error envelope. Components depend on this interface, so they can be
 * tested against a fake caller and later moved to generated `ctx.remote`
 * descriptors without touching view code.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/remote
 */

import type {
  AnalysisPlan,
  AgentMode,
  AnalysisRun,
  Artifact,
  ArtifactId,
  ChaseInput,
  ChaseResult,
  CitationMap,
  ClaimGateResult,
  ClaimId,
  Dataset,
  DatasetColumn,
  DatasetId,
  DocumentId,
  Evidence,
  EvidenceChunk,
  EvidenceComparison,
  EvidenceId,
  EvidenceRelation,
  EvidenceRetrieveInput,
  EvidenceSourceType,
  ExtractionProvenance,
  FulltextResolution,
  LiteratureSearchInput,
  LiteratureSearchResult,
  Paper,
  PaperDocument,
  PaperId,
  PaperParagraph,
  PaperSection,
  ParagraphId,
  PlanQueryInput,
  Project,
  ProjectCreateInput,
  ProjectId,
  ProjectOverview,
  ProjectRagAnswer,
  ProjectPaper,
  ProjectPatch,
  ResearchQuery,
  SessionProject,
  StatisticsRunInput,
  StatisticsRunResult,
  SupportStatus,
  Annotation,
  AnnotationId,
  Draft,
  DraftId,
  KnowledgeSearchResult,
  Note,
  PaperSummary,
  Skill,
  SkillId,
  SkillTestRun,
  SkillVersion,
  SourceAnchor,
  Tag,
  TranslationCheck,
  WritingGeneration,
  WritingValidation,
} from '@medresearch/dsh-medical-contracts'

/** Success or failure of one Remote invocation, as Connection reports it. */
export type RemoteCallResult =
  | { readonly ok: true; readonly value: unknown }
  | {
    readonly ok: false
    readonly error: { readonly code: string; readonly message: string; readonly details: object }
  }

/** The slice of `ctx.connection.rpc` this client needs; a fake satisfies it in tests. */
export interface RemoteCaller {
  /**
   * Call one endpoint on the shared API channel.
   * @param channel - absolute logical channel; this client always uses `/api`.
   * @param endpoint - `<namespace>/<method>` endpoint.
   * @param payload - channel-owned payload, always `{ args }` here.
   * @param signal - optional caller cancellation.
   * @returns the success/error envelope.
   */
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RemoteCallResult>
}

/** A Remote failure carried to the caller without losing its stable code. */
export class MedRemoteError extends Error {
  override readonly name = 'MedRemoteError'

  /**
   * @param code - Stable `<domain>/<reason>` code from the host.
   * @param message - Host diagnostic.
   * @param details - Code-specific detail object.
   */
  constructor(
    readonly code: string,
    message: string,
    readonly details: object,
  ) {
    super(message)
  }
}

/** Input of `medEvidence/save` (SPEC §25). */
export interface EvidenceSaveInput {
  projectId: ProjectId
  candidate: { paragraphId: ParagraphId; quote: string; relation: EvidenceRelation; reason: string }
  provenance: ExtractionProvenance
  sourceType?: EvidenceSourceType
}

/** Input of `medStatistics/execute` (SPEC §35). */
export type StatisticsExecuteInput = StatisticsRunInput & { analysisRunId: AnalysisRun['id'] }

/** Typed Remote surface of the med services, grouped by namespace. */
export interface MedRemote {
  readonly projects: {
    create(input: ProjectCreateInput, signal?: AbortSignal): Promise<Project>
    list(signal?: AbortSignal): Promise<Project[]>
    get(id: ProjectId, signal?: AbortSignal): Promise<Project | undefined>
    update(id: ProjectId, patch: ProjectPatch, expectedVersion?: string, signal?: AbortSignal): Promise<Project>
    delete(id: ProjectId, signal?: AbortSignal): Promise<void>
    archive(id: ProjectId, signal?: AbortSignal): Promise<Project>
    restore(id: ProjectId, signal?: AbortSignal): Promise<Project>
    sessions(id: ProjectId, signal?: AbortSignal): Promise<SessionProject[]>
    sessionProject(sessionId: string, signal?: AbortSignal): Promise<SessionProject | undefined>
    selectProject(sessionId: string, id: ProjectId, signal?: AbortSignal): Promise<SessionProject>
    overview(id: ProjectId, signal?: AbortSignal): Promise<ProjectOverview>
    savePaper(id: ProjectId, paperId: PaperId, signal?: AbortSignal): Promise<ProjectPaper>
    getMode(sessionId: string, signal?: AbortSignal): Promise<AgentMode>
    setMode(sessionId: string, mode: AgentMode, signal?: AbortSignal): Promise<AgentMode>
  }
  readonly literature: {
    planQuery(input: PlanQueryInput, signal?: AbortSignal): Promise<ResearchQuery>
    editQuery(id: ResearchQuery['id'], plan: PlanQueryInput['plan'] & { filters?: ResearchQuery['filters'] }, signal?: AbortSignal): Promise<ResearchQuery>
    approveQuery(id: ResearchQuery['id'], signal?: AbortSignal): Promise<ResearchQuery>
    counterSearch(input: LiteratureSearchInput, signal?: AbortSignal): Promise<LiteratureSearchResult>
    relatedSearch(input: LiteratureSearchInput, signal?: AbortSignal): Promise<LiteratureSearchResult>
    search(input: LiteratureSearchInput, signal?: AbortSignal): Promise<LiteratureSearchResult>
    getPaper(pmid: string, signal?: AbortSignal): Promise<Paper | undefined>
    listForProject(projectId: ProjectId, signal?: AbortSignal): Promise<Paper[]>
    unsave(projectId: ProjectId, paperId: PaperId, signal?: AbortSignal): Promise<void>
  }
  readonly papers: {
    get(id: PaperId, signal?: AbortSignal): Promise<Paper | undefined>
    document(id: PaperId, signal?: AbortSignal): Promise<PaperDocument[]>
    sections(id: DocumentId, signal?: AbortSignal): Promise<PaperSection[]>
    paragraph(paragraphId: ParagraphId, signal?: AbortSignal): Promise<PaperParagraph | undefined>
    resolveFulltext(id: PaperId, signal?: AbortSignal): Promise<FulltextResolution>
    upload(projectId: ProjectId, fileRef: string, signal?: AbortSignal): Promise<Paper>
    search(id: PaperId, query: string, signal?: AbortSignal): Promise<PaperParagraph[]>
    summary(input: { projectId: ProjectId; paperId: PaperId; documentId?: DocumentId; scope?: 'whole' | 'section'; mode: 'oneSentence' | 'threeMinute' | 'structured' }, signal?: AbortSignal): Promise<PaperSummary>
    translate(input: { documentId: DocumentId; paragraphIds?: ParagraphId[]; translatedText: string; targetLanguage: 'zh' | 'en' }, signal?: AbortSignal): Promise<TranslationCheck>
    createNote(input: { projectId: ProjectId; paperId?: PaperId; scope: 'project' | 'paper' | 'selection'; title: string; content: string; anchor?: SourceAnchor }, signal?: AbortSignal): Promise<Note>
    listNotes(input: { projectId: ProjectId; paperId?: PaperId }, signal?: AbortSignal): Promise<Note[]>
    createAnnotation(input: { projectId: ProjectId; paperId: PaperId; documentId: DocumentId; paragraphId: ParagraphId; startOffset: number; endOffset: number; color: 'yellow' | 'blue' | 'green' | 'pink' }, signal?: AbortSignal): Promise<Annotation>
    listAnnotations(projectId: ProjectId, paperId: PaperId, signal?: AbortSignal): Promise<Annotation[]>
    focus(anchor: SourceAnchor, signal?: AbortSignal): Promise<{ status: 'FOUND' | 'STALE_ANCHOR'; paragraph?: PaperParagraph }>
  }
  readonly evidence: {
    retrieve(input: EvidenceRetrieveInput, signal?: AbortSignal): Promise<EvidenceChunk[]>
    save(input: EvidenceSaveInput, signal?: AbortSignal): Promise<Evidence>
    verify(
      id: EvidenceId,
      verdict: SupportStatus,
      options?: { relation?: EvidenceRelation; reason?: string; verificationVersion?: string },
      signal?: AbortSignal,
    ): Promise<Evidence>
    withdraw(id: EvidenceId, reason?: string, signal?: AbortSignal): Promise<Evidence>
    listForClaim(id: ClaimId, signal?: AbortSignal): Promise<Evidence[]>
    gateClaim(input: { projectId: ProjectId; researchQueryId: ResearchQuery['id']; text: string; evidenceIds: EvidenceId[]; counterEvidenceIds?: EvidenceId[] }, signal?: AbortSignal): Promise<ClaimGateResult>
    serializeCitations(claimId: ClaimId, signal?: AbortSignal): Promise<CitationMap>
    compare(projectId: ProjectId, evidenceIds: EvidenceId[], signal?: AbortSignal): Promise<EvidenceComparison>
    chase(input: ChaseInput, signal?: AbortSignal): Promise<ChaseResult>
  }
  readonly datasets: {
    upload(input: { projectId: ProjectId; fileRef: string }, signal?: AbortSignal): Promise<Dataset>
    profile(id: DatasetId, signal?: AbortSignal): Promise<Dataset | undefined>
    schema(id: DatasetId, signal?: AbortSignal): Promise<DatasetColumn[]>
    preview(id: DatasetId, rows?: number, signal?: AbortSignal): Promise<{ headers: string[]; rows: string[][] }>
    list(projectId: ProjectId, signal?: AbortSignal): Promise<Dataset[]>
  }
  readonly statistics: {
    plan(
      input: { projectId: ProjectId; datasetId: DatasetId; question: string; plan: AnalysisPlan },
      signal?: AbortSignal,
    ): Promise<AnalysisRun>
    generateCode(id: AnalysisRun['id'], code: string, signal?: AbortSignal): Promise<AnalysisRun>
    approveCode(id: AnalysisRun['id'], signal?: AbortSignal): Promise<AnalysisRun>
    execute(input: StatisticsExecuteInput, signal?: AbortSignal): Promise<StatisticsRunResult>
    listRuns(projectId: ProjectId, signal?: AbortSignal): Promise<AnalysisRun[]>
    run(id: AnalysisRun['id'], signal?: AbortSignal): Promise<AnalysisRun | undefined>
    listCharts(projectId: ProjectId, signal?: AbortSignal): Promise<Artifact[]>
  }
  readonly artifacts: {
    get(id: ArtifactId, signal?: AbortSignal): Promise<Artifact | undefined>
  }
  readonly knowledge: {
    listPapers(input: { projectId: ProjectId; scope?: 'currentProject' | 'myLibrary' | 'uploaded'; query?: string }, signal?: AbortSignal): Promise<Paper[]>
    memberships(paperId: PaperId, signal?: AbortSignal): Promise<string[]>
    search(input: { projectId: ProjectId; query: string }, signal?: AbortSignal): Promise<KnowledgeSearchResult[]>
    rag(input: { projectId: ProjectId; query: string; maxCandidates?: number }, signal?: AbortSignal): Promise<ProjectRagAnswer>
    listTags(projectId: ProjectId, signal?: AbortSignal): Promise<Tag[]>
    createDraft(input: { projectId: ProjectId; title: string }, signal?: AbortSignal): Promise<Draft>
    getDraft(id: DraftId, signal?: AbortSignal): Promise<Draft | undefined>
    listDrafts(projectId: ProjectId, signal?: AbortSignal): Promise<Draft[]>
    setDraftStatus(id: DraftId, status: 'DRAFT', signal?: AbortSignal): Promise<Draft>
  }
  readonly skills: {
    catalog(query?: string, signal?: AbortSignal): Promise<Skill[]>
    get(id: SkillId, signal?: AbortSignal): Promise<Skill | undefined>
    test(id: SkillId, input: unknown, signal?: AbortSignal): Promise<SkillTestRun>
    validate(id: SkillId, signal?: AbortSignal): Promise<SkillVersion>
  }
  readonly writing: {
    generate(input: { projectId: ProjectId; draftId: DraftId; evidenceIds: EvidenceId[]; outline: string[]; language: 'zh' | 'en' }, signal?: AbortSignal): Promise<WritingGeneration>
    validate(draftId: DraftId, signal?: AbortSignal): Promise<WritingValidation>
  }
}

/** Shared API channel every med Remote call uses. */
const CHANNEL = '/api'

/**
 * Build the typed med Remote client over one Connection caller.
 * @param caller - `ctx.connection.rpc` (or a test fake with the same contract).
 * @returns the grouped typed surface.
 */
export function createMedRemote(caller: RemoteCaller): MedRemote {
  /**
   * Invoke one endpoint and unwrap the envelope.
   * @param endpoint - `<namespace>/<method>` endpoint.
   * @param args - named wire arguments matching the host method parameters.
   * @param signal - optional caller cancellation.
   * @returns the host value.
   * @throws MedRemoteError carrying the host code when the call failed.
   */
  const invoke = async <T>(endpoint: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
    const result = await caller.call(CHANNEL, endpoint, { args }, signal)
    if (result.ok) return result.value as T
    throw new MedRemoteError(result.error.code, result.error.message, result.error.details)
  }

  return {
    projects: {
      create: (input, signal) => invoke<Project>('medProjects/create', { input }, signal),
      list: signal => invoke<Project[]>('medProjects/list', {}, signal),
      get: (id, signal) => invoke<Project | undefined>('medProjects/get', { id }, signal),
      update: (id, patch, expectedVersion, signal) =>
        invoke<Project>('medProjects/update', expectedVersion === undefined ? { id, patch } : { id, patch, expectedVersion }, signal),
      delete: (id, signal) => invoke<void>('medProjects/delete', { id }, signal),
      archive: (id, signal) => invoke<Project>('medProjects/archive', { id }, signal),
      restore: (id, signal) => invoke<Project>('medProjects/restore', { id }, signal),
      sessions: (id, signal) => invoke<SessionProject[]>('medProjects/sessions', { id }, signal),
      sessionProject: (sessionId, signal) => invoke<SessionProject | undefined>('medProjects/sessionProject', { sessionId }, signal),
      selectProject: (sessionId, id, signal) => invoke<SessionProject>('medProjects/selectProject', { sessionId, projectId: id }, signal),
      overview: (id, signal) => invoke<ProjectOverview>('medProjects/overview', { id }, signal),
      savePaper: (id, paperId, signal) => invoke<ProjectPaper>('medProjects/savePaper', { id, paperId }, signal),
      getMode: (sessionId, signal) => invoke<AgentMode>('medProjects/getMode', { sessionId }, signal),
      setMode: (sessionId, mode, signal) => invoke<AgentMode>('medProjects/setMode', { sessionId, mode }, signal),
    },
    literature: {
      planQuery: (input, signal) => invoke<ResearchQuery>('medLiterature/planQuery', { input }, signal),
      editQuery: (id, plan, signal) => invoke<ResearchQuery>('medLiterature/editQuery', { id, input: plan }, signal),
      approveQuery: (id, signal) => invoke<ResearchQuery>('medLiterature/approveQuery', { id }, signal),
      counterSearch: (input, signal) => invoke<LiteratureSearchResult>('medLiterature/counterSearch', { input }, signal),
      relatedSearch: (input, signal) => invoke<LiteratureSearchResult>('medLiterature/relatedSearch', { input }, signal),
      search: (input, signal) => invoke<LiteratureSearchResult>('medLiterature/search', { input }, signal),
      getPaper: (pmid, signal) => invoke<Paper | undefined>('medLiterature/getPaper', { pmid }, signal),
      listForProject: (projectId, signal) => invoke<Paper[]>('medLiterature/listForProject', { projectId }, signal),
      unsave: (projectId, paperId, signal) => invoke<void>('medLiterature/unsave', { projectId, paperId }, signal),
    },
    papers: {
      get: (id, signal) => invoke<Paper | undefined>('medPapers/get', { id }, signal),
      document: (id, signal) => invoke<PaperDocument[]>('medPapers/document', { id }, signal),
      sections: (id, signal) => invoke<PaperSection[]>('medPapers/sections', { id }, signal),
      paragraph: (paragraphId, signal) => invoke<PaperParagraph | undefined>('medPapers/paragraph', { paragraphId }, signal),
      resolveFulltext: (id, signal) => invoke<FulltextResolution>('medPapers/resolveFulltext', { id }, signal),
      upload: (projectId, fileRef, signal) => invoke<Paper>('medPapers/upload', { projectId, fileRef }, signal),
      search: (id, query, signal) => invoke<PaperParagraph[]>('medPapers/search', { id, query }, signal),
      summary: (input, signal) => invoke<PaperSummary>('medPapers/summary', { input }, signal),
      translate: (input, signal) => invoke<TranslationCheck>('medPapers/translate', { input }, signal),
      createNote: (input, signal) => invoke<Note>('medPapers/createNote', { input }, signal),
      listNotes: (input, signal) => invoke<Note[]>('medPapers/listNotes', { input }, signal),
      createAnnotation: (input, signal) => invoke<Annotation>('medPapers/createAnnotation', { input }, signal),
      listAnnotations: (projectId, paperId, signal) => invoke<Annotation[]>('medPapers/listAnnotations', { projectId, paperId }, signal),
      focus: (anchor, signal) => invoke<{ status: 'FOUND' | 'STALE_ANCHOR'; paragraph?: PaperParagraph }>('medPapers/focus', { anchor }, signal),
    },
    evidence: {
      retrieve: (input, signal) => invoke<EvidenceChunk[]>('medEvidence/retrieve', { input }, signal),
      save: (input, signal) => invoke<Evidence>('medEvidence/save', { input }, signal),
      verify: (id, verdict, options, signal) => invoke<Evidence>(
        'medEvidence/verify',
        options === undefined ? { id, verdict } : { id, verdict, options },
        signal,
      ),
      withdraw: (id, reason, signal) => invoke<Evidence>(
        'medEvidence/withdraw',
        reason === undefined ? { id } : { id, reason },
        signal,
      ),
      listForClaim: (id, signal) => invoke<Evidence[]>('medEvidence/listForClaim', { id }, signal),
      gateClaim: (input, signal) => invoke<ClaimGateResult>('medEvidence/gateClaim', { input }, signal),
      serializeCitations: (claimId, signal) => invoke<CitationMap>('medEvidence/serializeCitations', { claimId }, signal),
      compare: (projectId, evidenceIds, signal) => invoke<EvidenceComparison>('medEvidence/compare', { projectId, evidenceIds }, signal),
      chase: (input, signal) => invoke<ChaseResult>('medEvidence/chase', { input }, signal),
    },
    datasets: {
      upload: (input, signal) => invoke<Dataset>('medDatasets/upload', { input }, signal),
      profile: (id, signal) => invoke<Dataset | undefined>('medDatasets/profile', { id }, signal),
      schema: (id, signal) => invoke<DatasetColumn[]>('medDatasets/schema', { id }, signal),
      preview: (id, rows, signal) => invoke<{ headers: string[]; rows: string[][] }>('medDatasets/preview', rows === undefined ? { id } : { id, rows }, signal),
      list: (projectId, signal) => invoke<Dataset[]>('medDatasets/list', { projectId }, signal),
    },
    statistics: {
      plan: (input, signal) => invoke<AnalysisRun>('medStatistics/plan', { input }, signal),
      generateCode: (id, code, signal) => invoke<AnalysisRun>('medStatistics/generateCode', { id, code }, signal),
      approveCode: (id, signal) => invoke<AnalysisRun>('medStatistics/approveCode', { id }, signal),
      execute: (input, signal) => invoke<StatisticsRunResult>('medStatistics/execute', { input }, signal),
      listRuns: (projectId, signal) => invoke<AnalysisRun[]>('medStatistics/listRuns', { projectId }, signal),
      run: (id, signal) => invoke<AnalysisRun | undefined>('medStatistics/run', { id }, signal),
      listCharts: (projectId, signal) => invoke<Artifact[]>('medStatistics/listCharts', { projectId }, signal),
    },
    artifacts: {
      get: (id, signal) => invoke<Artifact | undefined>('medArtifacts/get', { id }, signal),
    },
    knowledge: {
      listPapers: (input, signal) => invoke<Paper[]>('medKnowledge/listPapers', { input }, signal),
      memberships: (paperId, signal) => invoke<string[]>('medKnowledge/memberships', { paperId }, signal),
      search: (input, signal) => invoke<KnowledgeSearchResult[]>('medKnowledge/search', { input }, signal),
      rag: (input, signal) => invoke<ProjectRagAnswer>('medKnowledge/rag', { input }, signal),
      listTags: (projectId, signal) => invoke<Tag[]>('medKnowledge/listTags', { projectId }, signal),
      createDraft: (input, signal) => invoke<Draft>('medKnowledge/createDraft', { input }, signal),
      getDraft: (id, signal) => invoke<Draft | undefined>('medKnowledge/getDraft', { id }, signal),
      listDrafts: (projectId, signal) => invoke<Draft[]>('medKnowledge/listDrafts', { projectId }, signal),
      setDraftStatus: (id, status, signal) => invoke<Draft>('medKnowledge/setDraftStatus', { id, status }, signal),
    },
    skills: {
      catalog: (query, signal) => invoke<Skill[]>('medSkills/catalog', query === undefined ? {} : { query }, signal),
      get: (id, signal) => invoke<Skill | undefined>('medSkills/get', { id }, signal),
      test: (id, input, signal) => invoke<SkillTestRun>('medSkills/test', { id, input }, signal),
      validate: (id, signal) => invoke<SkillVersion>('medSkills/validate', { id }, signal),
    },
    writing: {
      generate: (input, signal) => invoke<WritingGeneration>('medWriting/generate', { input }, signal),
      validate: (draftId, signal) => invoke<WritingValidation>('medWriting/validate', { draftId }, signal),
    },
  }
}
