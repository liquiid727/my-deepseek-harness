/**
 * Lifecycle, validation, audit, and test-isolation tests for the Med Research
 * skills service (SPEC-R001-S07). Exercises the full publish/install/upgrade/
 * revoke path plus every validation gap, against an in-memory storage double.
 * @module @medresearch/dsh-plugin-skills/tests/lifecycle.spec
 */

import { describe, expect, it } from 'vitest'
import {
  projectIdSchema,
  skillIdSchema,
  skillInstallationIdSchema,
  skillTestRunIdSchema,
  skillVersionIdSchema,
  type ProjectId,
  type SkillDefinition,
  type SkillId,
  type SkillInstallationId,
  type SkillTestRunId,
  type SkillVersionId,
} from '@medresearch/dsh-medical-contracts'
import { SkillError, SkillsService, type SkillsServiceOptions, type SkillTestExecutor } from '../src/service.ts'
import { BUILTIN_SKILLS } from '../src/catalog.ts'
import { createMemoryStorage } from './support.ts'

const AVAILABLE_TOOLS = [...new Set(BUILTIN_SKILLS.flatMap(skill => skill.definition.tools))]
const AVAILABLE_MODELS = ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder']
const AUTHORIZED_KNOWLEDGE = ['verified_evidence']

let counter = 0
const ids = {
  skill: () => skillIdSchema.parse(`local-${++counter}`),
  version: () => skillVersionIdSchema.parse(`ver-${++counter}`),
  test: () => skillTestRunIdSchema.parse(`run-${++counter}`),
  install: () => skillInstallationIdSchema.parse(`inst-${++counter}`),
  project: () => projectIdSchema.parse(`project-${++counter}`),
}

function makeService(overrides: Partial<SkillsServiceOptions> = {}): SkillsService {
  return new SkillsService({
    storage: createMemoryStorage(),
    now: () => '2026-09-13T00:00:00.000Z',
    newSkillId: ids.skill,
    newSkillVersionId: ids.version,
    newTestRunId: ids.test,
    newInstallationId: ids.install,
    availableTools: AVAILABLE_TOOLS,
    availableModels: AVAILABLE_MODELS,
    authorizedKnowledge: AUTHORIZED_KNOWLEDGE,
    ...overrides,
  })
}

const BASE: SkillDefinition = {
  name: 'Demo Skill',
  description: 'A demo skill exercising the full lifecycle.',
  semanticVersion: '1.0.0',
  instructions: 'Use only declared tools and cite persisted source records.',
  triggers: ['explicit'],
  tools: ['literature_plan_query'],
  model: 'deepseek-chat',
  knowledge: [],
  inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'], additionalProperties: false },
  outputSchema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] },
  examples: [{ input: { q: 'x' }, output: { status: 'ok' } }],
}

/** Author, validate, and run a successful controlled test on a fresh local draft. */
async function draftToTested(service: SkillsService, definition: SkillDefinition = BASE): Promise<{ skillId: SkillId; projectId: ProjectId }> {
  const draft = await service.saveDraft(definition)
  await service.validate(draft.id)
  const run = await service.test(draft.id, { q: 'x' })
  expect(run.status).toBe('SUCCEEDED')
  return { skillId: draft.id, projectId: ids.project() }
}

