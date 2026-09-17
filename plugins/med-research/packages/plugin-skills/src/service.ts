/**
 * Skill catalog, controlled-test, publication, and workspace-installation
 * service (SPEC-R001-S07). This is the product-lifecycle owner for skill
 * definitions: it owns definition/version identity, project installation, the
 * controlled test run, and the audit trail. The test run executes through a
 * temporary, non-activated registry and never mutates production
 * Notes/Evidence/Drafts/installations (SPEC §8, "test isolation").
 * @module @medresearch/dsh-plugin-skills/src/service
 */

import type {
  AuditAction,
  AuditLog,
  MedSkillsService,
  ProjectId,
  Skill,
  SkillDefinition,
  SkillId,
  SkillInstallation,
  SkillInstallationId,
  SkillTestRun,
  SkillTestRunId,
  SkillVersion,
  SkillVersionId,
} from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import { createAuditWriter, type AuditWriter } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { BUILTIN_CATEGORY, BUILTIN_SKILLS } from './catalog.ts'
import { collectRemoteRefs, validateAgainstSchema, type JsonSchemaError } from './json-schema.ts'

/** Construction dependencies for {@link SkillsService}. */
export interface SkillsServiceOptions {
  storage: MedStorage
  now: () => string
  newSkillId: () => SkillId
  newSkillVersionId: () => SkillVersionId
  newTestRunId: () => SkillTestRunId
  newInstallationId: () => SkillInstallationId
  /** Tools the deployment policy and current Agent Mode allowlist admit. */
  availableTools?: readonly string[]
  /** Models the deployment currently has available; a builder model must resolve here. */
  availableModels?: readonly string[]
  /** Knowledge references the current workspace authorizes a draft to cite. */
  authorizedKnowledge?: readonly string[]
  /** Pluggable controlled-execution body; defaults to a deterministic test stub. */
  testExecutor?: SkillTestExecutor
  /** Actor recorded when an operation names none. */
  defaultActor?: string
}

/** One precise definition-validation failure, located by JSON pointer. */
export interface SkillFieldError {
  /** JSON pointer to the failing field (empty string for the root). */
  path: string
  /** Human-readable reason. */
  message: string
}

/** Stable skill lifecycle failures. */
export type SkillErrorCode =
  | 'SKILL_NOT_FOUND'
  | 'SKILL_INVALID'
  | 'SKILL_VERSION_EXISTS'
  | 'SKILL_NOT_PUBLISHED'
  | 'SKILL_INSTALLATION_NOT_FOUND'
  | 'SKILL_REVOKED'
  | 'SKILL_RECONFIRM_REQUIRED'

/** A skill lifecycle failure; carries structured field errors when validation failed. */
export class SkillError extends Error {
  override readonly name = 'SkillError'
  /** Field-level errors, present when `code` is `SKILL_INVALID`. */
  readonly errors: readonly SkillFieldError[] | undefined
  constructor(readonly code: SkillErrorCode, message: string, errors?: readonly SkillFieldError[]) {
    super(message)
    this.errors = errors
  }
}

/** Actor/session provenance threaded through audited operations. */
export interface SkillMeta {
  /** Human or agent actor responsible for the transition. */
  actor?: string
  /** DSH session that caused the operation. */
  sessionId?: string
}

/** Context handed to a controlled-test executor. */
export interface SkillTestContext {
  /** Aborts when the run is cancelled; the executor must observe it. */
  signal: AbortSignal
  /** The validated version under test. */
  version: SkillVersion
  /** The schema-valid test input. */
  input: unknown
}

/** Controlled-execution body for a skill test; isolated from production state. */
export type SkillTestExecutor = (ctx: SkillTestContext) => Promise<unknown>

/** Controlled test options. */
export interface SkillTestOptions extends SkillMeta {
  /** Pre-resolved test input already known schema-valid (skips input validation). */
  skipInputCheck?: boolean
}

/** Upgrade request. */
export interface SkillUpgradeInput {
  installationId: SkillInstallationId
  versionId: SkillVersionId
  /** Permissions re-confirmed by the user for the upgraded version. */
  permissions?: string[]
  /** Required when the upgrade widens tools/scope/triggers/model egress. */
  confirm?: boolean
  meta?: SkillMeta
}

/** One enriched catalog entry returned by {@link SkillsService.browse}. */
export interface SkillCatalogEntry extends Skill {
  /** Whether the skill is installed in the requested project. */
  installed: boolean
  /** Semantic version of the project's installed version, when installed. */
  installedVersion?: string
  /** Whether an installation of this skill is currently enabled. */
  active?: boolean
  /**
   * Derived: the project's installed version is older than the catalog version.
   * This is computed, never stored over the definition (SPEC §8: "update-available
   * 是已安装版本与目录版本比较的派生值，不是覆盖定义的状态").
   */
  updateAvailable: boolean
  /** A validated draft or a run in progress exists. */
  testing: boolean
  /** A published version of this skill has been revoked. */
  revoked: boolean
}

