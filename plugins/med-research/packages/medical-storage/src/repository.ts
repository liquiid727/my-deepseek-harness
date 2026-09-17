/**
 * Open handle over every Med Research domain. `openMedStorage` opens all
 * declared domains through the DSH storage-domain facility and returns typed
 * table handles plus a generic view used by export/import. Opening is
 * all-or-nothing: a failure closes whatever already opened and rethrows, so a
 * caller never holds a half-mounted storage layer.
 *
 * One facility owns one domain set for the process: the med plugins each hold a
 * handle, and a second open of the same domains would fail with `already open`.
 * The handle is therefore reference-counted per facility — the first caller
 * opens, later callers share the same tables through their own idempotent
 * `close()`, and the last close releases the domains.
 * @module @medresearch/dsh-medical-storage/src/repository
 */

import type { Domain, DomainFacility, DomainSpec, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type * as contracts from '@medresearch/dsh-medical-contracts'
import {
  analysisDomain,
  auditDomain,
  datasetDomain,
  documentDomain,
  evidenceDomain,
  knowledgeDomain,
  literatureDomain,
  paperDomain,
  projectDomain,
  skillsDomain,
} from './domains.ts'

/**
 * Generic view of one opened domain. Business code uses the typed handles on
 * {@link MedStorage}; this view exists so export/import can walk every table
 * without a per-domain switch.
 */
export interface OpenedDomain {
  /** Domain name on the medium. */
  readonly name: string
  /** Declared table names, in declaration order. */
  readonly tables: readonly string[]
  /**
   * Snapshot of one table as `key → record`.
   * @param table - Declared table name.
   * @returns the snapshot map.
   */
  snapshot(table: string): ReadonlyMap<string, unknown>
  /**
   * Insert or overwrite one record; the caller has already validated it.
   * @param table - Declared table name.
   * @param key - Record key.
   * @param value - Validated record.
   * @returns resolution after durability.
   */
  put(table: string, key: string, value: unknown): Promise<void>
}

/** Typed handles plus the generic view over one project's storage. */
export interface MedStorage {
  /** Projects. */
  readonly projects: KvTable<contracts.ProjectId, contracts.Project>
  /** DSH session → project bindings. */
  readonly sessionProjects: KvTable<string, contracts.SessionProject>
  /** Persisted research queries and their plans. */
  readonly researchQueries: KvTable<contracts.ResearchQueryId, contracts.ResearchQuery>
  /** Papers. */
  readonly papers: KvTable<contracts.PaperId, contracts.Paper>
  /** Raw connector records. */
  readonly paperSources: KvTable<string, contracts.PaperSourceRecord>
  /** Project library membership. */
  readonly projectPapers: KvTable<string, contracts.ProjectPaper>
  /** Parsed documents. */
  readonly documents: KvTable<contracts.DocumentId, contracts.PaperDocument>
  /** Document sections. */
  readonly sections: KvTable<contracts.SectionId, contracts.PaperSection>
  /** Document paragraphs. */
  readonly paragraphs: KvTable<contracts.ParagraphId, contracts.PaperParagraph>
  /** Retrieval chunks. */
  readonly chunks: KvTable<contracts.EvidenceChunkId, contracts.EvidenceChunk>
  /** Evidence spans. */
  readonly evidences: KvTable<contracts.EvidenceId, contracts.Evidence>
  /** Claims. */
  readonly claims: KvTable<contracts.ClaimId, contracts.Claim>
  /** Claim ↔ evidence bindings. */
  readonly claimEvidences: KvTable<string, contracts.ClaimEvidence>
  /** Datasets. */
  readonly datasets: KvTable<contracts.DatasetId, contracts.Dataset>
  /** Profiled dataset columns. */
  readonly datasetColumns: KvTable<string, contracts.DatasetColumn>
  /** Analysis runs. */
  readonly analysisRuns: KvTable<contracts.AnalysisRunId, contracts.AnalysisRun>
  /** Artifacts. */
  readonly artifacts: KvTable<contracts.ArtifactId, contracts.Artifact>
  /** Audit rows. */
  readonly auditLogs: KvTable<contracts.AuditLogId, contracts.AuditLog>
  /** Reader notes. */
  readonly notes: KvTable<contracts.NoteId, contracts.Note>
  /** Reader highlights. */
  readonly annotations: KvTable<contracts.AnnotationId, contracts.Annotation>
  /** Project tags. */
  readonly tags: KvTable<contracts.TagId, contracts.Tag>
  /** Tag relationships. */
  readonly tagLinks: KvTable<string, contracts.TagLink>
  /** Current writing drafts. */
  readonly drafts: KvTable<contracts.DraftId, contracts.Draft>
  /** Immutable draft revisions. */
  readonly draftRevisions: KvTable<contracts.DraftRevisionId, contracts.DraftRevision>
  /** Skill identities. */
  readonly skills: KvTable<contracts.SkillId, contracts.Skill>
  /** Immutable skill versions. */
  readonly skillVersions: KvTable<contracts.SkillVersionId, contracts.SkillVersion>
  /** Controlled skill test history. */
  readonly skillTests: KvTable<contracts.SkillTestRunId, contracts.SkillTestRun>
  /** Workspace skill installations. */
  readonly skillInstallations: KvTable<contracts.SkillInstallationId, contracts.SkillInstallation>
  /** Every opened domain, keyed by domain name. */
  readonly opened: ReadonlyMap<string, OpenedDomain>
  /**
   * Close every domain, draining queued writes. Idempotent.
   * @returns resolution after all units are released.
   */
  close(): Promise<void>
}

/** Narrow a typed domain to its raw table view without changing the handle. */
function rawTable<S extends DomainSpec>(domain: Domain<S>, table: string): KvTable<string, unknown> {
  return domain.table(table as keyof S['tables'] & string) as KvTable<string, unknown>
}

/** Build the generic view for one opened domain. */
function openedView<S extends DomainSpec>(spec: S, domain: Domain<S>): OpenedDomain {
  const tables = Object.keys(spec.tables)
  return {
    name: spec.name,
    tables,
    snapshot(table) {
      const entries = rawTable(domain, table).entries()
      return new Map(entries)
    },
    put(table, key, value) {
      return rawTable(domain, table).put(key, value)
    },
  }
}

/** One facility's opened domain set and the release that closes it. */
interface SharedDomains {
  readonly storage: MedStorage
  /** Close every domain in reverse open order; called only at reference zero. */
  release(): Promise<void>
}

/** One facility's single-flight open and its live handle count. */
interface SharedStorage {
  /** Resolves once every domain is open; every concurrent caller awaits the same promise. */
  readonly opening: Promise<SharedDomains>
  references: number
}

/** Process-wide shared handles: one domain set per facility. */
const sharedStorages = new WeakMap<DomainFacility, SharedStorage>()

/**
 * Wrap one shared domain set as an independent handle with its own idempotent
 * `close()`; the domains are released when the last handle closes.
 * @param facility - key of the shared entry.
 * @param entry - the shared entry being held.
 * @param domains - the opened domain set.
 * @returns a handle whose tables are the shared ones.
 */
function storageHandle(facility: DomainFacility, entry: SharedStorage, domains: SharedDomains): MedStorage {
  let closed = false
  return {
    ...domains.storage,
    async close() {
      if (closed) return
      closed = true
      entry.references -= 1
      if (entry.references > 0) return
      sharedStorages.delete(facility)
      await domains.release()
    },
  }
}

/**
 * Open all declared domains through the facility. All-or-nothing: a failure closes
 * whatever already opened and rethrows unchanged.
 * @param facility - The mounted `ctx.storageDomain` facility.
 * @returns the shared domain set.
 */
async function openSharedDomains(facility: DomainFacility): Promise<SharedDomains> {
  const opened: Array<{ readonly name: string; readonly domain: { close(): Promise<void> } }> = []
  const open = async <S extends DomainSpec>(spec: S): Promise<{ domain: Domain<S>; view: OpenedDomain }> => {
    const domain = await facility.open(spec)
    opened.push({ name: spec.name, domain })
    return { domain, view: openedView(spec, domain) }
  }

  try {
    const project = await open(projectDomain)
    const literature = await open(literatureDomain)
    const paper = await open(paperDomain)
    const document = await open(documentDomain)
    const evidence = await open(evidenceDomain)
    const dataset = await open(datasetDomain)
    const analysis = await open(analysisDomain)
    const audit = await open(auditDomain)
    const knowledge = await open(knowledgeDomain)
    const skills = await open(skillsDomain)

    const views = [project, literature, paper, document, evidence, dataset, analysis, audit, knowledge, skills]
    return {
      async release() {
        for (const entry of [...opened].reverse()) await entry.domain.close()
      },
      storage: {
        projects: project.domain.table('med_projects'),
        sessionProjects: project.domain.table('med_session_project'),
        researchQueries: literature.domain.table('med_research_queries'),
        papers: paper.domain.table('med_papers'),
        paperSources: paper.domain.table('med_paper_sources'),
        projectPapers: paper.domain.table('med_project_papers'),
        documents: document.domain.table('med_documents'),
        sections: document.domain.table('med_sections'),
        paragraphs: document.domain.table('med_paragraphs'),
        chunks: document.domain.table('med_evidence_chunks'),
        evidences: evidence.domain.table('med_evidences'),
        claims: evidence.domain.table('med_claims'),
        claimEvidences: evidence.domain.table('med_claim_evidences'),
        datasets: dataset.domain.table('med_datasets'),
        datasetColumns: dataset.domain.table('med_dataset_columns'),
        analysisRuns: analysis.domain.table('med_analysis_runs'),
        artifacts: analysis.domain.table('med_artifacts'),
        auditLogs: audit.domain.table('med_audit_logs'),
        notes: knowledge.domain.table('med_notes'),
        annotations: knowledge.domain.table('med_annotations'),
        tags: knowledge.domain.table('med_tags'),
        tagLinks: knowledge.domain.table('med_tag_links'),
        drafts: knowledge.domain.table('med_drafts'),
        draftRevisions: knowledge.domain.table('med_draft_revisions'),
        skills: skills.domain.table('med_skills'),
        skillVersions: skills.domain.table('med_skill_versions'),
        skillTests: skills.domain.table('med_skill_tests'),
        skillInstallations: skills.domain.table('med_skill_installations'),
        opened: new Map(views.map(({ view }): [string, OpenedDomain] => [view.name, view])),
        // Replaced by every handle wrapper; the shared object is never handed out.
        async close() {},
      },
    }
  } catch (error) {
    await Promise.allSettled(opened.map(entry => entry.domain.close()))
    throw error
  }
}

/**
 * Open every Med Research domain through the storage-domain facility. One
 * facility owns one domain set for the process: concurrent callers await the
 * same open, and the domains close when the last returned handle closes.
 * @param facility - The mounted `ctx.storageDomain` facility.
 * @returns typed handles, the generic view, and a `close()` that drains and
 * releases the domains once the last holder closes.
 * @throws whatever the facility throws (for example `StorageError` with
 * `version-mismatch`); already-opened domains are closed first, and the error
 * is rethrown unchanged so it is never masked.
 */
export async function openMedStorage(facility: DomainFacility): Promise<MedStorage> {
  let entry = sharedStorages.get(facility)
  if (entry === undefined) {
    const created: SharedStorage = { opening: openSharedDomains(facility), references: 0 }
    sharedStorages.set(facility, created)
    // A rejected open must not poison the facility for later callers.
    created.opening.catch(() => {
      if (sharedStorages.get(facility) === created) sharedStorages.delete(facility)
    })
    entry = created
  }
  entry.references += 1
  let domains: SharedDomains
  try {
    domains = await entry.opening
  } catch (error) {
    entry.references -= 1
    throw error
  }
  return storageHandle(facility, entry, domains)
}
