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
  ClaimId,
  Dataset,
  DatasetColumn,
  DatasetId,
  DocumentId,
  Evidence,
  EvidenceChunk,
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
  ProjectPaper,
  ProjectPatch,
  ResearchQuery,
  StatisticsRunInput,
  StatisticsRunResult,
  SupportStatus,
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
    update(id: ProjectId, patch: ProjectPatch, signal?: AbortSignal): Promise<Project>
    delete(id: ProjectId, signal?: AbortSignal): Promise<void>
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
  }
  readonly papers: {
    get(id: PaperId, signal?: AbortSignal): Promise<Paper | undefined>
    document(id: PaperId, signal?: AbortSignal): Promise<PaperDocument[]>
    sections(id: DocumentId, signal?: AbortSignal): Promise<PaperSection[]>
    paragraph(paragraphId: ParagraphId, signal?: AbortSignal): Promise<PaperParagraph | undefined>
    resolveFulltext(id: PaperId, signal?: AbortSignal): Promise<FulltextResolution>
    upload(projectId: ProjectId, fileRef: string, signal?: AbortSignal): Promise<Paper>
    search(id: PaperId, query: string, signal?: AbortSignal): Promise<PaperParagraph[]>
  }
  readonly evidence: {
    retrieve(input: EvidenceRetrieveInput, signal?: AbortSignal): Promise<EvidenceChunk[]>
    save(input: EvidenceSaveInput, signal?: AbortSignal): Promise<Evidence>
    verify(id: EvidenceId, verdict: SupportStatus, signal?: AbortSignal): Promise<Evidence>
    listForClaim(id: ClaimId, signal?: AbortSignal): Promise<Evidence[]>
  }
  readonly datasets: {
    upload(input: { projectId: ProjectId; fileRef: string }, signal?: AbortSignal): Promise<Dataset>
    profile(id: DatasetId, signal?: AbortSignal): Promise<Dataset | undefined>
    schema(id: DatasetId, signal?: AbortSignal): Promise<DatasetColumn[]>
  }
  readonly statistics: {
    plan(
      input: { projectId: ProjectId; datasetId: DatasetId; question: string; plan: AnalysisPlan },
      signal?: AbortSignal,
    ): Promise<AnalysisRun>
    generateCode(id: AnalysisRun['id'], code: string, signal?: AbortSignal): Promise<AnalysisRun>
    execute(input: StatisticsExecuteInput, signal?: AbortSignal): Promise<StatisticsRunResult>
  }
  readonly artifacts: {
    get(id: ArtifactId, signal?: AbortSignal): Promise<Artifact | undefined>
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
      update: (id, patch, signal) => invoke<Project>('medProjects/update', { id, patch }, signal),
      delete: (id, signal) => invoke<void>('medProjects/delete', { id }, signal),
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
    },
    papers: {
      get: (id, signal) => invoke<Paper | undefined>('medPapers/get', { id }, signal),
      document: (id, signal) => invoke<PaperDocument[]>('medPapers/document', { id }, signal),
      sections: (id, signal) => invoke<PaperSection[]>('medPapers/sections', { id }, signal),
      paragraph: (paragraphId, signal) => invoke<PaperParagraph | undefined>('medPapers/paragraph', { paragraphId }, signal),
      resolveFulltext: (id, signal) => invoke<FulltextResolution>('medPapers/resolveFulltext', { id }, signal),
      upload: (projectId, fileRef, signal) => invoke<Paper>('medPapers/upload', { projectId, fileRef }, signal),
      search: (id, query, signal) => invoke<PaperParagraph[]>('medPapers/search', { id, query }, signal),
    },
    evidence: {
      retrieve: (input, signal) => invoke<EvidenceChunk[]>('medEvidence/retrieve', { input }, signal),
      save: (input, signal) => invoke<Evidence>('medEvidence/save', { input }, signal),
      verify: (id, verdict, signal) => invoke<Evidence>('medEvidence/verify', { id, verdict }, signal),
      listForClaim: (id, signal) => invoke<Evidence[]>('medEvidence/listForClaim', { id }, signal),
    },
    datasets: {
      upload: (input, signal) => invoke<Dataset>('medDatasets/upload', { input }, signal),
      profile: (id, signal) => invoke<Dataset | undefined>('medDatasets/profile', { id }, signal),
      schema: (id, signal) => invoke<DatasetColumn[]>('medDatasets/schema', { id }, signal),
    },
    statistics: {
      plan: (input, signal) => invoke<AnalysisRun>('medStatistics/plan', { input }, signal),
      generateCode: (id, code, signal) => invoke<AnalysisRun>('medStatistics/generateCode', { id, code }, signal),
      execute: (input, signal) => invoke<StatisticsRunResult>('medStatistics/execute', { input }, signal),
    },
    artifacts: {
      get: (id, signal) => invoke<Artifact | undefined>('medArtifacts/get', { id }, signal),
    },
  }
}