/** Catalog filter and paging request. */
export interface BrowseFilters {
  query?: string
  /** Built-in category; local drafts carry no category (contract gap, see report). */
  category?: string
  /** `builtin` | `local` | `published-local` | `draft` | `installed` | `my-drafts`. */
  source?: string
  status?: string
  /** Project whose installations drive `installed` / `update-available`. */
  projectId?: ProjectId
  /** Opaque cursor from a previous page. */
  cursor?: string
  limit?: number
}

/** Catalog page. */
export interface BrowseResult {
  items: SkillCatalogEntry[]
  nextCursor: string | null
  /** True total; never reported as zero when unknown (SPEC interfaces.md). */
  total: number
}

/** Skill audit actions (recorded through the shared AuditWriter). */
const SKILL_AUDIT = {
  saveDraft: 'skill.save_draft',
  validate: 'skill.validate',
  test: 'skill.test',
  publish: 'skill.publish',
  install: 'skill.install',
  enable: 'skill.enable',
  disable: 'skill.disable',
  uninstall: 'skill.uninstall',
  upgrade: 'skill.upgrade',
  revoke: 'skill.revoke',
  deleteDraft: 'skill.delete_draft',
} as const

/** Local state of an in-flight controlled test, before it is persisted. */
interface PendingTest {
  controller: AbortController
  skillId: SkillId
  skillVersionId: SkillVersionId
  input: unknown
  createdAt: string
}

/** Local skills and explicit project installations. */
export class SkillsService implements MedSkillsService {
  /** Typert Gateway binding for `medSkills/*`. */
  readonly typertRemote = bindTypertRemote(this, 'medSkills')

  private readonly options: SkillsServiceOptions
  private readonly audit: AuditWriter
  private readonly pending = new Map<SkillTestRunId, PendingTest>()

  constructor(options: SkillsServiceOptions) {
    this.options = options
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
  }

  /** Ensure the built-in catalog is available in the durable domain. */
  async seedBuiltins(): Promise<void> {
    for (const skill of BUILTIN_SKILLS) {
      if (this.options.storage.skills.get(skill.id) !== undefined) continue
      const errors = this.validateDefinition(skill.definition, { availableModels: this.options.availableModels })
      if (errors.length > 0) {
        throw new SkillError('SKILL_INVALID', `builtin ${skill.id} failed validation: ${errors.map(e => `${e.path}: ${e.message}`).join('; ')}`)
      }
      await this.options.storage.skills.put(skill.id, skill)
      const versionId = skillVersionIdOf(skill.id, skill.currentVersion)
      const version: SkillVersion = {
        id: versionId,
        skillId: skill.id,
        revision: skill.currentRevision,
        semanticVersion: skill.currentVersion,
        definition: skill.definition,
        status: 'PUBLISHED',
        createdAt: skill.updatedAt,
        publishedAt: skill.updatedAt,
      }
      await this.options.storage.skillVersions.put(version.id, version)
    }
  }

  /** Search built-in and locally authored definitions. */
  @Remote
  async catalog(query?: string): Promise<Skill[]> {
    await this.seedBuiltins()
    const all = [...this.options.storage.skills.entries()].map(([, skill]) => skill)
    const needle = query?.trim().toLowerCase() ?? ''
    return all.filter(skill => needle === '' || `${skill.definition.name} ${skill.definition.description}`.toLowerCase().includes(needle)).sort((left, right) => left.definition.name.localeCompare(right.definition.name))
  }

  /** Read one definition. */
  @Remote
  async get(id: SkillId): Promise<Skill | undefined> { await this.seedBuiltins(); return this.options.storage.skills.get(id) }

