import { describe, expect, it } from 'vitest'
import {
  applyLocatorResult,
  assertEvidenceStatusPair,
  EvidenceStatusViolation,
  isValidEvidenceStatusPair,
} from '../src/evidence-state.ts'

describe('evidence status machine (SPEC §11 hard constraints)', () => {
  it('accepts every legal pair', () => {
    for (const locator of ['FOUND', 'PARTIAL'] as const) {
      for (const support of ['PENDING', 'VERIFIED', 'REJECTED'] as const) {
        expect(isValidEvidenceStatusPair(locator, support)).toBe(true)
        expect(() => assertEvidenceStatusPair(locator, support)).not.toThrow()
      }
    }
    expect(isValidEvidenceStatusPair('NOT_FOUND', 'REJECTED')).toBe(true)
  })

  it('rejects VERIFIED on a NOT_FOUND locator', () => {
    expect(isValidEvidenceStatusPair('NOT_FOUND', 'VERIFIED')).toBe(false)
    expect(() => assertEvidenceStatusPair('NOT_FOUND', 'VERIFIED')).toThrow(EvidenceStatusViolation)
  })

  it('rejects PENDING on a NOT_FOUND locator', () => {
    expect(isValidEvidenceStatusPair('NOT_FOUND', 'PENDING')).toBe(false)
    expect(() => assertEvidenceStatusPair('NOT_FOUND', 'PENDING')).toThrow(/NOT_FOUND requires REJECTED/)
  })

  it('forces REJECTED whenever the locator is NOT_FOUND', () => {
    expect(applyLocatorResult('NOT_FOUND', 'VERIFIED')).toBe('REJECTED')
    expect(applyLocatorResult('NOT_FOUND', 'PENDING')).toBe('REJECTED')
    expect(applyLocatorResult('NOT_FOUND', 'REJECTED')).toBe('REJECTED')
  })

  it('keeps the requested status for locatable evidence', () => {
    expect(applyLocatorResult('FOUND', 'VERIFIED')).toBe('VERIFIED')
    expect(applyLocatorResult('PARTIAL', 'PENDING')).toBe('PENDING')
    expect(applyLocatorResult('PARTIAL', 'REJECTED')).toBe('REJECTED')
  })

  it('never returns a pair that assertEvidenceStatusPair rejects', () => {
    for (const locator of ['FOUND', 'PARTIAL', 'NOT_FOUND'] as const) {
      for (const requested of ['PENDING', 'VERIFIED', 'REJECTED'] as const) {
        const support = applyLocatorResult(locator, requested)
        expect(isValidEvidenceStatusPair(locator, support)).toBe(true)
      }
    }
  })
})
