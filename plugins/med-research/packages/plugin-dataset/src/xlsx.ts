/**
 * Minimal XLSX reader (SPEC §33). Reads the first worksheet plus the shared
 * string table: cell references map to columns, missing cells become empty
 * strings, and only values are returned — never formulas or styles.
 * @module @medresearch/dsh-plugin-dataset/src/xlsx
 */

import { strFromU8, unzipSync } from 'fflate'
import { attrOf, child, children, parseOrderedXml, textOf } from '@medresearch/dsh-medical-xml'

/** Column index from an A1-style cell reference. */
function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/u.exec(reference)?.[1] ?? 'A'
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

/**
 * Parse an XLSX workbook buffer.
 * @param bytes - Raw `.xlsx` file bytes.
 * @returns the header row and data rows as strings.
 * @throws Error when the workbook has no worksheet.
 */
export function parseXlsx(bytes: Uint8Array): { headers: string[]; rows: string[][] } {
  const files = unzipSync(bytes)
  const decoder = new TextDecoder()
  const shared: string[] = []
  const sharedBytes = files['xl/sharedStrings.xml']
  if (sharedBytes !== undefined) {
    const root = parseOrderedXml(decoder.decode(sharedBytes)).find(element => element.tag === 'sst')
    for (const item of children(root, 'si')) shared.push(textOf(item))
  }
  const sheetBytes = files['xl/worksheets/sheet1.xml']
  if (sheetBytes === undefined) throw new Error('workbook has no xl/worksheets/sheet1.xml')
  const worksheet = parseOrderedXml(decoder.decode(sheetBytes)).find(element => element.tag === 'worksheet')
  const sheetData = child(worksheet, 'sheetData')
  const rows: string[][] = []
  for (const row of children(sheetData, 'row')) {
    const cells: string[] = []
    for (const cell of children(row, 'c')) {
      const index = columnIndex(attrOf(cell, 'r') ?? 'A1')
      const type = attrOf(cell, 't')
      const inline = child(cell, 'is')
      const value = type === 'inlineStr' && inline !== undefined ? textOf(inline) : textOf(child(cell, 'v'))
      cells[index] = type === 's' ? (shared[Number(value)] ?? '') : value
    }
    rows.push(Array.from({ length: cells.length }, (_, index) => cells[index] ?? ''))
  }
  const [headers, ...data] = rows
  if (headers === undefined) throw new Error('XLSX worksheet has no rows')
  return { headers, rows: data }
}

export { strFromU8 }
