/**
 * REAL-composition coverage for the Med Research plugins (packages/AGENTS.md
 * "Product-visible plugins require a non-unit REAL-composition test"). A
 * test-only `cordis.yml` boots the vendored Loader with the real storage hub,
 * SQLite backend, domain form, local filesystem, session persistence,
 * workspace registry, human-command registry, tool runtime, and web capability,
 * plus every med plugin. Booting at all proves the single-flight storage handle
 * holds under concurrent plugin apply; the assertions then read the composed
 * services, the registered tools, the artifact download route, the backup
 * commands, a real project create, and real Tool-registry dispatch.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageSqlite from '@deepseek-ai/dsh-storage-sqlite'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import Commands from '@deepseek-ai/dsh-commands'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as WebFetchHttp from '@deepseek-ai/dsh-web-fetch-http'
import * as MedRunner from '@medresearch/dsh-medical-runner-container'
import * as MedProject from '@medresearch/dsh-plugin-project'
import { MED_EXPORT_COMMAND, MED_IMPORT_COMMAND } from '@medresearch/dsh-plugin-project'
import * as MedDataset from '@medresearch/dsh-plugin-dataset'
import * as MedArtifact from '@medresearch/dsh-plugin-artifact'
import * as MedEvidence from '@medresearch/dsh-plugin-evidence'
import * as MedStatistics from '@medresearch/dsh-plugin-statistics'
import * as MedFulltext from '@medresearch/dsh-plugin-fulltext'
import * as MedLiterature from '@medresearch/dsh-plugin-literature'
import * as MedPaper from '@medresearch/dsh-plugin-paper'
import * as MedKnowledge from '@medresearch/dsh-plugin-knowledge'
import * as MedSkills from '@medresearch/dsh-plugin-skills'
import * as MedWriting from '@medresearch/dsh-plugin-writing'
import { MED_ARTIFACT_EXPORT_PATH } from '@medresearch/dsh-medical-contracts'
import { MED_TOOL_NAMES } from '@medresearch/dsh-plugin-medical-ui/src/client/tool-names.ts'

/** Tool names the composed plugins must register (SPEC §6). */
const EXPECTED_TOOLS = [
  'project_create', 'project_get', 'project_get_context', 'project_save_paper',
  'literature_plan_query', 'literature_search_pubmed', 'literature_get_paper',
  'paper_get', 'paper_get_document', 'paper_resolve_fulltext', 'paper_search_content', 'paper_summary', 'paper_translate', 'paper_note_create', 'paper_note_list',
  'evidence_retrieve', 'evidence_verify', 'evidence_save', 'evidence_list_for_claim', 'evidence_claim_gate', 'evidence_citation_map', 'evidence_compare', 'evidence_withdraw', 'evidence_chase',
  'dataset_profile', 'dataset_get_schema', 'dataset_preview', 'dataset_list',
  'statistics_plan', 'statistics_generate_code', 'statistics_execute', 'statistics_approve_code', 'statistics_list_runs',
  'knowledge_list_papers', 'knowledge_search', 'knowledge_create_tag', 'knowledge_create_draft', 'knowledge_get_draft', 'knowledge_rag', 'knowledge_draft_invalidate',
  'skill_catalog', 'skill_get', 'skill_test', 'skill_install',
  'writing_generate', 'writing_validate', 'writing_translate', 'writing_export',
  'artifact_get', 'artifact_export',
]

/** Services the composition must provide. */
const EXPECTED_SERVICES = [
  'medRunner', 'medProjects', 'medDatasets', 'medArtifacts', 'medEvidence',
  'medStatistics', 'medFulltext', 'medLiterature', 'medPapers', 'medKnowledge', 'medSkills', 'medWriting',
]

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
  root = undefined
  registeredRoutes.length = 0
})

/** Exact Fetch routes the artifact plugin registers in this composition. */
const registeredRoutes: string[] = []

/** Minimal browser channel: retains the routes a Web-only plugin registers. */
const ConnectionStub = {
  name: 'connection-stub',
  apply(ctx: Context): void {
    ctx.provide('connection', {
      fetch: {
        register(route: { readonly path: string }) {
          registeredRoutes.push(route.path)
          return async () => { registeredRoutes.splice(registeredRoutes.indexOf(route.path), 1) }
        },
      },
    } as never)
  },
}

