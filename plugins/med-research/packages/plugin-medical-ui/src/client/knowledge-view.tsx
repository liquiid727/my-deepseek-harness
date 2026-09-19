/**
 * Project knowledge page for S06. The library owns two sections that are not
 * Views of their own: the paper reader (S03) and the draft editor (S08). Both
 * are selected inside this page, so the tab bar keeps to the five prototype
 * entries.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/knowledge-view
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DraftId, PaperId } from '@medresearch/dsh-medical-contracts'
import type { MedViewProps } from './views.tsx'
import { MedDraftEditor } from './writing-view.tsx'
import { MedFailure, MedPaperReader, useMedLoad, useMedProjectName, useMedSessionProject } from './views.tsx'
import { MedBreadcrumb, MedSectionHeader, MedViewFrame as MedPanel } from './components.tsx'
import { decodePaperFocus, encodePaperFocus } from './focus.ts'
import css from './components.module.css'

/** Browse project papers, tags, and persisted Drafts through the Remote layer. */
export function KnowledgeView({ remote, t, sessionId, openView, viewRequest, viewFocus, completeViewRequest }: MedViewProps) {
  const project = useMedSessionProject(remote, sessionId)
  const projectId = project.value?.projectId
  const projectName = useMedProjectName(remote, projectId)
  const [query, setQuery] = useState('')
  const [paperFocus, setPaperFocus] = useState<string>()
  const [draftId, setDraftId] = useState<DraftId>()

  // An outside navigation carries either a paper focus (a citation) or a draft
  // id; everything else is a plain library visit.
  const focus = viewRequest?.focus || viewFocus
  useEffect(() => {
    if (viewRequest === null) return
    if (focus !== undefined && focus !== '') {
      if (decodePaperFocus(focus) === undefined) setDraftId(focus as DraftId)
      else setPaperFocus(focus)
    }
    completeViewRequest()
  }, [viewRequest, focus, completeViewRequest])

  const papers = useMedLoad(useCallback((signal: AbortSignal) => projectId === undefined ? Promise.resolve([]) : remote.knowledge.listPapers({ projectId, query }, signal), [remote, projectId, query]), [remote, projectId, query])
  const tags = useMedLoad(useCallback((signal: AbortSignal) => projectId === undefined ? Promise.resolve([]) : remote.knowledge.listTags(projectId, signal), [remote, projectId]), [remote, projectId])
  const drafts = useMedLoad(useCallback((signal: AbortSignal) => projectId === undefined ? Promise.resolve([]) : remote.knowledge.listDrafts(projectId, signal), [remote, projectId]), [remote, projectId])

  if (project.value === undefined) {
    return (
      <MedPanel title={t('view.knowledge')} state={t('research.IDLE')}>
        {project.loading ? <p className="state">{t('home.loading')}</p> : <p className="state">{t('knowledge.noProject')}</p>}
      </MedPanel>
    )
  }

  const selectedPaper = paperFocus === undefined ? undefined : decodePaperFocus(paperFocus)
  return (
    <MedPanel
      crumb={<MedBreadcrumb page={t('view.knowledge')} project={projectName} t={t} />}
      state={t('research.PAPERS_READY')}
      title={t('view.knowledge')}
    >
      <div className="researchQuestionBar"><Input aria-label={t('knowledge.search')} size="md" value={query} onChange={event => { setQuery(event.currentTarget.value) }} placeholder={t('knowledge.searchPlaceholder')} /></div>
      {papers.error === undefined ? null : <MedFailure message={papers.error} label={t('action.retry')} onReload={papers.reload} />}
      <div className="medLibraryColumns">
        <div className="medLibraryList">
          <MedSectionHeader title={t('knowledge.papers')} meta={String(papers.value?.length ?? 0)} />
          <ul className={css.documentList}>{(papers.value ?? []).map(paper => <li key={paper.id}><Button size="sm" variant="ghost" onClick={() => { setPaperFocus(encodePaperFocus({ paperId: paper.id as PaperId })); setDraftId(undefined) }}>{paper.title}</Button><small> {paper.pmid ?? paper.doi ?? t('home.count.unknown')}</small></li>)}</ul>
          <MedSectionHeader title={t('knowledge.tags')} meta={String(tags.value?.length ?? 0)} />
          <p>{(tags.value ?? []).map(tag => tag.name).join(' · ') || t('knowledge.empty')}</p>
          <MedSectionHeader title={t('knowledge.drafts')} meta={String(drafts.value?.length ?? 0)} />
          <ul className={css.documentList}>{(drafts.value ?? []).map(draft => <li key={draft.id}><Button size="sm" variant="ghost" onClick={() => { setDraftId(draft.id); setPaperFocus(undefined) }}>{draft.title || t('knowledge.drafts')}</Button> — {draft.status}</li>)}</ul>
        </div>
        <div className="medLibraryDetail">
          {selectedPaper === undefined && draftId === undefined
            ? <p className="state">{t('knowledge.empty')}</p>
            : null}
          {selectedPaper === undefined ? null : (
            <MedPaperReader focus={selectedPaper} remote={remote} t={t} title={t('view.papers')} />
          )}
          {draftId === undefined ? null : (
            <MedDraftEditor draftId={draftId} remote={remote} t={t} />
          )}
        </div>
      </div>
    </MedPanel>
  )
}