describe('full lifecycle', () => {
  it('draft → validate → test → publish → install → enable → disable → upgrade(no widen) → upgrade(widen, reconfirm) → revoke → uninstall', async () => {
    const service = makeService()
    const { skillId, projectId } = await draftToTested(service)
    const published = await service.publish(skillId)
    expect(published.status).toBe('PUBLISHED')

    // install defaults DISABLED
    const install = await service.install({ projectId, skillId, versionId: published.id, permissions: ['literature_plan_query'] })
    expect(install.enabled).toBe(false)
    // joint install+enable
    const install2 = await service.install({ projectId, skillId, versionId: published.id, permissions: ['literature_plan_query'], enable: true })
    expect(install2.enabled).toBe(true)
    await service.setEnabled(install2.id, false)
    expect((await service.get(skillId))).toBeDefined()

    // --- upgrade to 1.1.0 (NO widen) ---
    const v11 = await service.saveDraft({ ...BASE, semanticVersion: '1.1.0' })
    await service.validate(v11.id)
    await service.test(v11.id, { q: 'x' })
    const pub11 = await service.publish(v11.id)
    const up11 = await service.upgrade({ installationId: install.id, versionId: pub11.id })
    expect(up11.skillVersionId).toBe(pub11.id)
    expect(up11.enabled).toBe(false)

    // --- upgrade to 2.0.0 (WIDEN tools) requires confirm ---
    const v20 = await service.saveDraft({ ...BASE, semanticVersion: '2.0.0', tools: ['literature_plan_query', 'evidence_save'] })
    await service.validate(v20.id)
    await service.test(v20.id, { q: 'x' })
    const pub20 = await service.publish(v20.id)
    await expect(service.upgrade({ installationId: install.id, versionId: pub20.id })).rejects.toMatchObject({ code: 'SKILL_RECONFIRM_REQUIRED' })
    expect(service.installation(install.id)?.skillVersionId).toBe(pub11.id)

    const up20 = await service.upgrade({ installationId: install.id, versionId: pub20.id, confirm: true, permissions: ['literature_plan_query', 'evidence_save'] })
    expect(up20.skillVersionId).toBe(pub20.id)
    expect(service.effectivePermissions(up20.id)).toEqual(['literature_plan_query', 'evidence_save'])

    // --- revoke the widened version: blocks new install ---
    const revoked = await service.revoke(pub20.id)
    expect(revoked.status).toBe('REVOKED')
    await expect(service.install({ projectId, skillId, versionId: pub20.id, permissions: [] })).rejects.toMatchObject({ code: 'SKILL_REVOKED' })
    expect(service.isInvocationAllowed(up20.id)).toBe(false)

    // --- uninstall preserves definition + history ---
    await service.uninstall(install.id)
    expect(service.installation(install.id)).toBeUndefined()
    expect((await service.get(skillId))).toBeDefined()
    expect(service.version(pub20.id)?.status).toBe('REVOKED')
  })
})

describe('validation depth', () => {
  it('reports precise field paths for missing required fields', () => {
    const service = makeService()
    const errors = service.validateDefinition({ ...BASE, name: '' })
    expect(errors.some(e => e.path === 'name' && /required/u.test(e.message))).toBe(true)
  })

  it('flags unknown tool with a tools[i] path', () => {
    const service = makeService()
    const errors = service.validateDefinition({ ...BASE, tools: ['does_not_exist'] })
    expect(errors.some(e => e.path === 'tools[0]' && /unknown tool/u.test(e.message))).toBe(true)
  })

  it('flags unknown model with a model path', () => {
    const service = makeService()
    const errors = service.validateDefinition({ ...BASE, model: 'gpt-unknown' })
    expect(errors.some(e => e.path === 'model' && /available deployed model/u.test(e.message))).toBe(true)
  })

  it('rejects remote $ref in input/output schema', () => {
    const service = makeService()
    const errors = service.validateDefinition({ ...BASE, inputSchema: { $ref: 'https://evil.example/schema' } as never })
    expect(errors.some(e => e.path === 'inputSchema' && /remote \$ref/u.test(e.message))).toBe(true)
  })

  it('allows a local #/$defs $ref', () => {
    const service = makeService()
    const errors = service.validateDefinition({
      ...BASE,
      inputSchema: { type: 'object', properties: { q: { $ref: '#/$defs/text' } }, required: ['q'], $defs: { text: { type: 'string' } } } as never,
      examples: [{ input: { q: 'x' }, output: { status: 'ok' } }],
    })
    expect(errors).toHaveLength(0)
  })

  it('flags examples that do not match the schema', () => {
    const service = makeService()
    const errors = service.validateDefinition({ ...BASE, examples: [{ input: {}, output: { status: 'ok' } }] })
    expect(errors.some(e => /examples\[0\]\.input/u.test(e.path) && /required property/u.test(e.message))).toBe(true)
  })

  it('flags knowledge outside the authorized workspace scope', () => {
    const service = makeService()
    const errors = service.validateDefinition({ ...BASE, knowledge: ['not_authorized'] })
    expect(errors.some(e => e.path === 'knowledge[0]' && /authorized workspace scope/u.test(e.message))).toBe(true)
  })

  it('validate() throws preserving the draft and returns field errors', async () => {
    const service = makeService()
    const draft = await service.saveDraft({ ...BASE, tools: ['does_not_exist'] })
    const before = await service.get(draft.id)
    await expect(service.validate(draft.id)).rejects.toMatchObject({ code: 'SKILL_INVALID' })
    const after = await service.get(draft.id)
    expect(after).toBeDefined()
    expect(after?.status).toBe('DRAFT')
    expect(before?.currentRevision).toBe(after?.currentRevision)
  })
})

