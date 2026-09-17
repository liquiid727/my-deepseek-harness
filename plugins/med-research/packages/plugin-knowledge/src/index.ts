/** Knowledge plugin entry (SPEC-R001-S06). */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { asToolJson, draftIdSchema, projectIdSchema, tagIdSchema, TOOL_ENVELOPE_SCHEMA, renderToolEnvelope } from '@medresearch/dsh-medical-contracts'
import { annotationIdSchema, draftRevisionIdSchema, noteIdSchema } from '@medresearch/dsh-medical-contracts'
import { REQUIRED_DRAFT_EDITOR_ACTIONS, SelectionActionRegistry } from '@medresearch/dsh-medical-domain'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { KnowledgeError, KnowledgeService } from './service.ts'

export { KnowledgeError, KnowledgeService } from './service.ts'
export const name = 'med-knowledge'
export const inject = ['tools', 'storageDomain']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medKnowledge: KnowledgeService
    /** Draft editor action registry; S08 contributes writing actions to it. */
    medDraftEditorActions: SelectionActionRegistry
  }
}

function failure(error: KnowledgeError) { return { ok: false as const, error: asToolJson({ code: error.code, message: error.message, retryable: false, partialDataAvailable: false, source: 'knowledge' }) } }

function tools(service: KnowledgeService): ToolDefinition[] {
  return [
    defineTool({ name: 'knowledge_list_papers', description: 'List project-scoped paper library records.', parameters: { projectId: { type: 'string', required: true, description: 'Project id.' }, scope: { type: 'string', enum: ['currentProject', 'myLibrary', 'uploaded'], description: 'Explicit library scope.' }, query: { type: 'string', description: 'Title, author, PMID, or DOI filter.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.listPapers({ projectId: projectIdSchema.parse(args.projectId), ...args.scope === undefined ? {} : { scope: args.scope as 'currentProject' | 'myLibrary' | 'uploaded' }, ...args.query === undefined ? {} : { query: args.query } })) } } catch (error) { if (error instanceof KnowledgeError) return failure(error); throw error } } }),
    defineTool({ name: 'knowledge_search', description: 'Search persisted project papers, evidence, notes, and drafts; returns references rather than invented facts.', parameters: { projectId: { type: 'string', required: true, description: 'Project id.' }, query: { type: 'string', required: true, description: 'Search terms.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.search({ projectId: projectIdSchema.parse(args.projectId), query: args.query })) } } catch (error) { if (error instanceof KnowledgeError) return failure(error); throw error } } }),
    defineTool({ name: 'knowledge_create_tag', description: 'Create a unique project tag.', parameters: { projectId: { type: 'string', required: true, description: 'Project id.' }, name: { type: 'string', required: true, description: 'Tag name.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.createTag(projectIdSchema.parse(args.projectId), args.name)) } } catch (error) { if (error instanceof KnowledgeError) return failure(error); throw error } } }),
    defineTool({ name: 'knowledge_create_draft', description: 'Create an editable evidence-writing Draft.', parameters: { projectId: { type: 'string', required: true, description: 'Project id.' }, title: { type: 'string', required: true, description: 'Draft title.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.createDraft({ projectId: projectIdSchema.parse(args.projectId), title: args.title })) } } catch (error) { if (error instanceof KnowledgeError) return failure(error); throw error } } }),
    defineTool({ name: 'knowledge_get_draft', description: 'Read one project Draft.', parameters: { draftId: { type: 'string', required: true, description: 'Draft id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { const draft = await service.getDraft(draftIdSchema.parse(args.draftId)); return draft === undefined ? failure(new KnowledgeError('DRAFT_NOT_FOUND', `no draft ${args.draftId}`)) : { ok: true, result: asToolJson(draft) } } }),
    defineTool({
      name: 'knowledge_rag',
      description:
        'Answer from the current Project corpus only: its paper paragraphs, verified evidence, and notes. '
        + 'Results carry the corpus version, scored candidates, and citations. No qualifying material returns an '
        + 'explicit insufficiency instead of an answer, and a removed membership can never be answered from a stale index.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project scope; never crosses projects.' },
        query: { type: 'string', required: true, description: 'Question to retrieve against.' },
        maxCandidates: { type: 'integer', description: 'Candidate cap; resolved from configuration when absent.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          return {
            ok: true,
            result: asToolJson(await service.rag({
              projectId: projectIdSchema.parse(args.projectId),
              query: args.query,
              ...args.maxCandidates === undefined ? {} : { maxCandidates: args.maxCandidates },
            })),
          }
        } catch (error) { if (error instanceof KnowledgeError) return failure(error); throw error }
      },
    }),
    defineTool({
      name: 'knowledge_draft_invalidate',
      description:
        'Return a Draft to DRAFT after an edit. REVIEWABLE and EXPORTED are produced by evidence-backed '
        + 'writing validation, so a caller cannot assert them here.',
      parameters: { draftId: { type: 'string', required: true, description: 'Draft id.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try { return { ok: true, result: asToolJson(await service.setDraftStatus(draftIdSchema.parse(args.draftId), 'DRAFT')) } } catch (error) { if (error instanceof KnowledgeError) return failure(error); throw error }
      },
    }),
  ]
}

/** Mount the Knowledge service and its model-facing tools. */
export async function apply(ctx: Context): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.knowledge.storage')
  const service = new KnowledgeService({ storage, now: () => new Date().toISOString(), newTagId: () => tagIdSchema.parse(randomUUID()), newDraftId: () => draftIdSchema.parse(randomUUID()), newDraftRevisionId: () => draftRevisionIdSchema.parse(randomUUID()) })
  ctx.effect(() => ctx.provide('medKnowledge', service), 'med.knowledge.service')

  // S06 owns the Draft editor's action registry; S08 contributes the writing,
  // translation, validation, and export actions to it (interfaces.md).
  const draftEditorActions = new SelectionActionRegistry()
  const unrequireDraftEditor = draftEditorActions.require(REQUIRED_DRAFT_EDITOR_ACTIONS)
  ctx.effect(() => {
    const dispose = ctx.provide('medDraftEditorActions', draftEditorActions)
    return () => { unrequireDraftEditor(); dispose() }
  }, 'med.knowledge.draft-editor-actions')
  for (const tool of tools(service)) ctx.tools.register(tool)
}
