/**
 * Research view state machine (SPEC §43). Any stage may fall to
 * `ERROR_PARTIAL`, which is how "PubMed succeeded, 3 full texts failed" is
 * shown as partial success instead of a whole-page failure.
 * @module @medresearch/dsh-plugin-medical-ui/src/state/research
 */

/** Every Research view state (SPEC §43). */
export type ResearchUiState =
  | 'IDLE' | 'PLANNING' | 'PLAN_READY' | 'SEARCHING' | 'PAPERS_READY'
  | 'RETRIEVING_EVIDENCE' | 'LOCATING' | 'VERIFYING' | 'ANSWER_READY' | 'ERROR_PARTIAL'

/** Events the Research view may receive. */
export type ResearchUiEvent =
  | 'plan' | 'plan_ready' | 'search' | 'papers_ready' | 'retrieve' | 'locate' | 'verify'
  | 'answer_ready' | 'partial_failure' | 'reset'

const NEXT: Readonly<Partial<Record<ResearchUiState, Partial<Record<ResearchUiEvent, ResearchUiState>>>>> = {
  IDLE: { plan: 'PLANNING' },
  PLANNING: { plan_ready: 'PLAN_READY' },
  PLAN_READY: { search: 'SEARCHING' },
  SEARCHING: { papers_ready: 'PAPERS_READY' },
  PAPERS_READY: { retrieve: 'RETRIEVING_EVIDENCE' },
  RETRIEVING_EVIDENCE: { locate: 'LOCATING' },
  LOCATING: { verify: 'VERIFYING' },
  VERIFYING: { answer_ready: 'ANSWER_READY' },
}

/** Thrown when an event cannot occur in the current state. */
export class UiTransitionError extends Error {
  override readonly name = 'UiTransitionError'

  /**
   * @param state - State the event arrived in.
   * @param event - Event that has no transition.
   */
  constructor(readonly state: string, readonly event: string) {
    super(`event '${event}' is not valid in state '${state}'`)
  }
}

/**
 * Apply one event to the Research state.
 * @param state - Current state.
 * @param event - Event to apply.
 * @returns the next state.
 * @throws UiTransitionError when the event is invalid for the state.
 */
export function nextResearchState(state: ResearchUiState, event: ResearchUiEvent): ResearchUiState {
  if (event === 'reset') return 'IDLE'
  if (event === 'partial_failure') return 'ERROR_PARTIAL'
  const next = NEXT[state]?.[event]
  if (next === undefined) throw new UiTransitionError(state, event)
  return next
}
