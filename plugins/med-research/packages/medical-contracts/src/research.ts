/**
 * Research-chain records and inputs (SPEC §7–§12, §17–§18, §20–§23). Every
 * schema is strict: a stored record carrying an undeclared field is rejected
 * at the durable boundary instead of being silently stripped.
 * @module @medresearch/dsh-medical-contracts/src/research
 */

import { z } from 'zod'
import {
  claimIdSchema,
  documentIdSchema,
  evidenceChunkIdSchema,
  evidenceIdSchema,
  paperIdSchema,
  paragraphIdSchema,
  projectIdSchema,
  researchQueryIdSchema,
  sectionIdSchema,
} from './ids.ts'

/** One author entry of a paper. */
export const authorSchema = z.strictObject({
  name: z.string().min(1),
  affiliation: z.string().optional(),
  orcid: z.string().optional(),
})
/** One author entry of a paper. */
export type Author = z.infer<typeof authorSchema>

/** Project status (SPEC §7). */
export const projectStatusSchema = z.enum(['active', 'archived'])
/** Project status (SPEC §7). */
export type ProjectStatus = z.infer<typeof projectStatusSchema>

/** Research project; one project binds to exactly one DSH workspace. */
export const projectSchema = z.strictObject({
  id: projectIdSchema,
  name: z.string().min(1),
  researchQuestion: z.string().optional(),
  background: z.string().optional(),
  population: z.string().optional(),
  interventionOrExposure: z.string().optional(),
  comparison: z.string().optional(),
  outcome: z.string().optional(),
  keywords: z.array(z.string()),
  /** DSH workspace path; `project.json` lives under `<workspacePath>/.medresearch/`. */
  workspacePath: z.string().min(1),
  status: projectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** Research project; one project binds to exactly one DSH workspace. */
export type Project = z.infer<typeof projectSchema>

/** `sessionId → projectId` binding (SPEC §41); the session id is DSH-owned and opaque. */
export const sessionProjectSchema = z.strictObject({
  sessionId: z.string().min(1),
  projectId: projectIdSchema,
  updatedAt: z.string(),
})
/** `sessionId → projectId` binding (SPEC §41). */
export type SessionProject = z.infer<typeof sessionProjectSchema>

/** Agent mode used to restrict the model-visible Med Research tools. */
export const agentModeSchema = z.enum(['research', 'paper', 'statistics'])
/** Agent mode used to restrict the model-visible Med Research tools. */
export type AgentMode = z.infer<typeof agentModeSchema>

/** Origin connector of a paper (SPEC §8). */
export const paperSourceSchema = z.enum(['pubmed', 'pmc', 'europe_pmc', 'upload'])
/** Origin connector of a paper (SPEC §8). */
export type PaperSource = z.infer<typeof paperSourceSchema>

/** Full-text availability of a paper (SPEC §8). */
export const fulltextStatusSchema = z.enum(['available', 'abstract_only', 'user_upload', 'unavailable'])
/** Full-text availability of a paper (SPEC §8). */
export type FulltextStatus = z.infer<typeof fulltextStatusSchema>

/** Paper metadata (SPEC §8). PMID / DOI / PMCID are connector-owned, never model-authored. */
export const paperSchema = z.strictObject({
  id: paperIdSchema,
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  doi: z.string().optional(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(authorSchema),
  journal: z.string().optional(),
  publicationDate: z.string().optional(),
  publicationTypes: z.array(z.string()),
  meshTerms: z.array(z.string()),
  keywords: z.array(z.string()),
  source: paperSourceSchema,
  sourceUrl: z.string().optional(),
  fulltextStatus: fulltextStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** Paper metadata (SPEC §8). */
export type Paper = z.infer<typeof paperSchema>

/** Raw connector metadata kept beside the normalized paper (SPEC §20). */
export const paperSourceRecordSchema = z.strictObject({
  paperId: paperIdSchema,
  source: z.string().min(1),
  sourceId: z.string().min(1),
  rawMetadata: z.unknown(),
})
/** Raw connector metadata kept beside the normalized paper (SPEC §20). */
export type PaperSourceRecord = z.infer<typeof paperSourceRecordSchema>

/** `projectId → paperId` library membership. */
export const projectPaperSchema = z.strictObject({
  projectId: projectIdSchema,
  paperId: paperIdSchema,
  savedAt: z.string(),
})
/** `projectId → paperId` library membership. */
export type ProjectPaper = z.infer<typeof projectPaperSchema>

/** Parse outcome of one document (SPEC §9). */
export const parseStatusSchema = z.enum(['READY', 'PARTIAL', 'FAILED', 'ABSTRACT_ONLY'])
/** Parse outcome of one document (SPEC §9). */
export type ParseStatus = z.infer<typeof parseStatusSchema>

/** Source format of one parsed document (SPEC §9). */
export const documentSourceTypeSchema = z.enum(['abstract', 'pmc_xml', 'europe_pmc_xml', 'uploaded_pdf'])
/** Source format of one parsed document (SPEC §9). */
export type DocumentSourceType = z.infer<typeof documentSourceTypeSchema>

/** One parsed representation of a paper (SPEC §9). */
export const paperDocumentSchema = z.strictObject({
  id: documentIdSchema,
  paperId: paperIdSchema,
  sourceType: documentSourceTypeSchema,
  contentHash: z.string().min(1),
  license: z.string().optional(),
  accessUrl: z.string().optional(),
  parseStatus: parseStatusSchema,
  createdAt: z.string(),
})
/** One parsed representation of a paper (SPEC §9). */
export type PaperDocument = z.infer<typeof paperDocumentSchema>

/** Section classification (SPEC §10). */
export const sectionTypeSchema = z.enum([
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'references',
  'other',
])
/** Section classification (SPEC §10). */
export type SectionType = z.infer<typeof sectionTypeSchema>

/** One section of a document (SPEC §10). */
export const paperSectionSchema = z.strictObject({
  id: sectionIdSchema,
  documentId: documentIdSchema,
  title: z.string(),
  type: sectionTypeSchema,
  order: z.number().int().nonnegative(),
})
/** One section of a document (SPEC §10). */
export type PaperSection = z.infer<typeof paperSectionSchema>

/** One paragraph; `text` is the normalized offset base (SPEC §10, §22.3). */
export const paperParagraphSchema = z.strictObject({
  id: paragraphIdSchema,
  sectionId: sectionIdSchema,
  order: z.number().int().nonnegative(),
  /** Normalized paragraph text; every evidence offset is relative to this. */
  text: z.string(),
  /** Pre-normalization text, kept for UI display. */
  rawText: z.string(),
  page: z.number().int().positive().optional(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
})
/** One paragraph; `text` is the normalized offset base (SPEC §10, §22.3). */
export type PaperParagraph = z.infer<typeof paperParagraphSchema>

/** Retrieval unit grouping adjacent paragraphs (SPEC §23). */
export const evidenceChunkSchema = z.strictObject({
  id: evidenceChunkIdSchema,
  paperId: paperIdSchema,
  documentId: documentIdSchema,
  sectionType: sectionTypeSchema,
  sectionTitle: z.string(),
  paragraphIds: z.array(paragraphIdSchema),
  text: z.string(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
})
/** Retrieval unit grouping adjacent paragraphs (SPEC §23). */
export type EvidenceChunk = z.infer<typeof evidenceChunkSchema>

/** Relation of an evidence span to the claim it is retrieved for (SPEC §11). */
export const evidenceRelationSchema = z.enum(['SUPPORT', 'AGAINST', 'UNCERTAIN'])
/** Relation of an evidence span to the claim it is retrieved for (SPEC §11). */
export type EvidenceRelation = z.infer<typeof evidenceRelationSchema>

/** Evidence provenance class (SPEC §11). */
export const evidenceSourceTypeSchema = z.enum(['fulltext', 'abstract', 'secondary_citation'])
/** Evidence provenance class (SPEC §11). */
export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>

/** Whether the stored quote can be relocated in its document (SPEC §11). */
export const locatorStatusSchema = z.enum(['FOUND', 'PARTIAL', 'NOT_FOUND'])
/** Whether the stored quote can be relocated in its document (SPEC §11). */
export type LocatorStatus = z.infer<typeof locatorStatusSchema>

/** Whether the evidence semantically supports its claim (SPEC §11). */
export const supportStatusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])
/** Whether the evidence semantically supports its claim (SPEC §11). */
export type SupportStatus = z.infer<typeof supportStatusSchema>

/** Offset base is fixed in V1; offsets are relative to the paragraph's normalized text. */
export const offsetBaseSchema = z.literal('normalized_paragraph')
/** Offset base is fixed in V1. */
export type OffsetBase = z.infer<typeof offsetBaseSchema>

/** Half-open `[start, end)` range over a paragraph's normalized text. */
export const textSpanSchema = z.strictObject({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
})
/** Half-open `[start, end)` range over a paragraph's normalized text. */
export type TextSpan = z.infer<typeof textSpanSchema>

/** One located evidence span (SPEC §11). */
export const evidenceSchema = z.strictObject({
  id: evidenceIdSchema,
  projectId: projectIdSchema,
  paperId: paperIdSchema,
  documentId: documentIdSchema,
  sourceType: evidenceSourceTypeSchema,
  section: z.string().optional(),
  paragraphId: paragraphIdSchema.optional(),
  page: z.number().int().positive().optional(),
  originalText: z.string().min(1),
  normalizedText: z.string().min(1),
  offsetBase: offsetBaseSchema,
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  /**
   * Exact spans a `PARTIAL` locator matched. A PARTIAL evidence without any
   * matched span is not qualified and must be downgraded to `NOT_FOUND`
   * (interfaces.md §Reader, Note and Evidence).
   */
  matchedAnchors: z.array(textSpanSchema).optional(),
  /** Paragraph regions a `PARTIAL` locator could not match; display only. */
  unmatchedRanges: z.array(textSpanSchema).optional(),
  relation: evidenceRelationSchema,
  retrievalScore: z.number().optional(),
  rerankScore: z.number().optional(),
  locatorStatus: locatorStatusSchema,
  supportStatus: supportStatusSchema,
  /** Reason recorded by the last semantic verification (SPEC §25). */
  verificationReason: z.string().optional(),
  /** Verifier version that produced the current support status (SPEC §25). */
  verificationVersion: z.string().optional(),
  /** Time of the last semantic verification. */
  verifiedAt: z.string().optional(),
  /**
   * Withdrawal time. A withdrawn evidence stops qualifying immediately and
   * invalidates the claims and drafts that depended on it (interfaces.md).
   */
  withdrawnAt: z.string().optional(),
  extractorVersion: z.string().min(1),
  extractorModel: z.string().min(1),
  promptVersion: z.string().min(1),
  createdAt: z.string(),
})
/** One located evidence span (SPEC §11). */
export type Evidence = z.infer<typeof evidenceSchema>

/**
 * Overall evidence sufficiency of a claim (SPEC §12, interfaces.md).
 *
 * `CONFLICTING` means qualified SUPPORT and qualified AGAINST evidence both
 * exist; `CONSISTENT` means only one side has qualified evidence (the direction
 * is carried by the counts); `INSUFFICIENT` means neither side does.
 */
export const evidenceStatusSchema = z.enum(['CONSISTENT', 'INSUFFICIENT', 'CONFLICTING'])
/** Overall evidence sufficiency of a claim (SPEC §12). */
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>

/** One research claim (SPEC §12). */
export const claimSchema = z.strictObject({
  id: claimIdSchema,
  projectId: projectIdSchema,
  researchQueryId: researchQueryIdSchema,
  text: z.string().min(1),
  evidenceIds: z.array(evidenceIdSchema),
  counterEvidenceIds: z.array(evidenceIdSchema),
  evidenceStatus: evidenceStatusSchema,
  confidence: z.number().optional(),
  supportStatus: supportStatusSchema,
  /** Verification failures; empty when the claim passes the Citation Gate. */
  rejectionReasons: z.array(z.string()),
  createdAt: z.string(),
})
/** One research claim (SPEC §12). */
export type Claim = z.infer<typeof claimSchema>

/** Role of an evidence in a claim binding. */
export const claimEvidenceRoleSchema = z.enum(['support', 'counter'])
/** Role of an evidence in a claim binding. */
export type ClaimEvidenceRole = z.infer<typeof claimEvidenceRoleSchema>

/** `claimId → evidenceId` binding row. */
export const claimEvidenceSchema = z.strictObject({
  claimId: claimIdSchema,
  evidenceId: evidenceIdSchema,
  role: claimEvidenceRoleSchema,
})
/** `claimId → evidenceId` binding row. */
export type ClaimEvidence = z.infer<typeof claimEvidenceSchema>

/** Research query input (SPEC §17). */
export const researchQueryInputSchema = z.strictObject({
  projectId: projectIdSchema,
  question: z.string().min(1),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  publicationTypes: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().optional(),
})
/** Research query input (SPEC §17). */
export type ResearchQueryInput = z.infer<typeof researchQueryInputSchema>

/** One PICO element set of a query plan (SPEC §18). */
export const picoSchema = z.strictObject({
  population: z.string().optional(),
  interventionOrExposure: z.string().optional(),
  comparison: z.string().optional(),
  outcome: z.string().optional(),
})
/** One PICO element set of a query plan (SPEC §18). */
export type Pico = z.infer<typeof picoSchema>

/** One searched concept with its synonyms and MeSH candidates (SPEC §18). */
export const queryConceptSchema = z.strictObject({
  name: z.string().min(1),
  synonyms: z.array(z.string()),
  meshCandidates: z.array(z.string()),
})
/** One searched concept with its synonyms and MeSH candidates (SPEC §18). */
export type QueryConcept = z.infer<typeof queryConceptSchema>

/** Purpose of one generated query (SPEC §18). */
export const queryPurposeSchema = z.enum(['primary', 'broad', 'counter', 'related'])
/** Purpose of one generated query (SPEC §18). */
export type QueryPurpose = z.infer<typeof queryPurposeSchema>

/** One executable source query (SPEC §18). */
export const querySchema = z.strictObject({
  source: z.literal('pubmed'),
  query: z.string().min(1),
  purpose: queryPurposeSchema,
})
/** One executable source query (SPEC §18). */
export type Query = z.infer<typeof querySchema>

/** Editable PubMed query plan (SPEC §18). */
export const queryPlanSchema = z.strictObject({
  normalizedQuestion: z.string().min(1),
  pico: picoSchema.optional(),
  concepts: z.array(queryConceptSchema),
  queries: z.array(querySchema),
})
/** Editable PubMed query plan (SPEC §18). */
export type QueryPlan = z.infer<typeof queryPlanSchema>

/** Full-text resolution outcome (SPEC §21). */
export const fulltextResolutionSchema = z.strictObject({
  status: z.enum(['available', 'abstract_only', 'unavailable']),
  source: z.enum(['pmc', 'europe_pmc', 'unpaywall', 'openalex', 'publisher', 'user_upload']).optional(),
  url: z.string().optional(),
  license: z.string().optional(),
  machineReadable: z.boolean().optional(),
})
/** Full-text resolution outcome (SPEC §21). */
export type FulltextResolution = z.infer<typeof fulltextResolutionSchema>

/** Search filters carried with one research query (SPEC §17). */
export const researchQueryFiltersSchema = z.strictObject({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  publicationTypes: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
})
/** Search filters carried with one research query (SPEC §17). */
export type ResearchQueryFilters = z.infer<typeof researchQueryFiltersSchema>

/** One persisted research query and the plan generated for it (SPEC §12, §17–§18). */
export const researchQuerySchema = z.strictObject({
  id: researchQueryIdSchema,
  projectId: projectIdSchema,
  question: z.string().min(1),
  normalizedQuestion: z.string().min(1),
  pico: picoSchema.optional(),
  concepts: z.array(queryConceptSchema),
  queries: z.array(querySchema),
  filters: researchQueryFiltersSchema,
  /** Monotonic plan revision; old records default to their first revision. */
  revision: z.number().int().positive().optional(),
  createdAt: z.string(),
  approvedAt: z.string().optional(),
  approvedRevision: z.number().int().positive().optional(),
})
/** One persisted research query and the plan generated for it (SPEC §12, §17–§18). */
export type ResearchQuery = z.infer<typeof researchQuerySchema>
