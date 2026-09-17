/** Project knowledge view for S06. */

import { useCallback, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MedViewProps } from './views.tsx'
import { MedFailure, useMedLoad } from './views.tsx'
import { MedSectionHeader, MedViewFrame as MedPanel } from './components.tsx'
import css from './components.module.css'

/** Browse project papers, tags, and persisted Drafts through the Remote layer. */
export function KnowledgeView({ remote, t, useSession, sessionId, openView }: MedViewProps) {
  const project = useMedLoad(useCallback((signal: AbortSignal) => remote.projects.sessionProject(sessionId, signal), [remote, sessionId]), [remote, sessionId])
  const projectId = project.value?.projectId
  const [query, setQuery] = useState('')
  const papers = useMedLoad(useCallback((signal: AbortSignal) => projectId === undefined ? Promise.resolve([]) : remote.knowledge.listPapers({ projectId, query }, signal), [remote, projectId, query]), [remote, projectId, query])
  const tags = useMedLoad(useCallback((signal: AbortSignal) => projectId === undefined ? Promise.resolve([]) : remote.knowledge.listTags(projectId, signal), [remote, projectId]), [remote, projectId])
  const drafts = useMedLoad(useCallback((signal: AbortSignal) => projectId === undefined ? Promise.resolve([]) : remote.knowledge.listDrafts(projectId, signal), [remote, projectId]), [remote, projectId])
  if (project.value === undefined) return <MedPanel title={t('view.knowledge')} state={t('research.IDLE')}>{project.loading ? <p>{t('home.loading')}</p> : <p>{t('knowledge.noProject')}</p>}</MedPanel>
  return <MedPanel title={t('view.knowledge')} state={t('research.PAPERS_READY')}>
    <div className="researchQuestionBar"><Input aria-label={t('knowledge.search')} size="md" value={query} onChange={event => { setQuery(event.currentTarget.value) }} placeholder={t('knowledge.searchPlaceholder')} /></div>
    {papers.error === undefined ? null : <MedFailure message={papers.error} label={t('action.retry')} onReload={papers.reload} />}
    <MedSectionHeader title={t('knowledge.papers')} meta={String(papers.value?.length ?? 0)} />
    <ul className={css.documentList}>{(papers.value ?? []).map(paper => <li key={paper.id}><Button size="sm" variant="ghost" onClick={() => { openView('med-papers', paper.id) }}>{paper.title}</Button><small> {paper.pmid ?? paper.doi ?? t('home.count.unknown')}</small></li>)}</ul>
    <MedSectionHeader title={t('knowledge.tags')} meta={String(tags.value?.length ?? 0)} />
    <p>{(tags.value ?? []).map(tag => tag.name).join(' · ') || t('knowledge.empty')}</p>
    <MedSectionHeader title={t('knowledge.drafts')} meta={String(drafts.value?.length ?? 0)} />
    <ul className={css.documentList}>{(drafts.value ?? []).map(draft => <li key={draft.id}><Button size="sm" variant="ghost" onClick={() => { openView('med-writing', draft.id) }}>{draft.title || t('knowledge.drafts')}</Button> — {draft.status}</li>)}</ul>
  </MedPanel>
}
