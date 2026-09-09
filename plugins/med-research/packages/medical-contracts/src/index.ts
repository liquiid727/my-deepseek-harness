/**
 * Public surface of the Med Research contracts package: branded ids, entity
 * types and zod schemas, the shared error model, and the `med` service
 * definitions. Implementations live in their plugins; this package carries no
 * runtime behavior beyond schema construction.
 * @module @medresearch/dsh-medical-contracts
 */

export * from './ids.ts'
export * from './research.ts'
export * from './statistics.ts'
export * from './audit.ts'
export * from './errors.ts'
export * from './routes.ts'
export * from './tool-envelope.ts'
export * from './services.ts'
