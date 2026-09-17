/** Evidence-backed writing and deterministic export contracts (SPEC-R001-S08). */

import { z } from 'zod'
import { draftIdSchema, evidenceIdSchema, paperIdSchema, projectIdSchema } from './ids.ts'

/** Supported writing language labels. */
export const writingLanguageSchema = z.enum(['zh', 'en'])
/** Supported writing language labels. */
export type WritingLanguage = z.infer<typeof writingLanguageSchema>

/** A citation resolved from persisted paper metadata. */
export const citationEntrySchema = z.strictObject({
  index: z.number().int().positive(),
  paperId: paperIdSchema,
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().optional(),
  year: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  url: z.string().optional(),
  evidenceIds: z.array(evidenceIdSchema),
})
/** A citation resolved from persisted paper metadata. */
export type CitationEntry = z.infer<typeof citationEntrySchema>

/** Validation outcome for a draft or translation. */
export const writingValidationSchema = z.strictObject({
  valid: z.boolean(),
  status: z.enum(['DRAFT', 'REVIEWABLE', 'STALE', 'TRANSLATION_MISMATCH']),
  reasons: z.array(z.string()),
  citations: z.array(citationEntrySchema),
})
/** Validation outcome for a draft or translation. */
export type WritingValidation = z.infer<typeof writingValidationSchema>

/** Draft generation result, including explicit insufficiency reasons. */
export const writingGenerationSchema = z.strictObject({
  draftId: draftIdSchema,
  body: z.string(),
  facts: z.array(z.strictObject({ text: z.string(), evidenceIds: z.array(evidenceIdSchema) })),
  insufficiencies: z.array(z.string()),
  citations: z.array(citationEntrySchema),
})
/** Draft generation result, including explicit insufficiency reasons. */
export type WritingGeneration = z.infer<typeof writingGenerationSchema>

/** Deterministic citation export response. */
export const citationExportSchema = z.strictObject({
  projectId: projectIdSchema,
  format: z.enum(['ris', 'bibtex', 'markdown']),
  mode: z.enum(['complete', 'preview']),
  content: z.string(),
  warnings: z.array(z.string()),
  citationRevision: z.string().min(1),
})
/** Deterministic citation export response. */
export type CitationExport = z.infer<typeof citationExportSchema>