/** Write the composition file and boot it through the real Loader. */
async function compose(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'med-composition-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-sqlite'",
    '  config:',
    `    path: ${join(root, 'storage.db')}`,
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: sqlite',
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-web'",
    "- name: '@deepseek-ai/dsh-web-fetch-http'",
    "- name: '@deepseek-ai/dsh-fs-local'",
    '  config:',
    `    cwd: ${root}`,
    "- name: '@deepseek-ai/dsh-session-persistence-jsonl'",
    '  config:',
    `    root: ${join(root, 'sessions')}`,
    "- name: '@deepseek-ai/dsh-workspace'",
    "- name: '@deepseek-ai/dsh-commands'",
    "- name: 'connection-stub'",
    "- name: '@medresearch/dsh-medical-runner-container'",
    "- name: '@medresearch/dsh-plugin-project'",
    '  config:',
    `    workspaceRoot: ${join(root, 'workspaces')}`,
    "- name: '@medresearch/dsh-plugin-dataset'",
    "- name: '@medresearch/dsh-plugin-artifact'",
    '  config:',
    `    artifactRoot: ${join(root, 'artifacts')}`,
    "- name: '@medresearch/dsh-plugin-evidence'",
    "- name: '@medresearch/dsh-plugin-statistics'",
    '  config:',
    `    artifactRoot: ${join(root, 'artifacts')}`,
    "- name: '@medresearch/dsh-plugin-fulltext'",
    "- name: '@medresearch/dsh-plugin-literature'",
    '  config:',
    '    tool: med-research-test',
    '    email: med-research@example.com',
    "- name: '@medresearch/dsh-plugin-paper'",
    "- name: '@medresearch/dsh-plugin-knowledge'",
    "- name: '@medresearch/dsh-plugin-skills'",
    "- name: '@medresearch/dsh-plugin-writing'",
    '',
  ].join('\n'))

  const ctx = new Context()
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-storage', Storage],
    ['@deepseek-ai/dsh-storage-sqlite', StorageSqlite],
    ['@deepseek-ai/dsh-storage-domain', StorageDomain],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-web', WebRuntime],
    ['@deepseek-ai/dsh-web-fetch-http', WebFetchHttp],
    ['@deepseek-ai/dsh-fs-local', LocalFileSystem],
    ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlSessionPersistence],
    ['@deepseek-ai/dsh-workspace', WorkspaceRegistry],
    ['@deepseek-ai/dsh-commands', Commands],
    ['connection-stub', ConnectionStub],
    ['@medresearch/dsh-medical-runner-container', MedRunner],
    ['@medresearch/dsh-plugin-project', MedProject],
    ['@medresearch/dsh-plugin-dataset', MedDataset],
    ['@medresearch/dsh-plugin-artifact', MedArtifact],
    ['@medresearch/dsh-plugin-evidence', MedEvidence],
    ['@medresearch/dsh-plugin-statistics', MedStatistics],
    ['@medresearch/dsh-plugin-fulltext', MedFulltext],
    ['@medresearch/dsh-plugin-literature', MedLiterature],
    ['@medresearch/dsh-plugin-paper', MedPaper],
    ['@medresearch/dsh-plugin-knowledge', MedKnowledge],
    ['@medresearch/dsh-plugin-skills', MedSkills],
    ['@medresearch/dsh-plugin-writing', MedWriting],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      const module = modules.get(specifier)
      if (module === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return module
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  context = ctx
  return ctx
}