  /**
   * Browse the catalog with category/query/source/status filters and cursor
   * paging, distinguishing built-in, published-local, installed, and my drafts.
   * `update-available` is derived from the requested project's installed version.
   */
  @Remote
  async browse(filters: BrowseFilters = {}): Promise<BrowseResult> {
    await this.seedBuiltins()
    const projectId = filters.projectId
    const installs = projectId === undefined ? [] : [...this.options.storage.skillInstallations.entries()].map(([, i]) => i).filter(i => i.projectId === projectId)
    const needle = filters.query?.trim().toLowerCase() ?? ''

    const entries: SkillCatalogEntry[] = [...this.options.storage.skills.entries()].map(([, skill]) => skill).map((skill) => {
      const install = installs.find(i => i.skillId === skill.id)
      const installedVersion = install === undefined ? undefined : this.versionSemver(install.skillVersionId)
      const catalogSemver = skill.currentVersion
      const updateAvailable = install !== undefined && installedVersion !== undefined && compareSemver(catalogSemver, installedVersion) > 0
      const hasRevoked = [...this.options.storage.skillVersions.entries()].some(([, v]) => v.skillId === skill.id && v.status === 'REVOKED')
      const testing = skill.status === 'VALIDATED' || [...this.pending.values()].some(p => p.skillId === skill.id)
      return {
        ...skill,
        installed: install !== undefined,
        ...installedVersion === undefined ? {} : { installedVersion },
        ...install === undefined ? {} : { active: install.enabled },
        updateAvailable,
        testing,
        revoked: hasRevoked,
      }
    })

    const filtered = entries.filter((entry) => {
      if (needle !== '' && !`${entry.definition.name} ${entry.definition.description}`.toLowerCase().includes(needle)) return false
      if (filters.category !== undefined && categoryOf(entry.id) !== filters.category) return false
      if (filters.source !== undefined && !matchSource(filters.source, entry)) return false
      if (filters.status !== undefined && entry.status !== filters.status) return false
      return true
    }).sort((left, right) => left.definition.name.localeCompare(right.definition.name))

    const limit = filters.limit ?? 50
    const start = filters.cursor === undefined ? 0 : cursorIndex(filters.cursor)
    const page = filtered.slice(start, start + limit)
    const nextCursor = start + limit < filtered.length ? encodeCursor(start + limit) : null
    return { items: page, nextCursor, total: filtered.length }
  }

  /** Pure definition validation: returns field errors (empty when valid). */
  validateDefinition(definition: SkillDefinition, opts: { availableTools?: readonly string[] | undefined; availableModels?: readonly string[] | undefined; authorizedKnowledge?: readonly string[] | undefined } = {}): SkillFieldError[] {
    const resolved = {
      availableTools: opts.availableTools ?? this.options.availableTools,
      availableModels: opts.availableModels ?? this.options.availableModels,
      authorizedKnowledge: opts.authorizedKnowledge ?? this.options.authorizedKnowledge,
    }
    const errors: SkillFieldError[] = []
    if (!definition.name || definition.name.trim() === '') errors.push({ path: 'name', message: 'name is required' })
    if (!definition.description || definition.description.trim() === '') errors.push({ path: 'description', message: 'description is required' })
    if (!/^\d+\.\d+\.\d+$/u.test(definition.semanticVersion)) errors.push({ path: 'semanticVersion', message: 'must be a semantic version x.y.z' })
    if (!definition.instructions || definition.instructions.trim() === '') errors.push({ path: 'instructions', message: 'system instructions are required' })
    if (!Array.isArray(definition.tools) || definition.tools.length === 0) errors.push({ path: 'tools', message: 'at least one declared tool is required' })
    if (!Array.isArray(definition.triggers) || definition.triggers.length === 0) errors.push({ path: 'triggers', message: 'at least one trigger is required' })

    for (const key of ['inputSchema', 'outputSchema'] as const) {
      const schema = (definition as Record<string, unknown>)[key]
      if (schema === undefined || typeof schema !== 'object' || Array.isArray(schema)) {
        errors.push({ path: key, message: 'must be a JSON Schema 2020-12 object' })
        continue
      }
      const remote = collectRemoteRefs(schema)
      if (remote.length > 0) errors.push({ path: key, message: `remote $ref is rejected: ${remote.join(', ')}` })
    }

    if (resolved.availableTools !== undefined && resolved.availableTools.length > 0) {
      definition.tools.forEach((tool, index) => {
        if (!resolved.availableTools!.includes(tool)) errors.push({ path: `tools[${index}]`, message: `unknown tool '${tool}'` })
      })
    }
    if (definition.model !== undefined && resolved.availableModels !== undefined && resolved.availableModels.length > 0 && !resolved.availableModels.includes(definition.model)) {
      errors.push({ path: 'model', message: `model '${definition.model}' is not an available deployed model` })
    }
    if (resolved.authorizedKnowledge !== undefined && resolved.authorizedKnowledge.length > 0) {
      definition.knowledge.forEach((ref, index) => {
        if (!resolved.authorizedKnowledge!.includes(ref)) errors.push({ path: `knowledge[${index}]`, message: `knowledge '${ref}' is outside the authorized workspace scope` })
      })
    }

    definition.examples.forEach((example, index) => {
      for (const [slot, schema] of [['input', definition.inputSchema], ['output', definition.outputSchema]] as const) {
        const value = (example as Record<string, unknown>)[slot]
        for (const err of validateAgainstSchema(schema, value)) {
          errors.push({ path: `examples[${index}].${slot}${err.path}`, message: err.message })
        }
      }
    })
    return errors
  }

