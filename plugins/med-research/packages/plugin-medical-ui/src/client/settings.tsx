/**
 * Med Research settings page (SPEC §42.2). The deployment profile owns the
 * plugin configuration; the page states where it comes from instead of
 * rendering values the client cannot read.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/settings
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import css from './components.module.css'

/** Full props of the Med Research settings section. */
export type MedSettingsProps = PropsRuntime<'settings.section'> & PropsLocale<typeof NS>

/**
 * Render the Med Research settings page.
 * @param props - Settings owner share and the declared locale seat.
 * @returns the page body.
 */
export function MedSettingsSection({ t }: MedSettingsProps) {
  return (
    <section className={css.settings}>
      <h2 className={css.settingsTitle}>{t('settings.title')}</h2>
      <p className={css.settingsIntro}>{t('settings.intro')}</p>
    </section>
  )
}
