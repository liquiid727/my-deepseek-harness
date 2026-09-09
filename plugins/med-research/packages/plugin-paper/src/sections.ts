/**
 * Section classification (SPEC §10). Titles are matched in order, first match
 * wins; an unrecognized title becomes `other` rather than being guessed.
 * @module @medresearch/dsh-plugin-paper/src/sections
 */

import type { SectionType } from '@medresearch/dsh-medical-contracts'

const RULES: ReadonlyArray<readonly [RegExp, SectionType]> = [
  [/^abstract/iu, 'abstract'],
  [/introduction|background/iu, 'introduction'],
  [/method|material|procedure|study design|statistical analys/iu, 'methods'],
  [/result|finding/iu, 'results'],
  [/discussion/iu, 'discussion'],
  [/conclusion|summary/iu, 'conclusion'],
  [/reference|bibliograph/iu, 'references'],
]

/**
 * Classify a section title.
 * @param title - Section heading as parsed from the document.
 * @returns the section type; `other` when no rule matches.
 */
export function inferSectionType(title: string): SectionType {
  for (const [pattern, type] of RULES) {
    if (pattern.test(title)) return type
  }
  return 'other'
}