  /** Create or update a local draft by its definition name; preserves the draft on edit. */
  @Remote
  async saveDraft(definition: SkillDefinition, expectedRevision?: number, meta?: SkillMeta): Promise<Skill> {
    const existing = [...this.options.storage.skills.entries()].map(([, skill]) => skill).find(skill => skill.source === 'local' && skill.definition.name === definition.name)
    if (existing !== undefined) {
      if (expectedRevision !== undefined && existing.currentRevision !== expectedRevision) throw new SkillError('SKILL_INVALID', 'skill revision conflict')
      // Editing clears VALIDATED and test freshness: a new revision supersedes old ones.
      const updated: Skill = { ...existing, currentRevision: existing.currentRevision + 1, definition, status: 'DRAFT', updatedAt: this.options.now() }
      await this.options.storage.skills.put(updated.id, updated)
      await this.auditOp(SKILL_AUDIT.saveDraft, { actor: meta?.actor ?? this.options.defaultActor, skillId: updated.id, revision: updated.currentRevision }, undefined, meta?.sessionId)
      return updated
    }
    const skill: Skill = {
      id: this.options.newSkillId(),
      source: 'local',
      publisher: 'workspace',
      currentVersion: definition.semanticVersion,
      currentRevision: 1,
      definition,
      status: 'DRAFT',
      updatedAt: this.options.now(),
    }
    await this.options.storage.skills.put(skill.id, skill)
    await this.auditOp(SKILL_AUDIT.saveDraft, { actor: meta?.actor ?? this.options.defaultActor, skillId: skill.id, revision: skill.currentRevision }, undefined, meta?.sessionId)
    return skill
  }

  /** Validate the current definition; on failure preserves the draft and reports field errors. */
  @Remote
  async validate(id: SkillId, meta?: SkillMeta): Promise<SkillVersion> {
    const skill = this.require(id)
    const errors = this.validateDefinition(skill.definition, {
      availableTools: this.options.availableTools,
      availableModels: this.options.availableModels,
      authorizedKnowledge: this.options.authorizedKnowledge,
    })
    if (errors.length > 0) throw new SkillError('SKILL_INVALID', errors.map(e => `${e.path}: ${e.message}`).join('; '), errors)
    const version: SkillVersion = {
      id: this.options.newSkillVersionId(),
      skillId: id,
      revision: skill.currentRevision,
      semanticVersion: skill.definition.semanticVersion,
      definition: skill.definition,
      status: 'VALIDATED',
      createdAt: this.options.now(),
    }
    await this.options.storage.skillVersions.put(version.id, version)
    await this.options.storage.skills.put(id, { ...skill, status: 'VALIDATED', updatedAt: this.options.now() })
    await this.auditOp(SKILL_AUDIT.validate, { actor: meta?.actor ?? this.options.defaultActor, skillId: id, revision: skill.currentRevision, versionId: version.id }, undefined, meta?.sessionId)
    return version
  }

