/** Skill catalog view for S07. */

import { useCallback, useState } from 'react'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MedViewProps } from './views.tsx'
import { MedFailure, useMedLoad, useMedProjectName, useMedSessionProject } from './views.tsx'
import { MedBreadcrumb, MedViewFrame as MedPanel } from './components.tsx'
import css from './components.module.css'

/** Inspect all required built-in skill definitions and their declared seams. */
export function SkillsView({ remote, t, sessionId }: MedViewProps) {
  const [query, setQuery] = useState('')
  const binding = useMedSessionProject(remote, sessionId)
  const projectName = useMedProjectName(remote, binding.value?.projectId)
  const skills = useMedLoad(useCallback((signal: AbortSignal) => remote.skills.catalog(query, signal), [remote, query]), [remote, query])
  return <MedPanel
    crumb={<MedBreadcrumb page={t('view.skills')} project={projectName} t={t} />}
    state={t('skills.builtin')}
    title={t('view.skills')}
  >
    <p>{t('skills.description')}</p>
    <Input aria-label={t('skills.title')} size="md" value={query} onChange={event => { setQuery(event.currentTarget.value) }} />
    {skills.error === undefined ? null : <MedFailure message={skills.error} label={t('action.retry')} onReload={skills.reload} />}
    {(skills.value ?? []).length === 0 && !skills.loading ? <p>{t('skills.empty')}</p> : null}
    <ul className={css.evidenceList}>{(skills.value ?? []).map(skill => <li className={css.evidenceItem} key={skill.id}><strong>{skill.definition.name}</strong><p>{skill.definition.description}</p><small>{t('skills.tools')}: {skill.definition.tools.join(', ')} · {t('skills.triggers')}: {skill.definition.triggers.join(', ')}</small></li>)}</ul>
  </MedPanel>
}
