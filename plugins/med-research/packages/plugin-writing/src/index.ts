/** Writing plugin entry (SPEC-R001-S08). */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { asToolJson, draftIdSchema, evidenceIdSchema, projectIdSchema, TOOL_ENVELOPE_SCHEMA, renderToolEnvelope } from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import { draftEditorActions } from './draft-actions.ts'
import { WritingError, WritingService } from './service.ts'

export { WritingError, WritingService } from './service.ts'
export const name = 'med-writing'
export const inject = ['tools', 'storageDomain', 'medDraftEditorActions']

declare module '@deepseek-ai/cordis' { interface Context { medWriting: WritingService } }

function failure(error: WritingError) { return { ok: false as const, error: asToolJson({ code: error.code, message: error.message, retryable: false, partialDataAvailable: false, source: 'writing' }) } }
function writingTools(service: WritingService): ToolDefinition[] {
  return [
    defineTool({ name: 'writing_generate', description: 'Generate an editable Draft from project-scoped verified Evidence ids.', parameters: { projectId: { type: 'string', required: true, description: 'Project id.' }, draftId: { type: 'string', required: true, description: 'Draft id.' }, evidenceIds: { type: 'array', items: { type: 'string' }, required: true, description: 'Selected Evidence ids.' }, outline: { type: 'array', items: { type: 'string' }, required: true, description: 'Draft headings.' }, language: { type: 'string', enum: ['zh', 'en'], required: true, description: 'Draft language.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.generate({ projectId: projectIdSchema.parse(args.projectId), draftId: draftIdSchema.parse(args.draftId), evidenceIds: args.evidenceIds.map((id: string) => evidenceIdSchema.parse(id)), outline: args.outline, language: args.language as 'zh' | 'en' })) } } catch (error) { if (error instanceof WritingError) return failure(error); throw error } } }),
    defineTool({ name: 'writing_validate', description: 'Revalidate a Draft against current Evidence and citation locations.', parameters: { draftId: { type: 'string', required: true, description: 'Draft id.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.validate(draftIdSchema.parse(args.draftId))) } } catch (error) { if (error instanceof WritingError) return failure(error); throw error } } }),
    defineTool({ name: 'writing_translate', description: 'Check a supplied academic translation without replacing the source Draft.', parameters: { draftId: { type: 'string', required: true, description: 'Draft id.' }, sourceText: { type: 'string', required: true, description: 'Source text.' }, translatedText: { type: 'string', required: true, description: 'Supplied translation.' }, targetLanguage: { type: 'string', enum: ['zh', 'en'], required: true, description: 'Target language.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.translate({ draftId: draftIdSchema.parse(args.draftId), sourceText: args.sourceText, translatedText: args.translatedText, targetLanguage: args.targetLanguage as 'zh' | 'en' })) } } catch (error) { if (error instanceof WritingError) return failure(error); throw error } } }),
    defineTool({ name: 'writing_export', description: 'Export a complete or explicitly incomplete citation file from persisted papers.', parameters: { projectId: { type: 'string', required: true, description: 'Project id.' }, draftId: { type: 'string', description: 'Optional Draft id.' }, format: { type: 'string', enum: ['ris', 'bibtex', 'markdown'], required: true, description: 'Export format.' }, mode: { type: 'string', enum: ['complete', 'preview'], required: true, description: 'Complete blocks stale Drafts; preview reports warnings.' } }, output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope }, async execute(args) { try { return { ok: true, result: asToolJson(await service.export({ projectId: projectIdSchema.parse(args.projectId), ...args.draftId === undefined ? {} : { draftId: draftIdSchema.parse(args.draftId) }, format: args.format as 'ris' | 'bibtex' | 'markdown', mode: args.mode as 'complete' | 'preview' })) } } catch (error) { if (error instanceof WritingError) return failure(error); throw error } } }),
  ]
}

/** Mount evidence-backed writing capabilities. */
export async function apply(ctx: Context): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.writing.storage')
  const service = new WritingService({ storage, now: () => new Date().toISOString() })
  ctx.effect(() => ctx.provide('medWriting', service), 'med.writing.service')
  for (const tool of writingTools(service)) ctx.tools.register(tool)

  // S08 contributes writing, translation, validation, and export to the S06
  // Draft-editor registry, so S06 never statically depends on S08.
  for (const action of draftEditorActions(service, storage)) {
    ctx.effect(() => ctx.medDraftEditorActions.register(action), `med.writing.draft-action.${action.id}`)
  }
}