  /**
   * Run a validated definition in a temporary, non-activated registry. The run
   * writes only to the skill-test table and never touches production
   * Notes/Evidence/Drafts/installations (test isolation). The "active" badge in
   * the output marks the temporary test registry only, never production.
   */
  @Remote
  async test(id: SkillId, input: unknown, options?: SkillTestOptions): Promise<SkillTestRun> {
    const skill = this.require(id)
    const version = this.latestVersion(id, 'VALIDATED')
    if (version === undefined) throw new SkillError('SKILL_NOT_PUBLISHED', `skill ${id} needs a validated revision before testing`)

    const trace = version.definition.tools.map(tool => ({ tool, status: this.isAllowedTool(tool) ? ('allowed' as const) : ('denied' as const), ...this.isAllowedTool(tool) ? {} : { detail: 'tool is not in the deployment allowlist / Agent Mode' } }))
    const denied = trace.find(entry => entry.status === 'denied')
    const inputErrors: JsonSchemaError[] = options?.skipInputCheck ? [] : validateAgainstSchema(version.definition.inputSchema, input)

    if (inputErrors.length > 0 || denied !== undefined) {
      const run = this.finalizeTest(skill.id, version, trace, input, 'FAILED', inputErrors[0]?.message ?? `tool ${denied?.tool} is not allowed`)
      await this.auditOp(SKILL_AUDIT.test, { actor: options?.actor ?? this.options.defaultActor, skillId: skill.id, versionId: version.id, decision: 'failed', error: run.error }, undefined, options?.sessionId)
      return run
    }

    const runId = this.options.newTestRunId()
    const controller = new AbortController()
    this.pending.set(runId, { controller, skillId: skill.id, skillVersionId: version.id, input, createdAt: this.options.now() })
    const stages = ['input-schema', 'tool-resolution', 'controlled-execution']
    try {
      const output = await (this.options.testExecutor ?? defaultExecutor)({ signal: controller.signal, version, input })
      this.pending.delete(runId)
      if (controller.signal.aborted) {
        const run = this.finalizeTest(skill.id, version, trace, input, 'CANCELLED', 'test cancelled', stages)
        await this.auditOp(SKILL_AUDIT.test, { actor: options?.actor ?? this.options.defaultActor, skillId: skill.id, versionId: version.id, decision: 'cancelled', runId }, undefined, options?.sessionId)
        return run
      }
      const run = this.finalizeTest(skill.id, version, trace, input, 'SUCCEEDED', undefined, stages, {
        status: 'test-only',
        skill: skill.definition.name,
        activeBadge: 'test-only',
        executedTools: trace.filter(t => t.status === 'allowed').map(t => t.tool),
        stages,
        output,
      })
      await this.auditOp(SKILL_AUDIT.test, { actor: options?.actor ?? this.options.defaultActor, skillId: skill.id, versionId: version.id, decision: 'succeeded', runId }, undefined, options?.sessionId)
      return run
    } catch (error) {
      this.pending.delete(runId)
      if (controller.signal.aborted) {
        const run = this.finalizeTest(skill.id, version, trace, input, 'CANCELLED', 'test cancelled', stages)
        await this.auditOp(SKILL_AUDIT.test, { actor: options?.actor ?? this.options.defaultActor, skillId: skill.id, versionId: version.id, decision: 'cancelled', runId }, undefined, options?.sessionId)
        return run
      }
      const run = this.finalizeTest(skill.id, version, trace, input, 'FAILED', String(error))
      await this.auditOp(SKILL_AUDIT.test, { actor: options?.actor ?? this.options.defaultActor, skillId: skill.id, versionId: version.id, decision: 'failed', error: run.error }, undefined, options?.sessionId)
      return run
    }
  }

  /** Cancel an in-flight test run; releases the executor and clears pending state. */
  @Remote
  async cancelTest(runId: SkillTestRunId): Promise<SkillTestRun | undefined> {
    const pending = this.pending.get(runId)
    if (pending === undefined) return this.options.storage.skillTests.get(runId)
    pending.controller.abort()
    this.pending.delete(runId)
    // The aborted executor resolves test() into a CANCELLED, persisted run.
    return this.options.storage.skillTests.get(runId)
  }

  /** Ids of currently in-flight controlled test runs (for cancellation tests). */
  activeTestRunIds(): SkillTestRunId[] { return [...this.pending.keys()] }

  /** Publish after validation and a successful current-revision test; rejects duplicate version numbers. */
  @Remote
  async publish(id: SkillId, meta?: SkillMeta): Promise<SkillVersion> {
    const skill = this.require(id)
    const validated = this.versionsFor(id).find(item => item.revision === skill.currentRevision && item.status === 'VALIDATED')
    if (validated === undefined) throw new SkillError('SKILL_NOT_PUBLISHED', 'publish requires a validated current revision and a successful test')
    const successful = [...this.options.storage.skillTests.entries()].some(([, run]) => run.skillVersionId === validated.id && run.status === 'SUCCEEDED')
    if (!successful) throw new SkillError('SKILL_NOT_PUBLISHED', 'publish requires at least one successful test of the current input/output schema')

    const clash = this.versionsFor(id).find(item => item.status === 'PUBLISHED' && item.semanticVersion === validated.semanticVersion && JSON.stringify(item.definition) !== JSON.stringify(validated.definition))
    if (clash !== undefined) throw new SkillError('SKILL_VERSION_EXISTS', `version ${validated.semanticVersion} already exists with different content`)

    const published: SkillVersion = { ...validated, id: this.options.newSkillVersionId(), status: 'PUBLISHED', publishedAt: this.options.now() }
    await this.options.storage.skillVersions.put(published.id, published)
    await this.options.storage.skills.put(id, { ...skill, status: 'PUBLISHED', currentVersion: published.semanticVersion, updatedAt: this.options.now() })
    await this.auditOp(SKILL_AUDIT.publish, { actor: meta?.actor ?? this.options.defaultActor, skillId: id, sourceVersionId: validated.id, targetVersionId: published.id }, undefined, meta?.sessionId)
    return published
  }

