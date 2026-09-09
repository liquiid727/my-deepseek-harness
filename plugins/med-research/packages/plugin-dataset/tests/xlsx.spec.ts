import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parseXlsx } from '../src/xlsx.ts'

/** Build a minimal workbook: header row plus two data rows, one shared string. */
function workbook(): Uint8Array {
  return zipSync({
    'xl/sharedStrings.xml': strToU8(
      '<sst><si><t>ponv</t></si><si><t>pain</t></si><si><t>A</t></si></sst>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet><sheetData>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
      + '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>7.2</v></c></row>'
      + '<row r="3"><c r="B3" t="s"><v>2</v></c></row>'
      + '</sheetData></worksheet>',
    ),
  })
}

describe('parseXlsx (SPEC §33)', () => {
  it('reads the first worksheet into headers and rows', () => {
    const { headers, rows } = parseXlsx(workbook())
    expect(headers).toEqual(['ponv', 'pain'])
    expect(rows).toEqual([['1', '7.2'], ['', 'A']])
  })

  it('rejects a workbook without a worksheet', () => {
    expect(() => parseXlsx(zipSync({ 'xl/sharedStrings.xml': strToU8('<sst/>') }))).toThrow(/sheet1/)
  })
})
