/**
 * Med Research client UI package root (host half). All UI behavior lives in the
 * browser entry; this half stays inert so the Loader composition can address
 * the package and discover its `dsh.client` bundle.
 * @module @medresearch/dsh-plugin-medical-ui
 */

export * from './state/index.ts'
export * from './i18n/index.ts'

/** Host plugin body — Med Research UI behavior exists only in the browser entry. */
export function apply(): void {}