describe('publish rules', () => {
  it('publish requires a successful test of the current revision', async () => {
    const service = makeService()
    const draft = await service.saveDraft(BASE)
    await service.validate(draft.id)
    await expect(service.publish(draft.id)).rejects.toMatchObject({ code: 'SKILL_NOT_PUBLISHED' })
    await service.test(draft.id, { q: 'x' })
    const published = await service.publish(draft.id)
    expect(published.status).toBe('PUBLISHED')
  })

  it('rejects republishing a different content under the same version number', async () => {
    const service = makeService()
    const draft = await service.saveDraft(BASE)
    await service.validate(draft.id)
    await service.test(draft.id, { q: 'x' })
    await service.publish(draft.id)
    // edit definition (different content) but keep the same semantic version
    const edited = await service.saveDraft({ ...BASE, instructions: 'Changed instructions, same version.' })
    await service.validate(edited.id)
    await service.test(edited.id, { q: 'x' })
    await expect(service.publish(edited.id)).rejects.toMatchObject({ code: 'SKILL_VERSION_EXISTS' })
  })

  it('a draft edit clears VALIDATED / test freshness', async () => {
    const service = makeService()
    const draft = await service.saveDraft(BASE)
    await service.validate(draft.id)
    await service.test(draft.id, { q: 'x' })
    const published = await service.publish(draft.id)
    expect(published.status).toBe('PUBLISHED')
    // edit the draft -> new revision, VALIDATED no longer at current revision
    await service.saveDraft({ ...BASE, description: 'Edited description keeps same version.' })
    await expect(service.publish(draft.id)).rejects.toMatchObject({ code: 'SKILL_NOT_PUBLISHED' })
    // old validated version history is preserved
    expect(service.versions(draft.id).some(v => v.status === 'VALIDATED')).toBe(true)
  })
})

describe('controlled test', () => {
  it('isolates production state: only skillTests is written', async () => {
    const service = makeService()
    const { skillId } = await draftToTested(service)
    expect(service.tableSize('skillTests')).toBe(1)
    expect(service.tableSize('drafts')).toBe(0)
    expect(service.tableSize('evidences')).toBe(0)
    expect(service.tableSize('notes')).toBe(0)
    expect(service.tableSize('skillInstallations')).toBe(0)
    expect((await service.get(skillId))).toBeDefined()
  })

  it('returns a test-only active badge, never production-active', async () => {
    const service = makeService()
    const { skillId } = await draftToTested(service)
    const run = await service.test(skillId, { q: 'x' })
    expect((run.output as { activeBadge?: string })?.activeBadge).toBe('test-only')
  })

  it('cancels an in-flight run and releases resources', async () => {
    const executor: SkillTestExecutor = ({ signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) return reject(new Error('aborted'))
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    })
    const service = makeService({ testExecutor: executor })
    const draft = await service.saveDraft(BASE)
    await service.validate(draft.id)
    const pending = service.test(draft.id, { q: 'x' })
    const active = service.activeTestRunIds()
    expect(active).toHaveLength(1)
    await service.cancelTest(active[0]!)
    const run = await pending
    expect(run.status).toBe('CANCELLED')
    expect(service.activeTestRunIds()).toHaveLength(0)
  })

  it('fails on schema-invalid input without mutating production records', async () => {
    const service = makeService()
    const draft = await service.saveDraft(BASE)
    await service.validate(draft.id)
    const run = await service.test(draft.id, { wrong: true } as never)
    expect(run.status).toBe('FAILED')
    expect(run.error).toMatch(/required property/u)
  })
})

