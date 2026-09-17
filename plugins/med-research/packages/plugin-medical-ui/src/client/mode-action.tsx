/** Session-header Agent Mode control for the Med Research client. */

import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentMode } from '@medresearch/dsh-medical-contracts'
import type { MedUiKey } from '../i18n/index.ts'
import { NS } from './locales.ts'
import type { MedRemote } from './remote.ts'
import css from './components.module.css'

/** Business capability injected by the browser plugin. */
export interface MedModeInjected {
  readonly remote: MedRemote
}

/** Props of the session-header mode action. */
export type MedModeActionProps = PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<typeof NS>
  & InjectFace<MedModeInjected>

const MODES: readonly AgentMode[] = ['research', 'paper', 'statistics']
const MODE_LABEL: Record<AgentMode, MedUiKey> = {
  research: 'mode.research',
  paper: 'mode.paper',
  statistics: 'mode.statistics',
}

/**
 * Render and persist the current session's tool allowlist mode.
 * @param props - Session slot runtime, locale, and Remote dependencies.
 * @returns The mode selector element.
 */
export function MedModeAction({ sessionId, remote, t }: MedModeActionProps) {
  const [mode, setMode] = useState<AgentMode>('research')
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    setError(undefined)
    void remote.projects.getMode(String(sessionId)).then(
      value => { if (active) setMode(value) },
      cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)) },
    )
    return () => { active = false }
  }, [remote, sessionId])

  return (
    <label className={css.mode}>
      <span>{t('mode.label')}</span>
      <select
        aria-label={t('mode.label')}
        value={mode}
        onChange={(event) => {
          const next = event.currentTarget.value as AgentMode
          const previous = mode
          setMode(next)
          setError(undefined)
          void remote.projects.setMode(String(sessionId), next).catch(cause => {
            setMode(previous)
            setError(cause instanceof Error ? cause.message : String(cause))
          })
        }}
      >
        {MODES.map(item => <option key={item} value={item}>{t(MODE_LABEL[item])}</option>)}
      </select>
      {error === undefined ? null : <span role="alert">{error}</span>}
    </label>
  )
}