  /** Install a published version; disabled by default unless explicitly enabled (joint install+enable allowed). */
  @Remote
  async install(input: { projectId: ProjectId; skillId: SkillId; versionId: SkillVersionId; enable?: boolean; permissions: string[] }, meta?: SkillMeta): Promise<SkillInstallation> {
    const version = this.options.storage.skillVersions.get(input.versionId)
    if (version === undefined || version.skillId !== input.skillId) throw new SkillError('SKILL_NOT_PUBLISHED', `skill version ${input.versionId} is not a version of ${input.skillId}`)
    if (version.status === 'REVOKED') throw new SkillError('SKILL_REVOKED', `skill version ${input.versionId} is revoked`)
    if (version.status !== 'PUBLISHED') throw new SkillError('SKILL_NOT_PUBLISHED', `skill version ${input.versionId} is not published`)
    const now = this.options.now()
    const installation: SkillInstallation = {
      id: this.options.newInstallationId(),
      projectId: input.projectId,
      skillId: input.skillId,
      skillVersionId: input.versionId,
      enabled: input.enable === true,
      permissions: [...input.permissions],
      createdAt: now,
      updatedAt: now,
    }
    await this.options.storage.skillInstallations.put(installation.id, installation)
    await this.auditOp(SKILL_AUDIT.install, {
      actor: meta?.actor ?? this.options.defaultActor,
      projectId: input.projectId,
      skillId: input.skillId,
      versionId: input.versionId,
      enabled: installation.enabled,
      permissions: installation.permissions,
      decision: installation.enabled ? 'install-and-enable' : 'install-disabled',
    }, input.projectId, meta?.sessionId)
    return installation
  }

  /** Enable or disable a single installation; disabling cancels in-flight calls. */
  @Remote
  async setEnabled(id: SkillInstallationId, enabled: boolean, meta?: SkillMeta): Promise<SkillInstallation> {
    const installation = this.options.storage.skillInstallations.get(id)
    if (installation === undefined) throw new SkillError('SKILL_INSTALLATION_NOT_FOUND', `no skill installation ${id}`)
    if (!enabled) this.cancelInFlight(installation.skillId)
    const updated = { ...installation, enabled, updatedAt: this.options.now() }
    await this.options.storage.skillInstallations.put(id, updated)
    await this.auditOp(enabled ? SKILL_AUDIT.enable : SKILL_AUDIT.disable, { actor: meta?.actor ?? this.options.defaultActor, projectId: installation.projectId, skillId: installation.skillId, installationId: id }, installation.projectId, meta?.sessionId)
    return updated
  }

  /** Remove an installation while preserving its definition and version history. */
  @Remote
  async uninstall(id: SkillInstallationId, meta?: SkillMeta): Promise<void> {
    const installation = this.options.storage.skillInstallations.get(id)
    if (installation === undefined) throw new SkillError('SKILL_INSTALLATION_NOT_FOUND', `no skill installation ${id}`)
    await this.options.storage.skillInstallations.delete(id)
    await this.auditOp(SKILL_AUDIT.uninstall, { actor: meta?.actor ?? this.options.defaultActor, projectId: installation.projectId, skillId: installation.skillId, installationId: id }, installation.projectId, meta?.sessionId)
  }

  /**
   * Upgrade an installation to a newer published version. Adding tools, widening
   * the knowledge/file scope, adding automatic triggers, or widening model egress
   * requires explicit `confirm`; until then the old version keeps its ACTIVE/DISABLED
   * state. On success the version and permissions switch atomically, preserving enabled.
   */
  @Remote
  async upgrade(input: SkillUpgradeInput): Promise<SkillInstallation> {
    const installation = this.options.storage.skillInstallations.get(input.installationId)
    if (installation === undefined) throw new SkillError('SKILL_INSTALLATION_NOT_FOUND', `no skill installation ${input.installationId}`)
    const target = this.options.storage.skillVersions.get(input.versionId)
    if (target === undefined || target.skillId !== installation.skillId) throw new SkillError('SKILL_NOT_PUBLISHED', `version ${input.versionId} is not a version of ${installation.skillId}`)
    if (target.status === 'REVOKED') throw new SkillError('SKILL_REVOKED', `skill version ${input.versionId} is revoked`)
    if (target.status !== 'PUBLISHED') throw new SkillError('SKILL_NOT_PUBLISHED', `skill version ${input.versionId} is not published`)
    const current = this.options.storage.skillVersions.get(installation.skillVersionId)
    const widening = current === undefined ? [] : this.computeWidening(current.definition, target.definition)
    if (widening.length > 0 && input.confirm !== true) {
      throw new SkillError('SKILL_RECONFIRM_REQUIRED', `upgrade widens permissions: ${widening.join(', ')} — explicit confirmation required`)
    }
    const updated: SkillInstallation = {
      ...installation,
      skillVersionId: target.id,
      permissions: input.permissions ?? installation.permissions,
      updatedAt: this.options.now(),
    }
    await this.options.storage.skillInstallations.put(updated.id, updated)
    await this.auditOp(SKILL_AUDIT.upgrade, {
      actor: input.meta?.actor ?? this.options.defaultActor,
      projectId: installation.projectId,
      skillId: installation.skillId,
      sourceVersion: current?.semanticVersion,
      targetVersion: target.semanticVersion,
      widened: widening,
      permissionDiff: { before: installation.permissions, after: updated.permissions },
      decision: widening.length > 0 ? 'reconfirmed' : 'auto',
      installationId: updated.id,
    }, installation.projectId, input.meta?.sessionId)
    return updated
  }

