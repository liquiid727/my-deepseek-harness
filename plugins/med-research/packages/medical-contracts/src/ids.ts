/**
 * Branded identifier vocabulary. Every opaque record key that crosses a
 * package boundary is branded so a raw `string` cannot stand in for it
 * (AGENTS.md §4). The values stay plain strings on the medium and on the wire;
 * the brand exists only in the type system.
 * @module @medresearch/dsh-medical-contracts/src/ids
 */

import { z } from 'zod'

/** Identifier of a `med_projects` record. */
export const projectIdSchema = z.string().min(1).brand<'ProjectId'>()
/** Identifier of a `med_projects` record. */
export type ProjectId = z.infer<typeof projectIdSchema>

/** Identifier of a `med_papers` record. */
export const paperIdSchema = z.string().min(1).brand<'PaperId'>()
/** Identifier of a `med_papers` record. */
export type PaperId = z.infer<typeof paperIdSchema>

/** Identifier of a `med_documents` record. */
export const documentIdSchema = z.string().min(1).brand<'DocumentId'>()
/** Identifier of a `med_documents` record. */
export type DocumentId = z.infer<typeof documentIdSchema>

/** Identifier of a `med_sections` record. */
export const sectionIdSchema = z.string().min(1).brand<'SectionId'>()
/** Identifier of a `med_sections` record. */
export type SectionId = z.infer<typeof sectionIdSchema>

/** Identifier of a `med_paragraphs` record. */
export const paragraphIdSchema = z.string().min(1).brand<'ParagraphId'>()
/** Identifier of a `med_paragraphs` record. */
export type ParagraphId = z.infer<typeof paragraphIdSchema>

/** Identifier of a `med_evidence_chunks` record. */
export const evidenceChunkIdSchema = z.string().min(1).brand<'EvidenceChunkId'>()
/** Identifier of a `med_evidence_chunks` record. */
export type EvidenceChunkId = z.infer<typeof evidenceChunkIdSchema>

/** Identifier of a `med_evidences` record. */
export const evidenceIdSchema = z.string().min(1).brand<'EvidenceId'>()
/** Identifier of a `med_evidences` record. */
export type EvidenceId = z.infer<typeof evidenceIdSchema>

/** Identifier of a `med_claims` record. */
export const claimIdSchema = z.string().min(1).brand<'ClaimId'>()
/** Identifier of a `med_claims` record. */
export type ClaimId = z.infer<typeof claimIdSchema>

/** Identifier of one research query within a project. */
export const researchQueryIdSchema = z.string().min(1).brand<'ResearchQueryId'>()
/** Identifier of one research query within a project. */
export type ResearchQueryId = z.infer<typeof researchQueryIdSchema>

/** Identifier of a `med_datasets` record. */
export const datasetIdSchema = z.string().min(1).brand<'DatasetId'>()
/** Identifier of a `med_datasets` record. */
export type DatasetId = z.infer<typeof datasetIdSchema>

/** Identifier of a `med_analysis_runs` record. */
export const analysisRunIdSchema = z.string().min(1).brand<'AnalysisRunId'>()
/** Identifier of a `med_analysis_runs` record. */
export type AnalysisRunId = z.infer<typeof analysisRunIdSchema>

/** Identifier of a `med_artifacts` record. */
export const artifactIdSchema = z.string().min(1).brand<'ArtifactId'>()
/** Identifier of a `med_artifacts` record. */
export type ArtifactId = z.infer<typeof artifactIdSchema>

/** Identifier of a `med_audit_logs` record. */
export const auditLogIdSchema = z.string().min(1).brand<'AuditLogId'>()
/** Identifier of a `med_audit_logs` record. */
export type AuditLogId = z.infer<typeof auditLogIdSchema>

/** Identifier of a reader note. */
export const noteIdSchema = z.string().min(1).brand<'NoteId'>()
/** Identifier of a reader note. */
export type NoteId = z.infer<typeof noteIdSchema>

/** Identifier of a reader highlight annotation. */
export const annotationIdSchema = z.string().min(1).brand<'AnnotationId'>()
/** Identifier of a reader highlight annotation. */
export type AnnotationId = z.infer<typeof annotationIdSchema>

/** Identifier of a project tag. */
export const tagIdSchema = z.string().min(1).brand<'TagId'>()
/** Identifier of a project tag. */
export type TagId = z.infer<typeof tagIdSchema>

/** Identifier of a writing draft. */
export const draftIdSchema = z.string().min(1).brand<'DraftId'>()
/** Identifier of a writing draft. */
export type DraftId = z.infer<typeof draftIdSchema>

/** Identifier of one immutable draft revision. */
export const draftRevisionIdSchema = z.string().min(1).brand<'DraftRevisionId'>()
/** Identifier of one immutable draft revision. */
export type DraftRevisionId = z.infer<typeof draftRevisionIdSchema>

/** Identifier of a skill definition. */
export const skillIdSchema = z.string().min(1).brand<'SkillId'>()
/** Identifier of a skill definition. */
export type SkillId = z.infer<typeof skillIdSchema>

/** Identifier of an immutable skill version. */
export const skillVersionIdSchema = z.string().min(1).brand<'SkillVersionId'>()
/** Identifier of an immutable skill version. */
export type SkillVersionId = z.infer<typeof skillVersionIdSchema>

/** Identifier of a controlled skill test run. */
export const skillTestRunIdSchema = z.string().min(1).brand<'SkillTestRunId'>()
/** Identifier of a controlled skill test run. */
export type SkillTestRunId = z.infer<typeof skillTestRunIdSchema>

/** Identifier of a workspace skill installation. */
export const skillInstallationIdSchema = z.string().min(1).brand<'SkillInstallationId'>()
/** Identifier of a workspace skill installation. */
export type SkillInstallationId = z.infer<typeof skillInstallationIdSchema>
