/**
 * Storage-domain declarations for every business table (SPEC §15–§16). One
 * domain groups the tables that change together, so a schema change bumps only
 * that group's version; DSH has no migration framework, so a stored version
 * that differs from the declaration rejects loudly at open (SPEC §15.2,
 * AGENTS.md §2.4).
 * @module @medresearch/dsh-medical-storage/src/domains
 */

import { defineDomain, domainTable, type DomainSpec } from '@deepseek-ai/dsh-storage-domain'
import * as contracts from '@medresearch/dsh-medical-contracts'

/** Initial format version of every domain declared here. */
export const MED_DOMAIN_VERSION = 1

/** Projects and their DSH session bindings. */
export const projectDomain = defineDomain({
  name: 'med_project',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_projects: domainTable<contracts.ProjectId, contracts.Project>(contracts.projectSchema),
    med_session_project: domainTable<string, contracts.SessionProject>(contracts.sessionProjectSchema),
  },
})

/** Persisted research queries and their generated plans. */
export const literatureDomain = defineDomain({
  name: 'med_literature',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_research_queries: domainTable<contracts.ResearchQueryId, contracts.ResearchQuery>(contracts.researchQuerySchema),
  },
})

/** Papers, their raw connector records, and project library membership. */
export const paperDomain = defineDomain({
  name: 'med_paper',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_papers: domainTable<contracts.PaperId, contracts.Paper>(contracts.paperSchema),
    med_paper_sources: domainTable<string, contracts.PaperSourceRecord>(contracts.paperSourceRecordSchema),
    med_project_papers: domainTable<string, contracts.ProjectPaper>(contracts.projectPaperSchema),
  },
})

/** Parsed documents and their section / paragraph / chunk structure. */
export const documentDomain = defineDomain({
  name: 'med_document',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_documents: domainTable<contracts.DocumentId, contracts.PaperDocument>(contracts.paperDocumentSchema),
    med_sections: domainTable<contracts.SectionId, contracts.PaperSection>(contracts.paperSectionSchema),
    med_paragraphs: domainTable<contracts.ParagraphId, contracts.PaperParagraph>(contracts.paperParagraphSchema),
    med_evidence_chunks: domainTable<contracts.EvidenceChunkId, contracts.EvidenceChunk>(contracts.evidenceChunkSchema),
  },
})

/** Evidence spans, claims, and their bindings. */
export const evidenceDomain = defineDomain({
  name: 'med_evidence',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_evidences: domainTable<contracts.EvidenceId, contracts.Evidence>(contracts.evidenceSchema),
    med_claims: domainTable<contracts.ClaimId, contracts.Claim>(contracts.claimSchema),
    med_claim_evidences: domainTable<string, contracts.ClaimEvidence>(contracts.claimEvidenceSchema),
  },
})

/** Datasets and their profiled columns. */
export const datasetDomain = defineDomain({
  name: 'med_dataset',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_datasets: domainTable<contracts.DatasetId, contracts.Dataset>(contracts.datasetSchema),
    med_dataset_columns: domainTable<string, contracts.DatasetColumn>(contracts.datasetColumnSchema),
  },
})

/** Analysis runs and the artifacts they produced. */
export const analysisDomain = defineDomain({
  name: 'med_analysis',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_analysis_runs: domainTable<contracts.AnalysisRunId, contracts.AnalysisRun>(contracts.analysisRunSchema),
    med_artifacts: domainTable<contracts.ArtifactId, contracts.Artifact>(contracts.artifactSchema),
  },
})

/** Append-only audit trail. */
export const auditDomain = defineDomain({
  name: 'med_audit',
  version: MED_DOMAIN_VERSION,
  tables: {
    med_audit_logs: domainTable<contracts.AuditLogId, contracts.AuditLog>(contracts.auditLogSchema),
  },
})

/** Every declared domain, in dependency order. */
export const medDomains = [
  projectDomain,
  literatureDomain,
  paperDomain,
  documentDomain,
  evidenceDomain,
  datasetDomain,
  analysisDomain,
  auditDomain,
] as const

/**
 * Look up a declared domain by name.
 * @param name - Domain name as it appears on the medium.
 * @returns the declaration, or `undefined` when no domain carries that name.
 */
export function medDomainByName(name: string): DomainSpec | undefined {
  return (medDomains as readonly DomainSpec[]).find(domain => domain.name === name)
}
