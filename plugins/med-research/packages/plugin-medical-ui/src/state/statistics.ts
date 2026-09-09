/**
 * Statistics view state machine (SPEC §45). `WAITING_APPROVAL` is a real state:
 * nothing executes until the user confirms, and a failed run keeps its code and
 * stderr instead of showing a result.
 * @module @medresearch/dsh-plugin-medical-ui/src/state/statistics
 */

/** Every Statistics view state (SPEC §45). */
export type StatisticsUiState =
  | 'NO_DATASET' | 'PROFILING' | 'READY' | 'PLANNING' | 'PLAN_READY'
  | 'WAITING_APPROVAL' | 'GENERATING_CODE' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED'

/** Events the Statistics view may receive. */
export type StatisticsUiEvent =
  | 'upload' | 'profiled' | 'plan' | 'plan_ready' | 'approve' | 'generate' | 'execute'
  | 'succeeded' | 'failed' | 'reset'

const NEXT: Readonly<Partial<Record<StatisticsUiState, Partial<Record<StatisticsUiEvent, StatisticsUiState>>>>> = {
  NO_DATASET: { upload: 'PROFILING' },
  PROFILING: { profiled: 'READY' },
  READY: { plan: 'PLANNING' },
  PLANNING: { plan_ready: 'PLAN_READY' },
  PLAN_READY: { approve: 'WAITING_APPROVAL' },
  WAITING_APPROVAL: { generate: 'GENERATING_CODE' },
  GENERATING_CODE: { execute: 'EXECUTING' },
  EXECUTING: { succeeded: 'SUCCEEDED', failed: 'FAILED' },
}

/**
 * Apply one event to the Statistics state.
 * @param state - Current state.
 * @param event - Event to apply.
 * @returns the next state.
 * @throws Error when the event is invalid for the state.
 */
export function nextStatisticsState(state: StatisticsUiState, event: StatisticsUiEvent): StatisticsUiState {
  if (event === 'reset') return 'NO_DATASET'
  const next = NEXT[state]?.[event]
  if (next === undefined) throw new Error(`event '${event}' is not valid in state '${state}'`)
  return next
}
