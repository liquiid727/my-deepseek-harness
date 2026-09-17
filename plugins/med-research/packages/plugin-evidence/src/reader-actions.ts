/**
 * Reader actions owned by S04 (SPEC-R001-S04-004, interfaces.md §Reader, Note
 * and Evidence). S04 registers Evidence, source-navigation, and Reference
 * Chasing actions into the S03 registry, so the Reader never has to import this
 * package and a profile without these contributions reports a dependency
 * diagnostic.
 * @module @medresearch/dsh-medresearch-plugin-evidence/src/reader-actions
 */

import type { SelectionAction } from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import type { EvidenceService } from './service.ts'

/** Provenance recorded for user-initiated reader extractions. */
const READER_PROVENANCE = {
  extractorVersion: 'reader-selection/v1',
  extractorModel: 'user-initiated',
  promptVersion: 'none',
}

/**
 * Build the S04 reader contributions bound to one evidence service.
 * @param service - The evidence service that owns save/verify/chase.
 * @param storage - The shared handle, read only to look up existing records.
 * @returns the reader actions S04 provides.
 */
export function evidenceReaderActions(service: EvidenceService, storage: MedStorage): SelectionAction[] {
  return [
    {
      id: 'reader.save-evidence',
      order: 10,
      labelKey: 'reader.action.saveEvidence',
      requiresSelection: true,
      async invoke(request) {
        const selection = request.selectionText ?? ''
        const anchor = request.anchor
        // A selection that has no stored paragraph cannot be located later, so
        // it is refused instead of being saved as an unverifiable quote.
        if (anchor?.paragraphId === undefined) {
          return { status: 'FAILED', message: 'reader.action.evidenceNeedsAnchor' }
        }
        try {
          const evidence = await service.save({
            projectId: request.projectId,
            candidate: { paragraphId: anchor.paragraphId, quote: selection, relation: 'UNCERTAIN', reason: 'saved from a reader selection' },
            provenance: READER_PROVENANCE,
          })
          // Saving never asserts a verdict: the record stays PENDING until it is
          // verified, and a NOT_FOUND locator is stored REJECTED by the service.
          return evidence.supportStatus === 'REJECTED'
            ? { status: 'FAILED', reference: evidence.id, message: 'reader.action.evidenceNotLocatable' }
            : { status: 'SUCCEEDED', reference: evidence.id }
        } catch (error) {
          return { status: 'FAILED', message: error instanceof Error ? error.message : String(error) }
        }
      },
    },
    {
      id: 'reader.reference-chase',
      order: 40,
      labelKey: 'reader.action.chaseReference',
      requiresSelection: true,
      async invoke(request) {
        const anchor = request.anchor
        if (anchor?.paragraphId === undefined) {
          return { status: 'FAILED', message: 'reader.action.chaseNeedsAnchor' }
        }
        // The chased record must already exist as a secondary citation; the
        // action resolves it to an original paper through the declared
        // connector and creates a NEW direct evidence.
        const candidates = [...storage.evidences.entries()].map(([, entry]) => entry).filter(entry => entry.projectId === request.projectId
          && entry.paragraphId === anchor.paragraphId
          && entry.sourceType === 'secondary_citation')
        const origin = candidates[0]
        if (origin === undefined) {
          return { status: 'FAILED', message: 'reader.action.chaseNeedsSecondary' }
        }
        const selection = request.selectionText ?? ''
        const pmid = /\b\d{6,9}\b/u.exec(selection)?.[0]
        const doi = /\b10\.\d{4,9}\/[^\s]+/u.exec(selection)?.[0]
        if (pmid === undefined && doi === undefined) {
          return { status: 'FAILED', message: 'reader.action.chaseNeedsIdentifier' }
        }
        const result = await service.chase({
          evidenceId: origin.id,
          reference: { ...pmid === undefined ? {} : { pmid }, ...doi === undefined ? {} : { doi } },
        })
        if (result.status !== 'RESOLVED' || result.evidence === undefined) {
          return { status: 'FAILED', reference: origin.id, message: result.reason ?? result.status }
        }
        return { status: 'SUCCEEDED', reference: result.evidence.id }
      },
    },
    {
      id: 'reader.open-source',
      order: 50,
      labelKey: 'reader.action.openSource',
      requiresSelection: false,
      async invoke(request) {
        // Source navigation is a client affordance: the action reports the
        // anchor the UI must focus so the two sides cannot drift apart.
        if (request.paperId === undefined) return { status: 'FAILED', message: 'reader.action.needsPaper' }
        return { status: 'SUCCEEDED', reference: request.paperId }
      },
    },
    {
      id: 'reader.copy-citation',
      order: 60,
      labelKey: 'reader.action.copyCitation',
      requiresSelection: false,
      async invoke(request) {
        // The citation string is produced by the deterministic serializer, not
        // by a model, so the copied text can always be resolved back.
        if (request.paperId === undefined) return { status: 'FAILED', message: 'reader.action.needsPaper' }
        const paper = storage.papers.get(request.paperId)
        if (paper === undefined) return { status: 'FAILED', message: 'reader.action.needsPaper' }
        if (paper.title.trim() === '') return { status: 'FAILED', message: 'writer.error.metadataIncomplete' }
        return { status: 'SUCCEEDED', reference: request.paperId }
      },
    },
  ]
}
