/**
 * Client namespace and the typed state-label maps (AGENTS.md §2.7). Components
 * read every product string through `t`, and these maps keep the state
 * machines' literals type-checked against the dictionary key union.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/locales
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { MedUiKey } from '../i18n/index.ts'
import type { EvidenceUiState } from '../state/evidence.ts'
import type { ResearchUiState } from '../state/research.ts'
import type { StatisticsUiState } from '../state/statistics.ts'
import type { MedRemote } from './remote.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Med Research view, state, action, and empty-state copy. */
    medResearch: MedUiKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'medResearch'

/** Display key of every Research view state (SPEC §43). */
export const RESEARCH_STATE_KEY: Record<ResearchUiState, MedUiKey> = {
  IDLE: 'research.IDLE',
  PLANNING: 'research.PLANNING',
  PLAN_READY: 'research.PLAN_READY',
  SEARCHING: 'research.SEARCHING',
  PAPERS_READY: 'research.PAPERS_READY',
  RETRIEVING_EVIDENCE: 'research.RETRIEVING_EVIDENCE',
  LOCATING: 'research.LOCATING',
  VERIFYING: 'research.VERIFYING',
  ANSWER_READY: 'research.ANSWER_READY',
  ERROR_PARTIAL: 'research.ERROR_PARTIAL',
}

/** Display key of every Statistics view state (SPEC §45). */
export const STATISTICS_STATE_KEY: Record<StatisticsUiState, MedUiKey> = {
  NO_DATASET: 'statistics.NO_DATASET',
  PROFILING: 'statistics.PROFILING',
  READY: 'statistics.READY',
  PLANNING: 'statistics.PLANNING',
  PLAN_READY: 'statistics.PLAN_READY',
  WAITING_APPROVAL: 'statistics.WAITING_APPROVAL',
  GENERATING_CODE: 'statistics.GENERATING_CODE',
  EXECUTING: 'statistics.EXECUTING',
  SUCCEEDED: 'statistics.SUCCEEDED',
  FAILED: 'statistics.FAILED',
}

/** Display key of every Evidence display state (SPEC §44). */
export const EVIDENCE_STATE_KEY: Record<EvidenceUiState, MedUiKey> = {
  FULLTEXT_FOUND: 'evidence.FULLTEXT_FOUND',
  FULLTEXT_PARTIAL: 'evidence.FULLTEXT_PARTIAL',
  ABSTRACT_FOUND: 'evidence.ABSTRACT_FOUND',
  ABSTRACT_PARTIAL: 'evidence.ABSTRACT_PARTIAL',
  SECONDARY: 'evidence.SECONDARY',
  NOT_FOUND: 'evidence.NOT_FOUND',
  REJECTED: 'evidence.REJECTED',
}

/** Business face every Med Research view receives through its registration's `inject`. */
export interface MedViewInjected {
  /** Typed Remote client over the live Connection. */
  readonly remote: MedRemote
}
