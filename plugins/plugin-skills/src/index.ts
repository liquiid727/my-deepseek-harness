/** Skills plugin entry (SPEC-R001-S07). */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { asToolJson, projectIdSchema, skillIdSchema, skillInstallationIdSchema, skillTestRunIdSchema, skillVersionIdSchema, TOOL_ENVELOPE_SCHEMA, renderToolEnvelope } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { SkillError, SkillsService } from './service.ts'

export { BUILTIN_CATEGORY, BUILTIN_SKILLS } from './catalog.ts'
export { SkillError, SkillsService } from './service.ts'
export const name = 'med-skills'
export const inject = ['tools', 'storageDomain']

declare module '@deepseek-ai/cordis' { interface Context { medSkills: SkillsService } }

function failure(error: SkillError) { return { ok: false as const, error: asToolJson({ code: error.code, message: error.message, retryable: false, partialDataAvailable: false, source: 'skills' }) } }
function skillsTools(service: SkillsService): ToolDefinition[] {
  return [
    defineTool({ name: 'skill_catalog', description: 'List the thirteen built-in and local skill definitions.', parameters: { query: { type: 'string', description: 'Optional name/description filter.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { return { ok: true, result: asToolJson(await service.catalog(args.query)) } } }),
    defineTool({ name: 'skill_browse', description: 'Browse the catalog with category/query/source/status filters and cursor paging.', parameters: { query: { type: 'string', description: 'Name/description filter.' }, category: { type: 'string', description: 'Built-in category filter.' }, source: { type: 'string', description: 'builtin | local | published-local | draft | installed | my-drafts.' }, status: { type: 'string', description: 'Skill lifecycle status.' }, projectId: { type: 'string', description: 'Project whose installations drive installed/update-available.' }, cursor: { type: 'string', description: 'Page cursor from a previous browse.' }, limit: { type: 'number', description: 'Page size.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { return { ok: true, result: asToolJson(await service.browse({ query: args.query, category: args.category, source: args.source, status: args.status, projectId: args.projectId === undefined ? undefined : projectIdSchema.parse(args.projectId), cursor: args.cursor, limit: args.limit === undefined ? undefined : Number(args.limit) })) } } }),
    defineTool({ name: 'skill_get', description: 'Inspect one skill definition, version, tools, model, knowledge, and triggers.', parameters: { skillId: { type: 'string', required: true, description: 'Skill id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { const skill = await service.get(skillIdSchema.parse(args.skillId)); return skill === undefined ? failure(new SkillError('SKILL_NOT_FOUND', `no skill ${args.skillId}`)) : { ok: true, result: asToolJson(skill) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_save_draft', description: 'Create or update a local skill draft; preserves the draft on edit.', parameters: { definition: { type: 'json', required: true, description: 'Skill definition object.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.saveDraft(args.definition as never)) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_test', description: 'Run a skill input in a temporary trace-only registry; it cannot change production records.', parameters: { skillId: { type: 'string', required: true, description: 'Skill id.' }, input: { type: 'json', required: true, description: 'Schema-valid test input.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.test(skillIdSchema.parse(args.skillId), args.input)) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_install', description: 'Install a published skill version into a project; disabled unless enable is explicitly true.', parameters: { projectId: { type: 'string', required: true, description: 'Target project.' }, skillId: { type: 'string', required: true, description: 'Skill id.' }, versionId: { type: 'string', required: true, description: 'Published version id.' }, permissions: { type: 'array', items: { type: 'string' }, required: true, description: 'Confirmed permissions.' }, enable: { type: 'boolean', description: 'Explicitly enable after installation.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.install({ projectId: projectIdSchema.parse(args.projectId), skillId: skillIdSchema.parse(args.skillId), versionId: skillVersionIdSchema.parse(args.versionId), permissions: args.permissions, ...args.enable === undefined ? {} : { enable: args.enable } })) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_enable', description: 'Enable or disable an installation; disabling cancels in-flight calls.', parameters: { installationId: { type: 'string', required: true, description: 'Installation id.' }, enabled: { type: 'boolean', required: true, description: 'Target enabled state.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.setEnabled(skillInstallationIdSchema.parse(args.installationId), args.enabled === true)) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_upgrade', description: 'Upgrade an installation to a newer published version; widening requires confirm=true.', parameters: { installationId: { type: 'string', required: true, description: 'Installation id.' }, versionId: { type: 'string', required: true, description: 'Target published version id.' }, permissions: { type: 'array', items: { type: 'string' }, description: 'Re-confirmed permissions.' }, confirm: { type: 'boolean', description: 'Required when the upgrade widens permissions.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.upgrade({ installationId: skillInstallationIdSchema.parse(args.installationId), versionId: skillVersionIdSchema.parse(args.versionId), ...args.permissions === undefined ? {} : { permissions: args.permissions }, ...args.confirm === undefined ? {} : { confirm: args.confirm } })) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_revoke', description: 'Revoke a published version: block new install/invoke, cancel in-flight, keep history.', parameters: { versionId: { type: 'string', required: true, description: 'Published version id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.revoke(skillVersionIdSchema.parse(args.versionId))) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_delete_draft', description: 'Delete a local draft; never deletes published version history.', parameters: { skillId: { type: 'string', required: true, description: 'Draft skill id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { await service.deleteDraft(skillIdSchema.parse(args.skillId)); return { ok: true, result: asToolJson({ deleted: args.skillId }) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
    defineTool({ name: 'skill_cancel_test', description: 'Cancel an in-flight controlled test run and release its resources.', parameters: { runId: { type: 'string', required: true, description: 'Test run id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.cancelTest(skillTestRunIdSchema.parse(args.runId))) } } catch (error) { if (error instanceof SkillError) return failure(error); throw error } } }),
  ]
}

/** Mount the local skill service. */
export async function apply(ctx: Context): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.skills.storage')
  const service = new SkillsService({
    storage,
    now: () => new Date().toISOString(),
    newSkillId: () => skillIdSchema.parse(randomUUID()),
    newSkillVersionId: () => skillVersionIdSchema.parse(randomUUID()),
    newTestRunId: () => skillTestRunIdSchema.parse(randomUUID()),
    newInstallationId: () => skillInstallationIdSchema.parse(randomUUID()),
    availableTools: [],
    availableModels: [],
    authorizedKnowledge: [],
    defaultActor: 'system',
  })
  await service.seedBuiltins()
  ctx.effect(() => ctx.provide('medSkills', service), 'med.skills.service')
  for (const tool of skillsTools(service)) ctx.tools.register(tool)
}
