/**
 * The S01 project overview (0917 图 1, UI-PROJECT) — the session's landing page.
 *
 * It is the page the right column's assistant belongs to: 图 1 has no centre
 * input, so this page hands its message box to the inspector and opens that
 * panel on mount. The host still renders its own composer for a View that does
 * not claim the outlet, which would put a second input on screen; the page
 * therefore claims the outlet into a node it does not draw. That is the one
 * place this file works around the host rather than with it, and it is
 * registered as a declared difference in `ui-acceptance.md`.
 *
 * Every number on the page is a persisted counter from the project service:
 * a domain the service cannot read shows "unknown", and one whose records
 * carry no timestamp simply has no growth chip.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/home
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MedUiKey } from '../i18n/index.ts'
import type { Paper, ProjectId, ProjectOverviewCounter } from '@medresearch/dsh-medical-contracts'
import {
  MedDatasetIcon, MedEvidenceIcon, MedHomeIcon, MedInspireIcon, MedLibraryIcon, MedPaperIcon,
} from './icons.tsx'
import { MedAsyncState, MedMetricTile, MedPageHeader, MedPageTabs, MedSplit, type MedPageTab } from './components.tsx'
import { encodePaperFocus, encodePageFocus } from './focus.ts'
import { useHandOffInput } from './panel-input.ts'

/** The evidence counter opens the research View's evidence segment (图 4). */
const EVIDENCE_PAGE_FOCUS = encodePageFocus('evidence')
import { MedFailure, useMedLoad, useMedProjectName, useMedResolvedSessionProject } from './views.tsx'
import { NS, type MedViewInjected } from './locales.ts'

/** Full props of the project overview: Conversation view kit + Remote inject + locale. */
export type MedHomeProps =
  & ConvViewProps
  & InjectFace<MedViewInjected>
  & PropsLocale<typeof NS>

/** In-page segments of 图 1's tool row. */
type OverviewTab = 'overview' | 'papers' | 'notes' | 'documents' | 'datasets' | 'sessions'

/** Rows of the recent-activity split. */
const RECENT_ROWS = 3

/** One overview counter card. */
interface CounterCard {
  readonly id: string
  readonly label: MedUiKey
  /** One line under the label, from the prototype's cards. */
  readonly note: MedUiKey
  readonly counter: ProjectOverviewCounter
  readonly tone: 'blue' | 'green' | 'purple' | 'orange'
  readonly Icon: (props: { readonly size?: number }) => React.ReactElement
  /** Target View; absent renders a card that says why it has none. */
  readonly view?: string
  /** Opaque focus the target decodes (the evidence page is a page segment). */
  readonly focus?: string
  readonly noTarget?: MedUiKey
}

/**
 * The S01 project overview.
 * @param props - Conversation view kit, the Remote client, the inspector opener, and locale.
 * @returns the overview, or nothing without a session (session-scoped).
 */
