/** Persisted notes, annotations, tags, and writing drafts (SPEC-R001-S03/S06). */

import { z } from 'zod'
import {
  annotationIdSchema,
  draftIdSchema,
  draftRevisionIdSchema,
  documentIdSchema,
  evidenceIdSchema,
  noteIdSchema,
  paperIdSchema,
  paragraphIdSchema,
  projectIdSchema,
  tagIdSchema,
} from './ids.ts'

/** Normalized source location used by reader, evidence, and writing surfaces. */
export const sourceAnchorSchema = z.strictObject({
  projectId: projectIdSchema,
  paperId: paperIdSchema,
  documentId: documentIdSchema.optional(),
  paragraphId: paragraphIdSchema.optional(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
})
/** Normalized source location used by reader, evidence, and writing surfaces. */
export type SourceAnchor = z.infer<typeof sourceAnchorSchema>

/** Scope of a note. */
export const noteScopeSchema = z.enum(['project', 'paper', 'selection'])
/** Scope of a note. */
export type NoteScope = z.infer<typeof noteScopeSchema>

/** A user-authored note whose source anchor is separate from its editable body. */
export const noteSchema = z.strictObject({
  id: noteIdSchema,
  projectId: projectIdSchema,
  paperId: paperIdSchema.optional(),
  scope: noteScopeSchema,
  title: z.string().min(1),
  content: z.string(),
  anchor: sourceAnchorSchema.optional(),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
})
/** A user-authored note whose source anchor is separate from its editable body. */
export type Note = z.infer<typeof noteSchema>

/** A persisted reader highlight. */
export const annotationSchema = z.strictObject({
  id: annotationIdSchema,
  projectId: projectIdSchema,
  paperId: paperIdSchema,
  documentId: documentIdSchema,
  paragraphId: paragraphIdSchema,
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  color: z.enum(['yellow', 'blue', 'green', 'pink']),
  createdAt: z.string(),
})
/** A persisted reader highlight. */
export type Annotation = z.infer<typeof annotationSchema>

/** A project-local tag. */
export const tagSchema = z.strictObject({
  id: tagIdSchema,
  projectId: projectIdSchema,
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** A project-local tag. */
export type Tag = z.infer<typeof tagSchema>

/** Link between a tag and a first-class knowledge record. */
export const tagLinkSchema = z.strictObject({
  tagId: tagIdSchema,
  entityType: z.enum(['paper', 'evidence', 'note', 'draft']),
  entityId: z.string().min(1),
  createdAt: z.string(),
})
/** Link between a tag and a first-class knowledge record. */
export type TagLink = z.infer<typeof tagLinkSchema>

/** A fact-to-source mapping kept with a draft revision. */
export const draftFactSchema = z.strictObject({
  text: z.string().min(1),
  evidenceIds: z.array(evidenceIdSchema),
})
/** A fact-to-source mapping kept with a draft revision. */
export type DraftFact = z.infer<typeof draftFactSchema>

/**
 * Draft lifecycle owned by the Knowledge service and validated by Writing.
 *
 * The PRD lifecycle is `DRAFT -> REVIEWABLE -> EXPORTED`: any source
 * invalidation returns the revision to `DRAFT` and marks the missing
 * citations, so there is no separate stale state. `EXPORTED` records that this
 * revision was successfully exported; a later edit produces a new revision.
 *
 * Only `DRAFT` is reachable through the Knowledge service directly: the two
 * qualified states are produced by evidence-backed writing validation, never
 * requested by a caller.
 */
export const draftStatusSchema = z.enum(['DRAFT', 'REVIEWABLE', 'EXPORTED'])
/** Draft lifecycle owned by the Knowledge service and validated by Writing. */
export type DraftStatus = z.infer<typeof draftStatusSchema>

/** A current draft projection. */
export const draftSchema = z.strictObject({
  id: draftIdSchema,
  projectId: projectIdSchema,
  title: z.string(),
  outline: z.array(z.string()),
  body: z.string(),
  facts: z.array(draftFactSchema),
  claimIds: z.array(z.string()),
  evidenceIds: z.array(evidenceIdSchema),
  status: draftStatusSchema,
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** A current draft projection. */
export type Draft = z.infer<typeof draftSchema>

/** An immutable body revision. */
export const draftRevisionSchema = z.strictObject({
  id: draftRevisionIdSchema,
  draftId: draftIdSchema,
  revision: z.number().int().positive(),
  outline: z.array(z.string()),
  body: z.string(),
  facts: z.array(draftFactSchema),
  claimIds: z.array(z.string()),
  evidenceIds: z.array(evidenceIdSchema),
  createdAt: z.string(),
})
/** An immutable body revision. */
export type DraftRevision = z.infer<typeof draftRevisionSchema>

/** Search result projected from a project-scoped knowledge corpus. */
export interface KnowledgeSearchResult {
  kind: 'paper' | 'evidence' | 'note' | 'draft'
  id: string
  title: string
  excerpt: string
  score: number
  projectId: string
  /** Which field produced the match, so the UI can say why a row is listed. */
  matchedField?: 'title' | 'author' | 'pmid' | 'abstract' | 'note' | 'tag' | 'draft'
  anchor?: SourceAnchor
}

/**
 * One Project RAG candidate (SPEC-R001-S06-004). Only the current Project's
 * Paper paragraphs, verified Evidence, and Notes enter the corpus; a candidate
 * that is not a verbatim source excerpt can never answer a medical question by
 * itself.
 */
export interface ProjectRagCandidate {
  kind: 'paper' | 'evidence' | 'note'
  id: string
  title: string
  excerpt: string
  score: number
  anchor?: SourceAnchor
}

/**
 * Project RAG answer. `INSUFFICIENT` is a business result: it means the current
 * Project has no qualifying material, and the answer must not be filled in from
 * another Project or from model knowledge.
 */
export interface ProjectRagAnswer {
  projectId: string
  /** Hash of the corpus member identities this answer was computed against. */
  corpusVersion: string
  query: string
  status: 'ANSWERED' | 'INSUFFICIENT'
  candidates: ProjectRagCandidate[]
  /** Evidence/anchor references the caller may hand to the Claim Gate. */
  citations: string[]
  /** Present exactly when the status is `INSUFFICIENT`. */
  insufficientReason?: string
}
