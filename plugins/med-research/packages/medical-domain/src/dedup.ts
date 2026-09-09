/**
 * Paper de-duplication (SPEC §20, FR-4). Identity is resolved in the fixed
 * priority order PMID → DOI → PMCID → normalized(title + year); the first
 * available identifier wins, so two records that share a PMID are the same
 * paper even when their titles differ.
 * @module @medresearch/dsh-medical-domain/src/dedup
 */

import type { Paper } from '@medresearch/dsh-medical-contracts'
import { normalizeParagraph } from './normalize.ts'

/** Fields that participate in paper identity. */
export type PaperIdentity = Pick<Paper, 'pmid' | 'doi' | 'pmcid' | 'title' | 'publicationDate'>

/** One record dropped as a duplicate of an earlier record. */
export interface DuplicatePair<T> {
  /** Identity key that matched. */
  key: string
  /** The first record carrying the key; it is kept. */
  kept: T
  /** The later record carrying the same key; it is dropped. */
  dropped: T
}

/** De-duplication outcome preserving input order. */
export interface DedupeResult<T> {
  /** Kept records, in input order. */
  papers: T[]
  /** Every dropped record with the kept record it duplicated. */
  duplicates: Array<DuplicatePair<T>>
}

/**
 * Normalize a DOI for comparison: strip a `doi:` or `https://doi.org/` prefix,
 * trim, and lowercase.
 * @param doi - Raw DOI string from a connector.
 * @returns the comparable DOI form.
 */
export function normalizeDoi(doi: string): string {
  return doi.trim().replace(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/iu, '').toLowerCase()
}

/**
 * Extract the comparison year from a publication date string.
 * @param publicationDate - Connector date, typically `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.
 * @returns the four-digit year, or the trimmed lowercase input when none is present.
 */
function publicationYear(publicationDate: string | undefined): string {
  if (publicationDate === undefined) return ''
  const match = /(\d{4})/u.exec(publicationDate)
  return match === null ? publicationDate.trim().toLowerCase() : match[1]!
}

/**
 * Compute the identity key used to decide whether two records are the same paper.
 * @param paper - Record to key; only identity fields are read.
 * @returns a prefixed key naming the identifier that was used.
 */
export function paperIdentityKey(paper: PaperIdentity): string {
  const pmid = paper.pmid?.trim()
  if (pmid !== undefined && pmid !== '') return `pmid:${pmid.toLowerCase()}`
  const doi = paper.doi
  if (doi !== undefined && normalizeDoi(doi) !== '') return `doi:${normalizeDoi(doi)}`
  const pmcid = paper.pmcid?.trim()
  if (pmcid !== undefined && pmcid !== '') return `pmcid:${pmcid.toLowerCase()}`
  return `title:${normalizeParagraph(paper.title).toLowerCase()}|${publicationYear(paper.publicationDate)}`
}

/**
 * Drop later records that duplicate an earlier one under {@link paperIdentityKey}.
 * @param papers - Records in retrieval order; the first occurrence is kept.
 * @returns the kept records plus every dropped duplicate with its kept peer.
 */
export function dedupePapers<T extends PaperIdentity>(papers: readonly T[]): DedupeResult<T> {
  const keptByKey = new Map<string, T>()
  const kept: T[] = []
  const duplicates: Array<DuplicatePair<T>> = []
  for (const paper of papers) {
    const key = paperIdentityKey(paper)
    const previous = keptByKey.get(key)
    if (previous !== undefined) {
      duplicates.push({ key, kept: previous, dropped: paper })
      continue
    }
    keptByKey.set(key, paper)
    kept.push(paper)
  }
  return { papers: kept, duplicates }
}
