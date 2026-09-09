/**
 * CSV parsing and column profiling (SPEC §13, §33). Row-level values never
 * leave this module's caller: the profiler returns only schema, counts, and
 * aggregates, which is what the model is allowed to see (SPEC §47, §50).
 * @module @medresearch/dsh-plugin-dataset/src/csv
 */

import type { ColumnType, DatasetColumn } from '@medresearch/dsh-medical-contracts'

/**
 * Parse CSV text into a header row and data rows.
 * @param text - CSV file contents (RFC 4180 quoting; LF or CRLF).
 * @returns the header names and the data rows, all values as strings.
 * @throws Error when the file has no header.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += character
      }
      continue
    }
    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      record.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      record.push(field)
      field = ''
      if (record.length > 1 || record[0] !== '') records.push(record)
      record = []
    } else {
      field += character
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    if (record.length > 1 || record[0] !== '') records.push(record)
  }
  const [headers, ...rows] = records
  if (headers === undefined || headers.length === 0) throw new Error('CSV file has no header row')
  return { headers, rows }
}

const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/u

/** Infer the statistical role of one column from its non-empty values. */
function inferType(name: string, values: readonly string[], uniqueCount: number, rowCount: number): ColumnType {
  if (values.length === 0) return 'unknown'
  if (/(^|_)id$/iu.test(name) && uniqueCount === rowCount) return 'id'
  if (values.every(value => DATE.test(value))) return 'date'
  const numbers = values.map(Number)
  if (numbers.every(value => Number.isFinite(value))) {
    return numbers.every(value => value === 0 || value === 1) ? 'binary' : 'continuous'
  }
  return 'categorical'
}

/** Median of an already numeric, non-empty list. */
function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

/**
 * Profile every column of a parsed CSV.
 * @param headers - Column names.
 * @param rows - Data rows.
 * @returns one {@link DatasetColumn} per header.
 */
export function profileColumns(headers: readonly string[], rows: readonly string[][]): DatasetColumn[] {
  return headers.map((name, column) => {
    const raw = rows.map(row => row[column] ?? '')
    const values = raw.filter(value => value.trim() !== '')
    const missingCount = raw.length - values.length
    const uniqueCount = new Set(values).size
    const inferredType = inferType(name, values, uniqueCount, rows.length)
    const base: DatasetColumn = {
      name,
      inferredType,
      nullable: missingCount > 0,
      missingCount,
      uniqueCount,
    }
    if (inferredType === 'continuous') {
      const numbers = values.map(Number).sort((left, right) => left - right)
      const sum = numbers.reduce((total, value) => total + value, 0)
      return {
        ...base,
        min: numbers[0]!,
        max: numbers[numbers.length - 1]!,
        mean: sum / numbers.length,
        median: median(numbers),
      }
    }
    return base
  })
}