  /**
   * Revoke a published version: blocks new installation and new invocation,
   * cancels in-flight test runs, and keeps version history intact.
   */
  @Remote
  async revoke(versionId: SkillVersionId, meta?: SkillMeta): Promise<SkillVersion> {
    const version = this.options.storage.skillVersions.get(versionId)
    if (version === undefined) throw new SkillError('SKILL_NOT_FOUND', `no skill version ${versionId}`)
    if (version.status === 'REVOKED') throw new SkillError('SKILL_REVOKED', `skill version ${versionId} is already revoked`)
    const revoked: SkillVersion = { ...version, status: 'REVOKED', revokedAt: this.options.now() }
    await this.options.storage.skillVersions.put(revoked.id, revoked)
    this.cancelInFlight(version.skillId, version.id)
    await this.auditOp(SKILL_AUDIT.revoke, { actor: meta?.actor ?? this.options.defaultActor, skillId: version.skillId, versionId: version.id, decision: 'revoked' }, undefined, meta?.sessionId)
    return revoked
  }

  /** Delete a local draft; never deletes published version history. */
  @Remote
  async deleteDraft(id: SkillId, meta?: SkillMeta): Promise<void> {
    const skill = this.require(id)
    if (skill.source !== 'local') throw new SkillError('SKILL_INVALID', 'only local drafts can be deleted')
    await this.options.storage.skills.delete(id)
    await this.auditOp(SKILL_AUDIT.deleteDraft, { actor: meta?.actor ?? this.options.defaultActor, skillId: id, preservedVersions: this.versionsFor(id).length }, undefined, meta?.sessionId)
  }

  /** Effective permission = declared tools ∩ installation approval ∩ allowlist ∩ deployment policy. */
  effectivePermissions(installationId: SkillInstallationId): string[] {
    const installation = this.options.storage.skillInstallations.get(installationId)
    if (installation === undefined) throw new SkillError('SKILL_INSTALLATION_NOT_FOUND', `no skill installation ${installationId}`)
    const version = this.options.storage.skillVersions.get(installation.skillVersionId)
    if (version === undefined) return []
    return version.definition.tools.filter(tool => installation.permissions.includes(tool) && this.isAllowedTool(tool))
  }

  /** Read one installation (test/inspection helper). */
  installation(id: SkillInstallationId): SkillInstallation | undefined { return this.options.storage.skillInstallations.get(id) }
  /** Read one version (test/inspection helper). */
  version(id: SkillVersionId): SkillVersion | undefined { return this.options.storage.skillVersions.get(id) }
  /** All versions of a skill (test/inspection helper). */
  versions(id: SkillId): SkillVersion[] { return this.versionsFor(id) }
  /** All recorded audit rows (test/inspection helper). */
  auditRows(): AuditLog[] { return [...this.options.storage.auditLogs.entries()].map(([, row]) => row) }
  /** Size of a storage table (test isolation helper). */
  tableSize(name: 'skillTests' | 'drafts' | 'evidences' | 'notes' | 'skillInstallations'): number {
    switch (name) {
      case 'skillTests': return this.options.storage.skillTests.size
      case 'drafts': return this.options.storage.drafts.size
      case 'evidences': return this.options.storage.evidences.size
      case 'notes': return this.options.storage.notes.size
      case 'skillInstallations': return this.options.storage.skillInstallations.size
    }
  }

  /** Whether an installation may currently be invoked (installed, enabled, version not revoked). */
  isInvocationAllowed(installationId: SkillInstallationId): boolean {
    const installation = this.options.storage.skillInstallations.get(installationId)
    if (installation === undefined || !installation.enabled) return false
    const version = this.options.storage.skillVersions.get(installation.skillVersionId)
    return version !== undefined && version.status !== 'REVOKED'
  }