export function MedHomeView({
  remote, t, openView, useSession, useSessions, sessionId, mountComposer, openInspector,
}: MedHomeProps) {
  const session = useSession(snapshot => snapshot)
  const [tab, setTab] = useState<OverviewTab>('overview')
  const composerId = useId()
  const composerPlaceholder = t('home.inputPlaceholder')

  const cwd = useSessions(snapshot => snapshot.byId[sessionId]?.cwd)
  const binding = useMedResolvedSessionProject(remote, sessionId, cwd)
  const projectId = binding.value?.projectId
  const project = useMedLoad(
    useCallback(
      (signal: AbortSignal) => projectId === undefined
        ? Promise.resolve(undefined)
        : remote.projects.get(projectId, signal),
      [remote, projectId],
    ),
    [projectId],
  )
  const overview = useMedLoad(
    useCallback(
      (signal: AbortSignal) => projectId === undefined
        ? Promise.resolve(undefined)
        : remote.projects.overview(projectId, signal),
      [remote, projectId],
    ),
    [projectId],
  )
  const papers = useMedLoad(
    useCallback(
      (signal: AbortSignal) => projectId === undefined
        ? Promise.resolve<Paper[]>([])
        : remote.knowledge.listPapers({ projectId }, signal),
      [remote, projectId],
    ),
    [projectId],
  )
  const notes = useMedLoad(
    useCallback(
      (signal: AbortSignal) => projectId === undefined
        ? Promise.resolve([])
        : remote.papers.listNotes({ projectId }, signal),
      [remote, projectId],
    ),
    [projectId],
  )
  const projectName = useMedProjectName(remote, projectId)

  // The page's message box lives in the assistant panel, so the page both tells
  // the panel it owns the box and brings that panel forward.
  useHandOffInput('med-home', projectId !== undefined)
  useEffect(() => {
    if (projectId === undefined) return
    openInspector?.()
  }, [projectId, openInspector])

  // Claiming the outlet is what stops the host from docking its own composer at
  // the foot of this page; the node is deliberately not drawn (see the module
  // comment). Releasing on unmount hands the composer back to the host.
  useLayoutEffect(() => {
    if (session === undefined || projectId === undefined) return
    return mountComposer(composerId, {
      onMessageAccepted: () => { openView('chat', '') },
      placeholder: composerPlaceholder,
    })
  }, [composerId, composerPlaceholder, openView, mountComposer, session !== undefined, projectId])

  // `knowledge.listPapers` does not promise an order, so the page sorts the
  // paper records by their own creation time for the two recent lists.
  const recentPapers = useMemo(
    () => [...(papers.value ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [papers.value],
  )
  const recentNotes = useMemo(
    () => [...(notes.value ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [notes.value],
  )

  const segments = useMemo<readonly MedPageTab<OverviewTab>[]>(() => [
    { id: 'overview', label: t('home.tab.overview') },
    { id: 'papers', label: t('home.tab.papers') },
    { id: 'notes', label: t('home.tab.notes'), reason: t('home.tab.notesReason') },
    { id: 'documents', label: t('home.tab.documents'), reason: t('home.tab.documentsReason') },
    { id: 'datasets', label: t('home.tab.datasets') },
    { id: 'sessions', label: t('home.tab.sessions') },
  ], [t])

  // 概览 is where we already are; 文献/数据/会话 navigate out, and the two
  // segments whose page is not registered say so instead of looking clickable.
  const goTo = useMemo<Partial<Record<OverviewTab, () => void>>>(() => ({
    overview: () => { setTab('overview') },
    papers: () => { openView('med-knowledge', '') },
    datasets: () => { openView('med-statistics', '') },
    sessions: () => { openView('chat', '') },
  }), [openView])

  if (session === undefined) return null

  if (binding.error !== undefined) {
    return (
      <section className="researchPanel">
        <div className="researchShell">
          <MedFailure message={binding.error} label={t('error.load')} onReload={binding.reload} />
        </div>
      </section>
    )
  }

  if (projectId === undefined) {
    return (
      <section className="researchPanel">
        <div className="researchShell">
          <MedPageHeader title={projectName ?? t('home.noProject')} />
          <p className="state">{binding.loading ? t('home.loading') : t('home.noProjectHint')}</p>
          {/* The claim still runs once a project exists; before that the host
              keeps its own docked composer so the page is never input-free. */}
        </div>
      </section>
    )
  }

  const counters: readonly CounterCard[] = [
    { counter: overview.value?.papers ?? { status: 'unavailable' }, Icon: MedLibraryIcon, id: 'papers', label: 'home.count.papers', note: 'home.note.papers', tone: 'blue', view: 'med-knowledge' },
    { counter: overview.value?.evidences ?? { status: 'unavailable' }, Icon: MedEvidenceIcon, id: 'evidences', label: 'home.count.evidence', note: 'home.note.evidence', focus: EVIDENCE_PAGE_FOCUS, tone: 'green', view: 'med-research' },
    { counter: overview.value?.notes ?? { status: 'unavailable' }, Icon: MedInspireIcon, id: 'notes', label: 'home.count.notes', note: 'home.note.notes', noTarget: 'home.tileNoTarget', tone: 'purple' },
    { counter: overview.value?.documents ?? { status: 'unavailable' }, Icon: MedPaperIcon, id: 'documents', label: 'home.count.documents', note: 'home.note.documents', noTarget: 'home.tileNoTarget', tone: 'orange' },
    { counter: overview.value?.datasets ?? { status: 'unavailable' }, Icon: MedDatasetIcon, id: 'datasets', label: 'home.count.datasets', note: 'home.note.datasets', tone: 'blue', view: 'med-statistics' },
    { counter: overview.value?.sessions ?? { status: 'unavailable' }, Icon: MedHomeIcon, id: 'sessions', label: 'home.count.sessions', note: 'home.note.sessions', tone: 'green', view: 'chat' },
  ]

  const lastPaper = recentPapers[0]

  return (
    <section className="researchPanel">
      <div className="researchShell">
        <MedPageHeader
          actions={(
            <Button
              onClick={() => { void project.reload() }}
              size="sm"
              variant="outline"
            >
              {t('action.reload')}
            </Button>
          )}
          crumb={<span className="medCrumb">{t('nav.project')} <span aria-hidden="true" className="medCrumbSep">›</span> <span className="medCrumbPage">{projectName ?? t('home.loading')}</span></span>}
          description={project.value?.researchQuestion ?? project.value?.background}
          display
          meta={(
            <>
              <span>{t('home.createdAt')} {project.value?.createdAt ?? t('home.count.unknown')}</span>
              <span>{t('home.updatedAt')} {project.value?.updatedAt ?? t('home.count.unknown')}</span>
            </>
          )}
          status={{ label: project.value?.status === 'archived' ? t('home.status.archived') : t('home.status.active'), tone: project.value?.status === 'archived' ? 'archived' : 'active' }}
          title={project.value?.name ?? t('home.loading')}
        />

        <div className="medOverviewTabs">
          <MedPageTabs
            label={t('home.overview')}
            onChange={id => { goTo[id]?.() }}
            tabs={segments}
            value={tab}
          />
        </div>

        {project.error === undefined ? null : (
          <MedFailure message={project.error} label={t('error.load')} onReload={project.reload} />
        )}

        <section aria-label={t('home.overview')} className="medCounters">
          {overview.error === undefined ? null : (
            <MedAsyncState message={overview.error} retryLabel={t('home.count.retry')} onRetry={overview.reload} />
          )}
          <div className="medTileRow">
            {counters.map(({ id, label, note, counter, tone, Icon, view, focus, noTarget }) => {
              const value = counter.status === 'counted'
                ? String(counter.value)
                : t('home.count.unknown')
              const delta = counter.status === 'counted' && counter.delta !== undefined
                ? {
                  label: `↑${counter.delta.value}`,
                  title: t('home.deltaTitle').replace('{days}', String(counter.delta.windowDays)),
                  tone: counter.delta.value > 0 ? 'up' as const : 'flat' as const,
                }
                : undefined
              return (
                <MedMetricTile
                  delta={delta}
                  disabledLabel={noTarget === undefined ? undefined : t(noTarget)}
                  icon={<Icon size={20} />}
                  key={id}
                  label={t(label)}
                  note={t(note)}
                  onOpen={view === undefined ? undefined : () => { openView(view, focus ?? '') }}
                  onRetry={counter.status === 'counted' ? undefined : overview.reload}
                  retryLabel={counter.status === 'counted' ? undefined : t('home.count.retry')}
                  tone={tone}
                  value={value}
                />
              )
            })}
          </div>
        </section>

        {lastPaper === undefined ? null : (
          <section aria-label={t('home.resume')} className="medResume">
            <span className="medResumeLabel">{t('home.resume')}</span>
            <span className="medResumeTitle">{lastPaper.title}</span>
            <span className="medResumeMeta">{lastPaper.journal ?? ''} {lastPaper.publicationDate ?? ''}</span>
            <Button
              onClick={() => { openView('med-knowledge', encodePaperFocus({ paperId: lastPaper.id })) }}
              size="sm"
              variant="primary"
            >
              {t('home.resumeRead')}
            </Button>
          </section>
        )}

        <MedSplit label={t('home.recent')} ratio="even">
          <section aria-label={t('home.recentPapers')} className="medRecent">
            <h3 className="medSectionTitle">{t('home.recentPapers')}</h3>
            {papers.error === undefined ? null : (
              <MedFailure message={papers.error} label={t('error.load')} onReload={papers.reload} />
            )}
            <ul className="medRecentList">
              {recentPapers.length === 0 ? <li className="state">{t('empty.papers')}</li> : null}
              {recentPapers.slice(0, RECENT_ROWS).map(paper => (
                <li key={paper.id}>
                  <button
                    className="medRecentRow"
                    onClick={() => { openView('med-knowledge', encodePaperFocus({ paperId: paper.id })) }}
                    type="button"
                  >
                    <span className="medRecentRowTitle">{paper.title}</span>
                    <span className="medRecentRowMeta">{paper.journal ?? paper.pmid ?? t('home.count.unknown')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label={t('home.recentNotes')} className="medRecent">
            <h3 className="medSectionTitle">{t('home.recentNotes')}</h3>
            {notes.error === undefined ? null : (
              <MedFailure message={notes.error} label={t('error.load')} onReload={notes.reload} />
            )}
            <ul className="medRecentList">
              {recentNotes.length === 0 ? <li className="state">{t('home.emptyNotes')}</li> : null}
              {recentNotes.slice(0, RECENT_ROWS).map(note => (
                <li className="medRecentNote" key={note.id}>
                  <span className="medRecentRowTitle">{note.title}</span>
                  <span className="medRecentRowMeta">{note.paperId === undefined ? t('inspector.project') : t('view.papers')}</span>
                </li>
              ))}
            </ul>
          </section>
        </MedSplit>

        <section aria-label={t('home.tasks')} className="medRecent">
          <h3 className="medSectionTitle">{t('home.tasks')}</h3>
          {/* The tasks domain has no entity or service yet, so the section
              states that instead of showing an empty list that would read as
              "you have no tasks". */}
          <p className="state">{t('home.tasksReason')}</p>
        </section>

        <div className="medComposerHandoff" id={composerId} />
      </div>
    </section>
  )
}
