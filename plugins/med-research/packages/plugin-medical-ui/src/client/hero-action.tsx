/** Blank-session Hero entry point for the Med Research project workspace. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MedUiKey } from '../i18n/index.ts'
import { NS } from './locales.ts'

/** Runtime and locale props for the Med Research Hero action. */
export type MedResearchLaunchProps = PropsRuntime<'conversation.hero.actions'> & PropsLocale<typeof NS>
export type MedResearchRootLaunchProps = PropsRuntime<'conversation.hero.launch'> & PropsLocale<typeof NS>

const HOME_VIEW = 'med-home'
const OPEN_RESEARCH: MedUiKey = 'home.openWorkspace'

/**
 * Opens the project workspace home before the first model message.
 * @param props - Session view navigation and the Med Research locale.
 * @returns the project-workspace launch button.
 */
export function MedResearchLaunch({ openView, t }: MedResearchLaunchProps) {
  return (
    <button type="button" onClick={() => { openView(HOME_VIEW, '') }}>
      {t(OPEN_RESEARCH)}
    </button>
  )
}

/** Starts a new Session and selects the Med Research home from the root Hero. */
export function MedResearchRootLaunch({ startSession, t }: MedResearchRootLaunchProps) {
  return (
    <button type="button" onClick={() => { startSession(HOME_VIEW) }}>
      {t(OPEN_RESEARCH)}
    </button>
  )
}
