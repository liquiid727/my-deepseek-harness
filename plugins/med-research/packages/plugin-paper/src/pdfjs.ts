/**
 * PDF text extraction adapter (SPEC §22.2). Uses the `pdfjs-dist` legacy build,
 * which runs in Node without a DOM. A page that fails to render is reported as
 * failed so the assembled document becomes `PARTIAL` instead of silently
 * losing text.
 * @module @medresearch/dsh-plugin-paper/src/pdfjs
 */

import { readFile } from 'node:fs/promises'
import type { PdfExtraction, PdfPage } from './pdf.ts'

/**
 * Extract page text from a PDF file.
 * @param fileRef - Absolute path of the PDF.
 * @returns one entry per page; a failed page carries `failed: true`.
 */
export async function extractPdfPages(fileRef: string): Promise<PdfExtraction> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await readFile(fileRef))
  const loading = getDocument({ data, useSystemFonts: false, verbosity: 0 })
  const document = await loading.promise
  const pages: PdfPage[] = []
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      try {
        const page = await document.getPage(index)
        const content = await page.getTextContent()
        let text = ''
        for (const item of content.items) {
          if (!('str' in item)) continue
          text += item.str
          if (item.hasEOL) text += '\n'
        }
        pages.push({ page: index, text })
      } catch {
        pages.push({ page: index, text: '', failed: true })
      }
    }
  } finally {
    await loading.destroy()
  }
  return { pages }
}
