/**
 * Locale dictionaries (AGENTS.md §2.7, SPEC §42.4). Product copy is looked up
 * by key, never hardcoded in a component.
 * @module @medresearch/dsh-plugin-medical-ui/src/i18n
 */

export { en, type Dictionary, type MedUiKey } from './en.ts'
export { zh } from './zh.ts'

/** Supported locales. */
export const LOCALES = ['zh', 'en'] as const
/** Locale identifier. */
export type Locale = (typeof LOCALES)[number]