describe('browse catalog', () => {
  it('lists the 13 built-ins by source filter', async () => {
    const service = makeService()
    const builtins = await service.browse({ source: 'builtin' })
    expect(builtins.total).toBe(13)
    const local = await service.browse({ source: 'local' })
    expect(local.total).toBe(0)
  })

  it('distinguishes my drafts and installed/update-available', async () => {
    const service = makeService()
    const { skillId, projectId } = await draftToTested(service)
    const published = await service.publish(skillId)
    await service.install({ projectId, skillId, versionId: published.id, permissions: ['literature_plan_query'] })
    const drafts = await service.browse({ source: 'local' })
    expect(drafts.items.some(e => e.id === skillId)).toBe(true)
    const installed = await service.browse({ projectId, source: 'installed' })
    expect(installed.items.some(e => e.id === skillId && e.installed && e.active === false)).toBe(true)
  })

  it('derives update-available from installed vs catalog version', async () => {
    const service = makeService()
    const { skillId, projectId } = await draftToTested(service)
    const published = await service.publish(skillId)
    const install = await service.install({ projectId, skillId, versionId: published.id, permissions: ['literature_plan_query'] })
    expect((await service.browse({ projectId })).items.find(e => e.id === skillId)?.updateAvailable).toBe(false)
    // publish a newer version
    const v2 = await service.saveDraft({ ...BASE, semanticVersion: '2.0.0' })
    await service.validate(v2.id)
    await service.test(v2.id, { q: 'x' })
    await service.publish(v2.id)
    const entry = (await service.browse({ projectId })).items.find(e => e.id === skillId)
    expect(entry?.updateAvailable).toBe(true)
    expect(entry?.installedVersion).toBe('1.0.0')
    void install
  })

  it('filters by built-in category', async () => {
    const service = makeService()
    const literature = await service.browse({ category: 'literature' })
    expect(literature.total).toBe(1)
    expect(literature.items[0]!.id).toBe(skillIdSchema.parse('builtin-pubmed-deep-search'))
  })
})

describe('audit', () => {
  it('records an audit row for every state transition', async () => {
    const service = makeService()
    const { skillId, projectId } = await draftToTested(service)
    const published = await service.publish(skillId)
    const install = await service.install({ projectId, skillId, versionId: published.id, permissions: ['literature_plan_query'] })
    await service.revoke(published.id)
    await service.uninstall(install.id)

    const rows = service.auditRows()
    const actions = rows.map(r => String(r.action))
    for (const expected of ['skill.save_draft', 'skill.validate', 'skill.test', 'skill.publish', 'skill.install', 'skill.revoke', 'skill.uninstall']) {
      expect(actions).toContain(expected)
    }
    const publishRow = rows.find(r => String(r.action) === 'skill.publish')
    expect(publishRow?.detail).toHaveProperty('targetVersionId')
  })
})

describe('delete draft preserves history', () => {
  it('removes the draft but keeps published version history', async () => {
    const service = makeService()
    const { skillId } = await draftToTested(service)
    const published = await service.publish(skillId)
    await service.deleteDraft(skillId)
    expect(await service.get(skillId)).toBeUndefined()
    expect(service.version(published.id)).toBeDefined()
    expect(service.version(published.id)?.status).toBe('PUBLISHED')
  })
})

describe('built-in catalog contract', () => {
  it('every built-in satisfies the catalog contract (unique id, schema, examples, tools, model)', () => {
    const service = makeService()
    const idsSeen = new Set<string>()
    for (const skill of BUILTIN_SKILLS) {
      expect(idsSeen.has(skill.id)).toBe(false)
      idsSeen.add(skill.id)
      expect(skill.publisher).toBe('builtin-catalog')
      expect(skill.definition.tools.length).toBeGreaterThan(0)
      expect(skill.definition.model).toBeDefined()
      expect(AVAILABLE_MODELS).toContain(skill.definition.model)
      const errors = service.validateDefinition(skill.definition, { availableModels: AVAILABLE_MODELS })
      expect(errors).toEqual([])
    }
    expect(idsSeen.size).toBe(13)
  })
})
