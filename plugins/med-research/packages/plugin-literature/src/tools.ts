/**
 * Model-facing `literature_*` tools (SPEC §6, §19). Each tool validates its
 * model-supplied JSON against the contracts schemas, calls the service, and
 * returns a machine-readable envelope. Connector failures become
 * `{ ok: false, error: { code, retryable, … } }` rather than an empty result,
 * so the model never mistakes a failed search for "no papers found".
 * @module @medresearch/dsh-plugin-literature/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  asToolJson,
  projectIdSchema,
  queryPlanSchema,
  renderToolEnvelope,
  researchQueryFiltersSchema,
  researchQueryIdSchema,
  TOOL_ENVELOPE_SCHEMA,
  type DomainError,
} from '@medresearch/dsh-medical-contracts'
import { PubmedError } from './pubmed/errors.ts'
import type { LiteratureService } from './service.ts'

/** Map a connector failure to the shared {@link DomainError} shape. */
function toDomainError(error: PubmedError): DomainError {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    partialDataAvailable: false,
    source: 'pubmed',
    ...error.details === undefined ? {} : { details: error.details },
  }
}

/**
 * Build the three literature tools bound to one service.
 * @param service - The literature service implementation.
 * @returns tool definitions ready for `ctx.tools.register`.
 */
export function literatureTools(service: LiteratureService): ToolDefinition[] {
  return [
    defineTool({
      name: 'literature_plan_query',
      description:
        'Validate and store a PubMed query plan for a project. Provide the question and the '
        + 'structured plan (normalized question, PICO, concepts, queries). This issues NO network '
        + 'request: PubMed is only contacted by literature_search_pubmed after the user confirms.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project the query belongs to.' },
        question: { type: 'string', required: true, description: 'The research question as the user wrote it.' },
        plan: { type: 'json', required: true, description: 'QueryPlan: { normalizedQuestion, pico?, concepts, queries }.' },
        filters: { type: 'json', description: 'Optional filters: { dateFrom?, dateTo?, publicationTypes?, languages? }.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const plan = queryPlanSchema.parse(args.plan)
          const filters = args.filters === undefined ? undefined : researchQueryFiltersSchema.parse(args.filters)
          const query = await service.planQuery({
            projectId: projectIdSchema.parse(args.projectId),
            question: args.question,
            plan,
            ...filters === undefined ? {} : { filters },
          })
          return { ok: true, result: asToolJson(query) }
        } catch (error) {
          if (error instanceof PubmedError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'literature_search_pubmed',
      description:
        'Execute one confirmed PubMed E-utilities search and persist the returned papers. '
        + 'PMID and DOI come only from the PubMed response. On timeout or rate limiting the '
        + 'result is { ok: false } with a retryable error, never an empty paper list.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project the papers are fetched for.' },
        query: { type: 'string', required: true, description: 'Executable PubMed query string.' },
        purpose: {
          type: 'string',
          required: true,
          enum: ['primary', 'broad', 'counter', 'related'],
          description: 'Why this query is run.',
        },
        maxResults: { type: 'integer', description: 'Page cap; the deployment default applies when omitted.' },
        dateFrom: { type: 'string', description: 'Earliest publication date, e.g. 2020 or 2020-01-01.' },
        dateTo: { type: 'string', description: 'Latest publication date.' },
        publicationTypes: { type: 'array', items: { type: 'string' }, description: 'PubMed publication types.' },
        languages: { type: 'array', items: { type: 'string' }, description: 'Language names, e.g. english.' },
        researchQueryId: { type: 'string', description: 'Approved plan this query came from; required for the network call.' },
        fullText: { type: 'string', enum: ['ANY', 'AVAILABLE'], description: 'Full-text filter: ANY (default) or AVAILABLE (resolver-verified full text only).' },
        rerankModel: { type: 'string', description: 'Model id for the AI rerank; invalid ids degrade to lexical order.' },
        cursor: { type: 'string', description: 'Opaque page cursor from a prior search in the same frozen run.' },
        pageSize: { type: 'integer', description: 'Page size when paging with a cursor.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const result = await service.search({
            projectId: projectIdSchema.parse(args.projectId),
            query: args.query,
            purpose: args.purpose,
            ...args.maxResults === undefined ? {} : { maxResults: args.maxResults },
            ...args.dateFrom === undefined ? {} : { dateFrom: args.dateFrom },
            ...args.dateTo === undefined ? {} : { dateTo: args.dateTo },
            ...args.publicationTypes === undefined ? {} : { publicationTypes: args.publicationTypes },
            ...args.languages === undefined ? {} : { languages: args.languages },
            ...args.researchQueryId === undefined ? {} : { researchQueryId: researchQueryIdSchema.parse(args.researchQueryId) },
            ...args.fullText === undefined ? {} : { fullText: args.fullText },
            ...args.rerankModel === undefined ? {} : { rerankModel: args.rerankModel },
            ...args.cursor === undefined ? {} : { cursor: args.cursor },
            ...args.pageSize === undefined ? {} : { pageSize: args.pageSize },
          })
          return { ok: true, result: asToolJson(result) }
        } catch (error) {
          if (error instanceof PubmedError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'literature_get_paper',
      description:
        'Read one paper by PMID, fetching it from PubMed when it is not stored yet. '
        + 'Returns { ok: false, error: { code: "PAPER_NOT_FOUND" } } when PubMed has no such PMID.',
      parameters: {
        pmid: { type: 'string', required: true, description: 'PubMed identifier, as returned by a search.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const paper = await service.getPaper(args.pmid)
        if (paper === undefined) {
          return {
            ok: false,
            error: asToolJson({
              code: 'PAPER_NOT_FOUND',
              message: `PubMed has no record for PMID ${args.pmid}`,
              retryable: false,
              partialDataAvailable: false,
              source: 'pubmed',
            }),
          }
        }
        return { ok: true, result: asToolJson(paper) }
      },
    }),
  ]
}
