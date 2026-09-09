/**
 * Model-facing `paper_*` tools (SPEC §6, §31). Results are machine-readable
 * envelopes; a missing paper returns `PAPER_NOT_FOUND` instead of an empty
 * object.
 * @module @medresearch/dsh-plugin-paper/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  asToolJson,
  paperIdSchema,
  renderToolEnvelope,
  TOOL_ENVELOPE_SCHEMA,
  type DomainError,
  type ToolJson,
} from '@medresearch/dsh-medical-contracts'
import type { PapersService } from './service.ts'

/** Build the `{ ok: false, error }` envelope for a missing paper. */
function notFound(id: string): { ok: false; error: ToolJson } {
  const error: DomainError = {
    code: 'PAPER_NOT_FOUND',
    message: `no stored paper ${id}`,
    retryable: false,
    partialDataAvailable: false,
    source: 'paper',
  }
  return { ok: false, error: asToolJson(error) }
}

/**
 * Build the paper tools bound to one service.
 * @param service - The paper service implementation.
 * @returns tool definitions ready for `ctx.tools.register`.
 */
export function paperTools(service: PapersService): ToolDefinition[] {
  return [
    defineTool({
      name: 'paper_get',
      description: 'Read one stored paper by id, including its connector-assigned PMID and DOI.',
      parameters: {
        paperId: { type: 'string', required: true, description: 'Paper id returned by literature_search_pubmed.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const paper = await service.get(paperIdSchema.parse(args.paperId))
        return paper === undefined ? notFound(args.paperId) : { ok: true, result: asToolJson(paper) }
      },
    }),
    defineTool({
      name: 'paper_get_document',
      description:
        'List a paper\'s parsed documents (parseStatus READY / PARTIAL / FAILED / ABSTRACT_ONLY). '
        + 'When nothing is parsed yet, the abstract is parsed into an ABSTRACT_ONLY document.',
      parameters: {
        paperId: { type: 'string', required: true, description: 'Paper to read documents for.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const id = paperIdSchema.parse(args.paperId)
        if (await service.get(id) === undefined) return notFound(args.paperId)
        return { ok: true, result: asToolJson(await service.document(id)) }
      },
    }),
    defineTool({
      name: 'paper_resolve_fulltext',
      description:
        'Resolve a paper\'s full text through the allowed channel priority and parse it when a '
        + 'machine-readable source is available. `status: unavailable` is a real outcome, not an error.',
      parameters: {
        paperId: { type: 'string', required: true, description: 'Paper to resolve.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const id = paperIdSchema.parse(args.paperId)
        if (await service.get(id) === undefined) return notFound(args.paperId)
        return { ok: true, result: asToolJson(await service.resolveFulltext(id)) }
      },
    }),
    defineTool({
      name: 'paper_search_content',
      description:
        'Search one paper\'s parsed paragraphs for a text substring. Returns matching paragraphs '
        + 'with their ids, so an evidence span can reference a real paragraph.',
      parameters: {
        paperId: { type: 'string', required: true, description: 'Paper to search.' },
        query: { type: 'string', required: true, description: 'Text to find (case-insensitive).' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const id = paperIdSchema.parse(args.paperId)
        if (await service.get(id) === undefined) return notFound(args.paperId)
        return { ok: true, result: asToolJson(await service.search(id, args.query)) }
      },
    }),
  ]
}
