/**
 * Root-Hero entry point of the Med Research project workspace. The workbench
 * home is the Session landing surface, so this is the only launch control: the
 * blank-Session Hero row no longer carries a second, unstyled copy of it.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/hero-action
 */

import type { ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MedUiKey } from '../i18n/index.ts'
import { NS } from './locales.ts'

/** Runtime and locale props of the root-Hero launch control. */
export type MedResearchRootLaunchProps = PropsRuntime<'conversation.hero.launch'> & PropsLocale<typeof NS>

const HOME_VIEW = 'med-home'
const OPEN_RESEARCH: MedUiKey = 'home.openWorkspace'

/**
 * Starts a new Session with the project workspace home already selected.
 * @param props - Host session launch and the Med Research locale.
 * @returns the project-workspace launch button.
 */
export function MedResearchRootLaunch({ startSession, t }: MedResearchRootLaunchProps): ReactElement {
  return (
    <Button
      onClick={() => { startSession(HOME_VIEW) }}
      size="lg"
      variant="outline"
    >
      {t(OPEN_RESEARCH)}
    </Button>
  )
}
