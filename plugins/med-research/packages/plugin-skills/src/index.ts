/** Skills plugin entry (SPEC-R001-S07). */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { asToolJson, projectIdSchema, skillIdSchema, skillInstallationIdSchema, skillTestRunIdSchema, skillVersionIdSchema, TOOL_ENVELOPE_SCHEMA, renderToolEnvelope } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { SkillError, SkillsService } from './service.ts'

export { BUILTIN_SKILLS } from './catalog.ts'
export { SkillError, SkillsService } from './service.ts'
export const name = 'med-skills'
export const inject = ['tools', 'storageDomain']

declare module '@deepseek-ai/cordis' { interface Context { medSkills: SkillsService } }

function failure(error: SkillError) { return { ok: false as const, error: asToolJson({ code: error.code, message: error.message, retryable: false, partialDataAvailable: false, source: 'skills' }) } }
function skillsTools(service: SkillsService): ToolDefinition[] {
  return [
    defineTool({ name: 'skill_catalog', description: 'List the thirteen built-in and local skill definitions.', parameters: { query: { type: 'string', description: 'Optional name/description filter.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { return { ok: true, result: asToolJson(await service.catalog(args.query)) } } }),
    defineTool({ name: 'skill_get', description: 'Inspect one skill definition, version, tools, model, knowledge, and triggers.', parameters: { skillId: { type: 'string', required: true, description: 'Skill id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { const skill = await service.get(skillIdSchema.parse(args.skillId)); return skill === undefined ? failure(new SkillError('SKILL_NOT_FOUND', `no skill ${args.skillId}`)) : { ok: true, result: asToolJson(skill) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_test', description: 'Run a skill input in a temporary trace-only registry; it cannot change production records.', parameters: { skillId: { type: 'string', required: true, description: 'Skill id.' }, input: { type: 'json', required: true, description: 'Schema-valid test input.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.test(skillIdSchema.parse(args.skillId), args.input)) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_install', description: 'Install a published skill version into a project; disabled unless enable is explicitly true.', parameters: { projectId: { type: 'string', required: true, description: 'Target project.' }, skillId: { type: 'string', required: true, description: 'Skill id.' }, versionId: { type: 'string', required: true, description: 'Published version id.' }, permissions: { type: 'array', items: { type: 'string' }, required: true, description: 'Confirmed permissions.' }, enable: { type: 'boolean', description: 'Explicitly enable after installation.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.install({ projectId: projectIdSchema.parse(args.projectId), skillId: skillIdSchema.parse(args.skillId), versionId: skillVersionIdSchema.parse(args.versionId), permissions: args.permissions, ...args.enable === undefined ? {} : { enable: args.enable } })) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
  ]
}

/** Mount the local skill service. */
export async function apply(ctx: Context): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.skills.storage')
  const service = new SkillsService({ storage, now: () => new Date().toISOString(), newSkillId: () => skillIdSchema.parse(randomUUID()), newSkillVersionId: () => skillVersionIdSchema.parse(randomUUID()), newTestRunId: () => skillTestRunIdSchema.parse(randomUUID()), newInstallationId: () => skillInstallationIdSchema.parse(randomUUID()) })
  await service.seedBuiltins()
  ctx.effect(() => ctx.provide('medSkills', service), 'med.skills.service')
  for (const tool of skillsTools(service)) ctx.tools.register(tool)
}