describe('med plugin real composition (SPEC §4.2, §5)', () => {
  it('boots every med plugin over one shared storage domain set and registers their tools', async () => {
    const ctx = await compose()

    for (const service of EXPECTED_SERVICES) {
      expect(ctx.get(service), service).toBeDefined()
    }
    const names = ctx.tools.schemas().map(schema => schema.name)
    for (const tool of EXPECTED_TOOLS) {
      expect(names, tool).toContain(tool)
    }
    // A Web composition registers the artifact download route (SPEC §30).
    expect(registeredRoutes).toContain(MED_ARTIFACT_EXPORT_PATH)
    // Every composed med tool must have a client Tool card (SPEC §6).
    const carded = names.filter(name => (MED_TOOL_NAMES as readonly string[]).includes(name)).sort()
    expect(carded).toEqual([...EXPECTED_TOOLS].sort())
  })

  it('carries every required Reader and Draft-editor contribution (interfaces.md)', async () => {
    const ctx = await compose()
    // A V1 profile without the required contributions is not V1: the registry
    // must report nothing missing once every plugin has applied.
    expect(ctx.medReaderActions.missing()).toEqual([])
    expect(ctx.medDraftEditorActions.missing()).toEqual([])
    expect(ctx.medReaderActions.ids()).toEqual([
      'reader.copy-citation', 'reader.open-source', 'reader.reference-chase',
      'reader.save-evidence', 'reader.save-note', 'reader.translate-selection',
    ])
    expect(ctx.medDraftEditorActions.ids()).toEqual([
      'draft.export', 'draft.generate', 'draft.translate', 'draft.validate',
    ])
  })

  it('serves a composed service call over the shared storage', async () => {
    const ctx = await compose()
    const csv = join(root!, 'cohort.csv')
    await writeFile(csv, [
      'treatment,ponv,age',
      'drug_a,1,54', 'drug_a,0,61', 'drug_b,1,49', 'drug_b,0,58',
      '',
    ].join('\n'))
    const dataset = await ctx.medDatasets.upload({ projectId: 'project-1' as never, fileRef: csv })
    expect(dataset.rowCount).toBe(4)

    const run = await ctx.medStatistics.plan({
      projectId: 'project-1' as never,
      datasetId: dataset.id,
      question: 'Does PONV differ by treatment?',
      plan: {
        objective: 'Compare PONV incidence by treatment',
        exposures: ['treatment'],
        covariates: [],
        steps: [{ id: 's1', method: 'chi-square', reason: 'categorical comparison', variables: ['treatment', 'ponv'] }],
        assumptions: [],
        warnings: [],
      },
    })
    expect(run.status).toBe('planned')
    // The synchronous read is not part of the Remote surface; it proves the
    // composed service reads back what it wrote through the shared handle.
    expect(ctx.medStatistics.peekRun(run.id)?.id).toBe(run.id)

    // Gate 5 in the real composition: the statistics plugin must see the
    // artifact registrar even though both plugins apply concurrently.
    const approved = await ctx.medStatistics.generateCode(run.id, [
      'import csv, json, os',
      'rows = list(csv.DictReader(open(os.environ["MED_DATASET_PATH"])))',
      'json.dump({"n": len(rows)}, open("result.json", "w"))',
      'open("summary.txt", "w").write("n=" + str(len(rows)))',
      'print("done")',
      '',
    ].join('\n'))
    expect(approved.status).toBe('waiting_approval')
    await ctx.medStatistics.approveCode(run.id)
    const result = await ctx.medStatistics.execute({ analysisRunId: run.id, datasetPath: csv })
    expect(result.status).toBe('succeeded')
    expect(result.resultJson).toEqual({ n: 4 })
    const finished = ctx.medStatistics.peekRun(run.id)
    expect(finished?.artifactIds ?? []).toHaveLength(1)
    expect(await ctx.medArtifacts.get(finished!.artifactIds![0]!)).toMatchObject({ analysisRunId: run.id })
  })

  it('creates a project through the composed fs and workspace services', async () => {
    const ctx = await compose()
    const project = await ctx.medProjects.create({ name: 'Composition project', researchQuestion: 'Does PONV differ?' })
    expect(project.workspacePath.startsWith(join(root!, 'workspaces'))).toBe(true)
    expect(await ctx.medProjects.list()).toHaveLength(1)
    // The on-disk mirror is written through the real fs service, and the
    // directory is registered as a DSH workspace.
    const mirror = JSON.parse(await readFile(join(project.workspacePath, '.medresearch', 'project.json'), 'utf8')) as {
      schemaVersion: number
      project: { id: string }
    }
    expect(mirror).toMatchObject({ schemaVersion: 1, project: { id: project.id } })
    // The workspace path is canonicalized (macOS /var → /private/var), so the
    // title is the stable join key here.
    expect(ctx.workspaceRegistry.list().some(workspace => workspace.title === 'Composition project')).toBe(true)
  })

  it('registers the backup commands and round-trips the store through the real fs', async () => {
    const ctx = await compose()
    // A plain object is a valid scope key; these commands are context-global.
    const scope = {} as never
    const listed = ctx.commands.list(scope).map(command => command.name)
    expect(listed).toContain(MED_EXPORT_COMMAND)
    expect(listed).toContain(MED_IMPORT_COMMAND)

    const project = await ctx.medProjects.create({ name: 'Backup project' })
    const file = join(root!, 'backups', 'med.json')
    const exportCommand = ctx.commands.find(scope, MED_EXPORT_COMMAND)
    const importCommand = ctx.commands.find(scope, MED_IMPORT_COMMAND)
    expect(exportCommand).toBeDefined()
    expect(importCommand).toBeDefined()

    const exported = await exportCommand!.handler({ rawInput: file } as never)
    // The reported counts must match the bundle actually written: the project
    // record, the audit row its creation appended, and the built-in skill
    // catalog the skills plugin seeds during apply. Deriving the count from the
    // file keeps this from silently passing when a seeded domain disappears.
    const bundle = JSON.parse(await readFile(file, 'utf8')) as {
      format: string
      domains: Array<{ name: string; tables: Record<string, Record<string, unknown>> }>
    }
    const records = bundle.domains.reduce(
      (total, domain) => total + Object.values(domain.tables).reduce((count, table) => count + Object.keys(table).length, 0),
      0,
    )
    expect(exported).toEqual({ kind: 'success', text: `Exported ${bundle.domains.length} domains / ${records} records to ${file}` })
    expect(bundle).toMatchObject({ format: 'medresearch.export' })
    expect(records).toBeGreaterThan(1)
    expect(JSON.stringify(bundle)).toContain(project.id)

    // Deleting the record proves the import writes instead of reporting a
    // no-op success over data that was already present.
    await ctx.medProjects.delete(project.id)
    expect(await ctx.medProjects.get(project.id)).toBeUndefined()
    const imported = await importCommand!.handler({ rawInput: file } as never)
    expect(imported).toMatchObject({ kind: 'success' })
    expect(await ctx.medProjects.get(project.id)).toMatchObject({ id: project.id, name: 'Backup project' })
  })

  it('runs the project tools through the real Tool runtime and binds the session (SPEC §41)', async () => {
    const ctx = await compose()
    // The Tool registry only reads `agent.id`; the scope layers treat it as an
    // opaque key, so a minimal session-backed agent is enough here.
    const agent = { id: 'session-composition' } as never
    const signal = new AbortController().signal

    const created = await ctx.tools.execute({
      callId: 'call-create' as never,
      name: 'project_create',
      arguments: { name: 'Composed project', researchQuestion: 'Does PONV differ?' },
      agent,
      signal,
    })
    expect(created.isError).toBe(false)
    const projectId = (created.value as { result: { id: string } }).result.id
    expect(await ctx.medProjects.sessionProject('session-composition')).toMatchObject({ projectId })

    // The second call omits projectId: the registry-validated arguments reach
    // the tool, which resolves the project through the binding written above.
    const context = await ctx.tools.execute({
      callId: 'call-context' as never,
      name: 'project_get_context',
      arguments: {},
      agent,
      signal,
    })
    expect(context.isError).toBe(false)
    expect(context.value).toMatchObject({ ok: true, result: { project: { id: projectId } } })

    // Live models express "omitted" as an empty string; that must resolve too.
    const empty = await ctx.tools.execute({
      callId: 'call-empty' as never,
      name: 'project_get_context',
      arguments: { projectId: '' },
      agent,
      signal,
    })
    expect(empty.isError).toBe(false)
    expect(empty.value).toMatchObject({ ok: true, result: { project: { id: projectId } } })

    // A session with no binding gets the honest envelope, not a guess.
    const unbound = await ctx.tools.execute({
      callId: 'call-unbound' as never,
      name: 'project_get_context',
      arguments: {},
      agent: { id: 'session-unbound' } as never,
      signal,
    })
    expect(unbound.isError).toBe(false)
    expect(unbound.value).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_BOUND' } })

    // The declared schema is enforced before dispatch: project_get requires an id.
    const invalid = await ctx.tools.execute({
      callId: 'call-invalid' as never,
      name: 'project_get',
      arguments: {},
      agent,
      signal,
    })
    expect(invalid.isError).toBe(true)

    // SPEC §40: statistics_execute fails closed when no approval channel exists,
    // so the pre-execute policy is wired in the composed profile, not only unit-tested.
    const denied = await ctx.tools.execute({
      callId: 'call-execute' as never,
      name: 'statistics_execute',
      arguments: { analysisRunId: 'run-1', datasetPath: '/tmp/none.csv' },
      agent,
      signal,
    })
    expect(denied.isError).toBe(true)
    expect(JSON.stringify(denied.content)).toContain('approve this single execution')
  })

  it('returns the declared envelope for every offline-safe tool (SPEC §6, §46)', async () => {
    const ctx = await compose()
    const agent = { id: 'session-matrix' } as never
    const signal = new AbortController().signal
    const dispatch = (name: string, args: unknown): Promise<{ isError: boolean; value?: unknown }> =>
      ctx.tools.execute({ callId: `call-${name}` as never, name, arguments: args, agent, signal })

    const plan = {
      objective: 'Estimate an association',
      exposures: [],
      covariates: [],
      steps: [],
      assumptions: [],
      warnings: [],
    }
    // Each entry names a real domain failure the tool must surface as a value.
    const failures: ReadonlyArray<readonly [string, unknown, string]> = [
      ['project_get', { projectId: 'missing' }, 'PROJECT_NOT_FOUND'],
      ['project_get_context', { projectId: 'missing' }, 'PROJECT_NOT_FOUND'],
      ['project_save_paper', { projectId: 'missing', paperId: 'missing' }, 'PROJECT_NOT_FOUND'],
      ['paper_get', { paperId: 'missing' }, 'PAPER_NOT_FOUND'],
      ['paper_get_document', { paperId: 'missing' }, 'PAPER_NOT_FOUND'],
      ['paper_resolve_fulltext', { paperId: 'missing' }, 'PAPER_NOT_FOUND'],
      ['paper_search_content', { paperId: 'missing', query: 'x' }, 'PAPER_NOT_FOUND'],
      ['evidence_save', {
        projectId: 'missing',
        paragraphId: 'missing',
        quote: 'q',
        relation: 'SUPPORT',
        extractorVersion: 'v1',
        extractorModel: 'model',
        promptVersion: 'p1',
      }, 'PROJECT_NOT_FOUND'],
      ['evidence_verify', { evidenceId: 'missing', verdict: 'VERIFIED' }, 'EVIDENCE_NOT_FOUND'],
      ['dataset_profile', { projectId: 'missing', fileRef: '/nonexistent.csv' }, 'DATASET_PARSE_FAILED'],
      ['dataset_get_schema', { datasetId: 'missing' }, 'DATASET_NOT_FOUND'],
      ['artifact_get', { artifactId: 'missing' }, 'ARTIFACT_NOT_FOUND'],
      ['artifact_export', { artifactId: 'missing', format: 'csv' }, 'ARTIFACT_NOT_FOUND'],
    ]
    for (const [name, args, code] of failures) {
      const result = await dispatch(name, args)
      expect(result.isError, name).toBe(false)
      expect(result.value, name).toMatchObject({ ok: false, error: { code } })
    }

    // Project scope is checked before the referenced object, so an existing
    // project with an unknown paragraph reports the paragraph, not the project.
    const scopeProject = await ctx.medProjects.create({ name: 'Envelope scope project' })
    const dangling = await dispatch('evidence_save', {
      projectId: scopeProject.id,
      paragraphId: 'missing',
      quote: 'q',
      relation: 'SUPPORT',
      extractorVersion: 'v1',
      extractorModel: 'model',
      promptVersion: 'p1',
    })
    expect(dangling.isError).toBe(false)
    expect(dangling.value).toMatchObject({ ok: false, error: { code: 'PARAGRAPH_NOT_FOUND' } })

    // Reads that legitimately have nothing to return still answer `ok: true`.
    const empties: ReadonlyArray<readonly [string, unknown]> = [
      ['evidence_retrieve', { projectId: 'missing', claimText: 'x', conceptTerms: ['y'] }],
      ['evidence_list_for_claim', { claimId: 'missing' }],
    ]
    for (const [name, args] of empties) {
      const result = await dispatch(name, args)
      expect(result.isError, name).toBe(false)
      expect(result.value, name).toEqual({ ok: true, result: [] })
    }

    // Planning failures use the same machine-readable envelope as every other
    // Med tool; an unknown id is not an empty success or a registry exception.
    for (const [name, args, code] of [
      ['statistics_plan', { projectId: 'missing', datasetId: 'missing', question: 'q', plan }, 'DATASET_NOT_FOUND'],
      ['statistics_generate_code', { analysisRunId: 'missing', code: 'print(1)' }, 'STATISTICS_PLAN_INVALID'],
    ] as const) {
      const result = await dispatch(name, args)
      expect(result.isError, name).toBe(false)
      expect(result.value, name).toMatchObject({
        ok: false,
        error: {
          code,
          message: expect.any(String),
          retryable: false,
          partialDataAvailable: false,
          source: 'statistics',
        },
      })
    }
  })
})