  private require(id: SkillId): Skill { const skill = this.options.storage.skills.get(id); if (skill === undefined) throw new SkillError('SKILL_NOT_FOUND', `no skill ${id}`); return skill }
  private isAllowedTool(name: string): boolean { return this.options.availableTools === undefined || this.options.availableTools.length === 0 || this.options.availableTools.includes(name) }

  private versionsFor(id: SkillId): SkillVersion[] {
    return [...this.options.storage.skillVersions.entries()].map(([, item]) => item).filter(item => item.skillId === id)
  }

  private latestVersion(id: SkillId, status: SkillVersion['status']): SkillVersion | undefined {
    return this.versionsFor(id).filter(item => item.status === status).sort((left, right) => right.revision - left.revision)[0]
  }

  private versionSemver(versionId: SkillVersionId): string | undefined {
    return this.options.storage.skillVersions.get(versionId)?.semanticVersion
  }

  private computeWidening(before: SkillDefinition, after: SkillDefinition): string[] {
    const widening: string[] = []
    const newTools = after.tools.filter(tool => !before.tools.includes(tool))
    if (newTools.length > 0) widening.push(`tools(+${newTools.join(',')})`)
    const newKnowledge = after.knowledge.filter(ref => !before.knowledge.includes(ref))
    if (newKnowledge.length > 0) widening.push(`file-scope(+${newKnowledge.join(',')})`)
    const newTriggers = after.triggers.filter(trigger => trigger !== 'explicit' && !before.triggers.includes(trigger))
    if (newTriggers.length > 0) widening.push(`automatic-triggers(+${newTriggers.join(',')})`)
    if (after.model !== before.model) widening.push('model-egress')
    return widening
  }

  private cancelInFlight(skillId: SkillId, versionId?: SkillVersionId): void {
    // Controlled tests are cancelled by aborting their pending executor; the
    // run resolves to CANCELLED and is persisted by test(). The temporary
    // registry never holds a RUNNING record, so no storage scan is needed.
    for (const [runId, pending] of this.pending) {
      if (pending.skillId !== skillId) continue
      if (versionId !== undefined && pending.skillVersionId !== versionId) continue
      pending.controller.abort()
      this.pending.delete(runId)
    }
  }

  private finalizeTest(skillId: SkillId, version: SkillVersion, trace: SkillTestRun['trace'], input: unknown, status: SkillTestRun['status'], error?: string, stages?: string[], output?: unknown): SkillTestRun {
    const run: SkillTestRun = {
      id: this.options.newTestRunId(),
      skillId,
      skillVersionId: version.id,
      status,
      input,
      trace,
      ...error === undefined ? {} : { error },
      ...output === undefined ? {} : { output },
      createdAt: this.options.now(),
      finishedAt: this.options.now(),
    }
    void this.options.storage.skillTests.put(run.id, run)
    return run
  }

  private async auditOp(action: AuditAction, detail: Record<string, unknown>, projectId?: ProjectId, sessionId?: string): Promise<AuditLog> {
    return this.audit.append({
      action,
      ...projectId === undefined ? {} : { projectId },
      ...sessionId === undefined ? {} : { sessionId },
      detail,
    })
  }
}

/** Default controlled-execution body: deterministic, isolated, no external side effects. */
const defaultExecutor: SkillTestExecutor = async () => ({ note: 'controlled test produced a deterministic test-only output' })

/** Build a stable skill version id from a skill id and semantic version. */
function skillVersionIdOf(skillId: SkillId, semver: string): SkillVersionId {
  return `${skillId}@${semver}` as SkillVersionId
}

/** Built-in category lookup (contract gap: `SkillDefinition` has no `category`). */
function categoryOf(id: SkillId): string | undefined {
  return BUILTIN_CATEGORY[id as string]
}

/** Match the `source` browse filter against one entry. */
function matchSource(source: string, entry: SkillCatalogEntry): boolean {
  switch (source) {
    case 'builtin': return entry.source === 'builtin'
    case 'local': return entry.source === 'local'
    case 'published-local': return entry.source === 'local' && entry.status === 'PUBLISHED'
    case 'draft': return entry.status === 'DRAFT'
    case 'my-drafts': return entry.source === 'local' && entry.status === 'DRAFT'
    case 'installed': return entry.installed
    default: return true
  }
}

/** Compare two semantic versions: >0 when `left` is newer. */
function compareSemver(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Opaque cursor helpers (stable index, not a count claim). */
function encodeCursor(index: number): string { return Buffer.from(String(index), 'utf8').toString('base64url') }
function cursorIndex(cursor: string): number { const value = Number(Buffer.from(cursor, 'base64url').toString('utf8')); return Number.isFinite(value) ? value : 0 }
