/**
 * Reader selection actions owned by S03 (SPEC-R001-S03-003, interfaces.md
 * §Reader, Note and Evidence). S03 owns Note and Annotation, so it contributes
 * exactly those two actions; Evidence, source navigation, and Reference
 * Chasing arrive from S04 through the same registry.
 * @module @medresearch/dsh-medical-research-plugin-paper/src/reader-actions
 */

import type { SelectionAction } from '@medresearch/dsh-medical-contracts'
import type { PapersService } from './service.ts'

/**
 * Build the S03 reader contributions bound to one paper service.
 * @param service - The paper service that owns Notes and Annotations.
 * @returns the reader actions S03 provides.
 */
export function paperReaderActions(service: PapersService): SelectionAction[] {
  return [
    {
      id: 'reader.save-note',
      order: 20,
      labelKey: 'reader.action.saveNote',
      requiresSelection: true,
      async invoke(request) {
        const selection = request.selectionText ?? ''
        if (request.paperId === undefined || request.anchor === undefined) {
          return { status: 'FAILED', message: 'reader.action.noteNeedsAnchor' }
        }
        try {
          const note = await service.createNote({
            projectId: request.projectId,
            paperId: request.paperId,
            scope: 'selection',
            title: selection.slice(0, 60),
            content: selection,
            anchor: request.anchor,
          })
          return { status: 'SUCCEEDED', reference: note.id }
        } catch (error) {
          // A cancelled or failed save writes nothing; the reason is surfaced.
          return { status: 'FAILED', message: error instanceof Error ? error.message : String(error) }
        }
      },
    },
    {
      id: 'reader.translate-selection',
      order: 30,
      labelKey: 'reader.action.translate',
      requiresSelection: true,
      async invoke(request) {
        const selection = request.selectionText ?? ''
        if (request.documentId === undefined) {
          return { status: 'FAILED', message: 'reader.action.translateNeedsDocument' }
        }
        // Translation is supplied by the caller's model turn; S03 only records
        // and checks the alignment, so an empty translation is not a success.
        const check = await service.translate({
          documentId: request.documentId,
          translatedText: selection,
          targetLanguage: 'zh',
        })
        return check.status === 'VALID'
          ? { status: 'SUCCEEDED' }
          : { status: 'FAILED', message: check.mismatches.join('; ') }
      },
    },
  ]
}
