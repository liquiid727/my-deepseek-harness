/** Skill catalog, controlled-test, and installation records (SPEC-R001-S07). */

import { z } from 'zod'
import {
  projectIdSchema,
  skillIdSchema,
  skillInstallationIdSchema,
  skillTestRunIdSchema,
  skillVersionIdSchema,
} from './ids.ts'

/** Supported skill activation triggers. */
export const skillTriggerSchema = z.enum(['explicit', 'upload', 'keyword'])
/** Supported skill activation triggers. */
export type SkillTrigger = z.infer<typeof skillTriggerSchema>

/** Skill origin shown in the catalog. */
export const skillSourceSchema = z.enum(['builtin', 'local'])
/** Skill origin shown in the catalog. */
export type SkillSource = z.infer<typeof skillSourceSchema>

/** Lifecycle of a definition revision. */
export const skillRevisionStatusSchema = z.enum(['DRAFT', 'VALIDATED', 'PUBLISHED', 'REVOKED'])
/** Lifecycle of a definition revision. */
export type SkillRevisionStatus = z.infer<typeof skillRevisionStatusSchema>

/** One example input/output pair for a skill definition. */
export const skillExampleSchema = z.strictObject({
  input: z.unknown(),
  output: z.unknown(),
})
/** One example input/output pair for a skill definition. */
export type SkillExample = z.infer<typeof skillExampleSchema>

/** Validated skill definition fields. */
export const skillDefinitionSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  semanticVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  instructions: z.string().min(1),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  examples: z.array(skillExampleSchema),
  tools: z.array(z.string().min(1)),
  model: z.string().optional(),
  knowledge: z.array(z.string()),
  triggers: z.array(skillTriggerSchema),
})
/** Validated skill definition fields. */
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>

/** Mutable skill identity and its current revision. */
export const skillSchema = z.strictObject({
  id: skillIdSchema,
  source: skillSourceSchema,
  publisher: z.string().min(1),
  currentVersion: z.string().min(1),
  currentRevision: z.number().int().positive(),
  definition: skillDefinitionSchema,
  status: skillRevisionStatusSchema,
  updatedAt: z.string(),
})
/** Mutable skill identity and its current revision. */
export type Skill = z.infer<typeof skillSchema>

/** Immutable published or draft revision. */
export const skillVersionSchema = z.strictObject({
  id: skillVersionIdSchema,
  skillId: skillIdSchema,
  revision: z.number().int().positive(),
  semanticVersion: z.string().min(1),
  definition: skillDefinitionSchema,
  status: skillRevisionStatusSchema,
  createdAt: z.string(),
  publishedAt: z.string().optional(),
  revokedAt: z.string().optional(),
})
/** Immutable published or draft revision. */
export type SkillVersion = z.infer<typeof skillVersionSchema>

/** A controlled invocation trace entry. */
export const skillTraceEntrySchema = z.strictObject({
  tool: z.string().min(1),
  status: z.enum(['allowed', 'denied', 'completed']),
  detail: z.string().optional(),
})
/** A controlled invocation trace entry. */
export type SkillTraceEntry = z.infer<typeof skillTraceEntrySchema>

/** Result of a skill test in an isolated temporary registry. */
export const skillTestRunSchema = z.strictObject({
  id: skillTestRunIdSchema,
  skillId: skillIdSchema,
  skillVersionId: skillVersionIdSchema,
  status: z.enum(['SUCCEEDED', 'FAILED', 'CANCELLED']),
  input: z.unknown(),
  output: z.unknown().optional(),
  trace: z.array(skillTraceEntrySchema),
  error: z.string().optional(),
  createdAt: z.string(),
  finishedAt: z.string(),
})
/** Result of a skill test in an isolated temporary registry. */
export type SkillTestRun = z.infer<typeof skillTestRunSchema>

/** Explicit workspace installation and permission grant. */
export const skillInstallationSchema = z.strictObject({
  id: skillInstallationIdSchema,
  projectId: projectIdSchema,
  skillId: skillIdSchema,
  skillVersionId: skillVersionIdSchema,
  enabled: z.boolean(),
  permissions: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** Explicit workspace installation and permission grant. */
export type SkillInstallation = z.infer<typeof skillInstallationSchema>
