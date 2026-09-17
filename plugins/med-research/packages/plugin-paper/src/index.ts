/**
 * Paper plugin entry (SPEC §6, §31). Wires the paper service to storage, the
 * full-text resolver, and `ctx.web.fetch`, provides `ctx.medPapers`, and
 * registers the `paper_*` tools.
 * @module @medresearch/dsh-plugin-paper
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
// Type-only: resolves the required ctx.web service declaration.
import type {} from '@deepseek-ai/dsh-web'
import { REQUIRED_READER_ACTIONS, SelectionActionRegistry } from '@medresearch/dsh-medical-domain'
import {
  documentIdSchema,
  evidenceChunkIdSchema,
  paragraphIdSchema,
  paperIdSchema,
  sectionIdSchema,
  annotationIdSchema,
  noteIdSchema,
} from '@medresearch/dsh-medical-contracts'
import { openMedStorage } from '@medresearch/dsh-medical-storage'
import type { Config } from './config.ts'
import { extractPdfPages } from './pdfjs.ts'
import { paperReaderActions } from './reader-actions.ts'
import { PapersService } from './service.ts'
import { paperTools } from './tools.ts'

export { Config } from './config.ts'
export { PapersService } from './service.ts'

/** Cordis plugin name. */
export const name = 'med-paper'
/** Storage carries parsed structure; `medFulltext` resolves sources; tools registers the tools. */
export const inject = ['tools', 'web', 'storageDomain', 'medFulltext']

declare module '@deepseek-ai/cordis' {
  interface Context {
    medPapers: PapersService
    /** Reader selection-action registry; business packages contribute to it. */
    medReaderActions: SelectionActionRegistry
  }
}

/**
 * Mount the paper capability.
 * @param ctx - Registrant context.
 * @param config - Validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const storage = await openMedStorage(ctx.storageDomain)
  ctx.effect(() => () => storage.close(), 'med.paper.storage')

  const service = new PapersService({
    storage,
    fulltext: ctx.medFulltext,
    async fetchText(url) {
      const response = await ctx.web.fetch({ url })
      return response.body.content
    },
    extractPdf: extractPdfPages,
    maxSearchResults: (config as Required<Config>).maxSearchResults,
    now: () => new Date().toISOString(),
    newPaperId: () => paperIdSchema.parse(randomUUID()),
    newDocumentId: () => documentIdSchema.parse(randomUUID()),
    newSectionId: () => sectionIdSchema.parse(randomUUID()),
    newParagraphId: () => paragraphIdSchema.parse(randomUUID()),
    newEvidenceChunkId: () => evidenceChunkIdSchema.parse(randomUUID()),
    newNoteId: () => noteIdSchema.parse(randomUUID()),
    newAnnotationId: () => annotationIdSchema.parse(randomUUID()),
  })
  ctx.effect(() => ctx.provide('medPapers', service), 'med.paper.service')
  for (const tool of paperTools(service)) ctx.tools.register(tool)

  // The Reader owns the selection-action registry other packages contribute to
  // (interfaces.md §Reader, Note and Evidence). The required ids are declared
  // here so a profile that lacks one reports a dependency diagnostic instead of
  // rendering a dead control.
  const readerActions = new SelectionActionRegistry()
  const unrequireReader = readerActions.require(REQUIRED_READER_ACTIONS)
  for (const action of paperReaderActions(service)) ctx.effect(() => readerActions.register(action), `med.paper.reader-action.${action.id}`)
  ctx.effect(() => {
    const dispose = ctx.provide('medReaderActions', readerActions)
    return () => { unrequireReader(); dispose() }
  }, 'med.paper.reader-actions')
}
