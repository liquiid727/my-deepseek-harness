/**
 * Model-facing `project_*` tools (SPEC §6, §31). Every tool validates its
 * model-supplied arguments, calls {@link ProjectsService}, and returns the
 * shared `{ ok, result | error }` envelope.
 * @module @medresearch/dsh-plugin-project/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  asToolJson,
  paperIdSchema,
  projectIdSchema,
  renderToolEnvelope,
  TOOL_ENVELOPE_SCHEMA,
  type DomainError,
} from '@medresearch/dsh-medical-contracts'
import { ProjectError, type ProjectsService } from './service.ts'

/** Map a project failure to the shared {@link DomainError} shape. */
function toDomainError(error: ProjectError): DomainError {
  return {
    code: error.code,
    message: error.message,
    retryable: false,
    partialDataAvailable: false,
    source: 'project',
  }
}

/**
 * Build the four project tools bound to one service.
 * @param service - The project service implementation.
 * @returns tool definitions ready for `ctx.tools.register`.
 */
export function projectTools(service: ProjectsService): ToolDefinition[] {
  return [
    defineTool({
      name: 'project_create',
      description:
        'Create a Med Research project. Creates the project directory, writes '
        + '<workspace>/.medresearch/project.json, registers the directory as a DSH workspace, '
        + 'and stores the project record. Returns the project as machine-readable JSON.',
      parameters: {
        name: { type: 'string', required: true, description: 'Project name.' },
        researchQuestion: { type: 'string', description: 'The research question, in the user\'s language.' },
        background: { type: 'string', description: 'Background context.' },
        population: { type: 'string', description: 'PICO population.' },
        interventionOrExposure: { type: 'string', description: 'PICO intervention or exposure.' },
        comparison: { type: 'string', description: 'PICO comparison.' },
        outcome: { type: 'string', description: 'PICO outcome.' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'Search keywords.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args, exec) {
        const project = await service.create({
          name: args.name,
          ...args.researchQuestion === undefined ? {} : { researchQuestion: args.researchQuestion },
          ...args.background === undefined ? {} : { background: args.background },
          ...args.population === undefined ? {} : { population: args.population },
          ...args.interventionOrExposure === undefined ? {} : { interventionOrExposure: args.interventionOrExposure },
          ...args.comparison === undefined ? {} : { comparison: args.comparison },
          ...args.outcome === undefined ? {} : { outcome: args.outcome },
          ...args.keywords === undefined ? {} : { keywords: args.keywords },
        })
        // Creating a project makes it this session's active project (SPEC §41).
        if (exec.agent !== undefined) await service.bindSession(exec.agent.id, project.id)
        return { ok: true, result: asToolJson(project) }
      },
    }),
    defineTool({
      name: 'project_get',
      description: 'Read one Med Research project by id.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project id returned by project_create.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const project = await service.get(projectIdSchema.parse(args.projectId))
          if (project === undefined) {
            return {
              ok: false,
              error: asToolJson({
                code: 'PROJECT_NOT_FOUND',
                message: `no project ${args.projectId}`,
                retryable: false,
                partialDataAvailable: false,
              } satisfies DomainError),
            }
          }
          return { ok: true, result: asToolJson(project) }
        } catch (error) {
          if (error instanceof ProjectError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'project_get_context',
      description:
        'Return the project record and its overview counters as a tool result, so the model sees '
        + 'only context that is recorded in the session log (SPEC §41). An explicit projectId '
        + 'selects and binds that project for the session; omit it (or pass an empty string) to '
        + 'reuse the project the session already selected.',
      parameters: {
        projectId: { type: 'string', description: 'Project to load context for; omit or leave empty to reuse the session\'s bound project.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args, exec) {
        try {
          const sessionId = exec.agent?.id
          // Models routinely express "no value" as an empty string rather than
          // omitting the field; both mean "reuse the session's project".
          const requested = args.projectId?.trim()
          const explicit = requested === undefined || requested === ''
            ? undefined
            : projectIdSchema.parse(requested)
          const bound = explicit !== undefined || sessionId === undefined
            ? undefined
            : await service.sessionProject(sessionId)
          const id = explicit ?? bound?.projectId
          if (id === undefined) {
            return {
              ok: false,
              error: asToolJson({
                code: 'PROJECT_NOT_BOUND',
                message: 'no project is bound to this session; pass projectId or create a project first',
                retryable: false,
                partialDataAvailable: false,
              } satisfies DomainError),
            }
          }
          const project = await service.get(id)
          if (project === undefined) {
            return {
              ok: false,
              error: asToolJson({
                code: 'PROJECT_NOT_FOUND',
                message: `no project ${id}`,
                retryable: false,
                partialDataAvailable: false,
              } satisfies DomainError),
            }
          }
          if (explicit !== undefined && sessionId !== undefined) await service.bindSession(sessionId, id)
          const overview = await service.overview(id)
          return { ok: true, result: asToolJson({ project, overview }) }
        } catch (error) {
          if (error instanceof ProjectError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'project_save_paper',
      description:
        'Save an already-fetched paper into the project library. The paper must already be stored '
        + 'by literature_search_pubmed; PMID and DOI are never taken from this call.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Target project.' },
        paperId: { type: 'string', required: true, description: 'Paper id returned by literature_search_pubmed.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const membership = await service.savePaper(
            projectIdSchema.parse(args.projectId),
            paperIdSchema.parse(args.paperId),
          )
          return { ok: true, result: asToolJson(membership) }
        } catch (error) {
          if (error instanceof ProjectError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
  ]
}
