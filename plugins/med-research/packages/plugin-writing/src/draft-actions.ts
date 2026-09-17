/**
 * Draft-editor actions owned by S08 (SPEC-R001-S08-001..003, interfaces.md
 * §Long tasks and failure). S06 owns the Draft and its editor registry; S08
 * contributes the four writing actions, so neither package imports the other.
 * @module @medresearch/dsh-medresearch-plugin-writing/src/draft-actions
 */

import type { Draft, DraftId, ProjectId, SelectionAction } from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import type { WritingService } from './service.ts'

/**
 * Build the S08 Draft-editor contributions bound to one writing service.
 * @param service - The writing service that owns generate/validate/translate/export.
 * @param storage - The shared handle, read only to resolve the Draft's own data.
 * @returns the Draft-editor actions S08 provides.
 */
export function draftEditorActions(service: WritingService, storage: MedStorage): SelectionAction[] {
  /** Every action needs the Draft it operates on; a missing one is a failure. */
  const requireDraft = (draftId: DraftId | undefined): Draft | undefined =>
    draftId === undefined ? undefined : storage.drafts.get(draftId)

  return [
    {
      id: 'draft.generate',
      order: 10,
      labelKey: 'writer.action.generate',
      requiresSelection: false,
      async invoke(request) {
        const draft = requireDraft(request.draftId)
        if (draft === undefined) return { status: 'FAILED', message: 'writer.error.draftNotFound' }
        const generation = await service.generate({
          projectId: request.projectId as ProjectId,
          draftId: draft.id,
          evidenceIds: draft.evidenceIds,
          outline: draft.outline,
          language: 'en',
        })
        // A draft with unresolved facts is a legitimate result, not a failure:
        // the caller sees the insufficiencies and the draft stays unqualified.
        return { status: 'SUCCEEDED', reference: generation.draftId, ...generation.insufficiencies.length === 0 ? {} : { message: generation.insufficiencies.join('; ') } }
      },
    },
    {
      id: 'draft.translate',
      order: 20,
      labelKey: 'writer.action.translate',
      requiresSelection: true,
      async invoke(request) {
        const draft = requireDraft(request.draftId)
        if (draft === undefined) return { status: 'FAILED', message: 'writer.error.draftNotFound' }
        const selection = request.selectionText ?? ''
        const result = await service.translate({ draftId: draft.id, sourceText: selection, targetLanguage: 'zh' })
        return result.validation.valid
          ? { status: 'SUCCEEDED', reference: draft.id }
          : { status: 'FAILED', reference: draft.id, message: result.validation.reasons.join('; ') }
      },
    },
    {
      id: 'draft.validate',
      order: 30,
      labelKey: 'writer.action.validate',
      requiresSelection: false,
      async invoke(request) {
        const draft = requireDraft(request.draftId)
        if (draft === undefined) return { status: 'FAILED', message: 'writer.error.draftNotFound' }
        const validation = await service.validate(draft.id)
        return validation.valid
          ? { status: 'SUCCEEDED', reference: draft.id }
          : { status: 'FAILED', reference: draft.id, message: validation.reasons.join('; ') }
      },
    },
    {
      id: 'draft.export',
      order: 40,
      labelKey: 'writer.action.export',
      requiresSelection: false,
      async invoke(request) {
        const draft = requireDraft(request.draftId)
        if (draft === undefined) return { status: 'FAILED', message: 'writer.error.draftNotFound' }
        try {
          const exported = await service.export({
            projectId: request.projectId as ProjectId,
            draftId: draft.id,
            format: 'ris',
            mode: 'complete',
          })
          return { status: 'SUCCEEDED', reference: exported.citationRevision }
        } catch (error) {
          // A stale citation must block the complete export; the reason is the
          // actionable part, so it is surfaced rather than swallowed.
          return { status: 'FAILED', message: error instanceof Error ? error.message : String(error) }
        }
      },
    },
  ]
}
