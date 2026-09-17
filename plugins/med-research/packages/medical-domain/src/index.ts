/**
 * Public surface of the pure Med Research domain layer. It has no DSH
 * dependency: normalization, alignment, evidence state, de-duplication, and
 * the Citation Gate are plain functions the host plugins call (SPEC §3).
 * @module @medresearch/dsh-medical-domain
 */

export * from './normalize.ts'
export * from './alignment.ts'
export * from './evidence-state.ts'
export * from './dedup.ts'
export * from './claim-gate.ts'
export * from './bm25.ts'
export * from './citation.ts'
export * from './selection-actions.ts'
