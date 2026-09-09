import { describe, expect, it } from 'vitest'
import { en, zh, type Dictionary } from '../src/i18n/index.ts'
import { evidenceUiState } from '../src/state/evidence.ts'
import { nextResearchState, UiTransitionError } from '../src/state/research.ts'
import { nextStatisticsState } from '../src/state/statistics.ts'

describe('research view machine (SPEC §43)', () => {
  it('walks the happy path', () => {
    let state = nextResearchState('IDLE', 'plan')
    for (const [event, expected] of [
      ['plan_ready', 'PLAN_READY'], ['search', 'SEARCHING'], ['papers_ready', 'PAPERS_READY'],
      ['retrieve', 'RETRIEVING_EVIDENCE'], ['locate', 'LOCATING'], ['verify', 'VERIFYING'],
      ['answer_ready', 'ANSWER_READY'],
    ] as const) state = nextResearchState(state, event)
    expect(state).toBe('ANSWER_READY')
  })

  it('falls to ERROR_PARTIAL from any stage and resets', () => {
    expect(nextResearchState('SEARCHING', 'partial_failure')).toBe('ERROR_PARTIAL')
    expect(nextResearchState('ERROR_PARTIAL', 'reset')).toBe('IDLE')
  })

  it('rejects an event that cannot occur', () => {
    expect(() => nextResearchState('IDLE', 'answer_ready')).toThrow(UiTransitionError)
  })
})

describe('statistics view machine (SPEC §45)', () => {
  it('waits for approval before executing', () => {
    let state = nextStatisticsState('NO_DATASET', 'upload')
    state = nextStatisticsState(state, 'profiled')
    state = nextStatisticsState(state, 'plan')
    state = nextStatisticsState(state, 'plan_ready')
    state = nextStatisticsState(state, 'approve')
    expect(state).toBe('WAITING_APPROVAL')
    expect(() => nextStatisticsState(state, 'execute')).toThrow(/not valid/)
    state = nextStatisticsState(state, 'generate')
    state = nextStatisticsState(state, 'execute')
    expect(state).toBe('EXECUTING')
    expect(nextStatisticsState(state, 'failed')).toBe('FAILED')
    expect(nextStatisticsState(state, 'succeeded')).toBe('SUCCEEDED')
  })
})

describe('evidence display state (SPEC §44)', () => {
  it('derives every state from stored fields', () => {
    expect(evidenceUiState({ sourceType: 'fulltext', locatorStatus: 'FOUND', supportStatus: 'VERIFIED' })).toBe('FULLTEXT_FOUND')
    expect(evidenceUiState({ sourceType: 'fulltext', locatorStatus: 'PARTIAL', supportStatus: 'PENDING' })).toBe('FULLTEXT_PARTIAL')
    expect(evidenceUiState({ sourceType: 'abstract', locatorStatus: 'FOUND', supportStatus: 'VERIFIED' })).toBe('ABSTRACT_FOUND')
    expect(evidenceUiState({ sourceType: 'abstract', locatorStatus: 'PARTIAL', supportStatus: 'PENDING' })).toBe('ABSTRACT_PARTIAL')
    expect(evidenceUiState({ sourceType: 'secondary_citation', locatorStatus: 'FOUND', supportStatus: 'VERIFIED' })).toBe('SECONDARY')
    expect(evidenceUiState({ sourceType: 'fulltext', locatorStatus: 'NOT_FOUND', supportStatus: 'REJECTED' })).toBe('NOT_FOUND')
    expect(evidenceUiState({ sourceType: 'fulltext', locatorStatus: 'FOUND', supportStatus: 'REJECTED' })).toBe('REJECTED')
  })
})

describe('locale dictionaries (AGENTS.md §2.7)', () => {
  it('zh satisfies the English dictionary shape exactly', () => {
    const keys = (value: object): string[] => Object.entries(value).flatMap(([key, child]) =>
      typeof child === 'object' && child !== null ? keys(child as object).map(inner => `${key}.${inner}`) : [key])
    const zhDictionary: Dictionary = zh
    expect(keys(zhDictionary).sort()).toEqual(keys(en).sort())
  })

  it('has no empty copy', () => {
    const values = (value: object): string[] => Object.values(value).flatMap(child =>
      typeof child === 'object' && child !== null ? values(child as object) : [child as string])
    expect(values(en).every(text => text.trim() !== '')).toBe(true)
    expect(values(zh).every(text => text.trim() !== '')).toBe(true)
  })
})
