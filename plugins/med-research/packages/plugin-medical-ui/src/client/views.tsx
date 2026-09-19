/**
 * The four Med Research Conversation views (SPEC §42.2, §43–§45). Each view is
 * a pure function of the typed Remote client plus the framework standard kit:
 * it reads through `createMedRemote`, shows the state machine's current label
 * from the zh/en dictionaries, and never holds business data of its own.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/views
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, Field, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ClaimId,
  DatasetId,
  Paper,
  Project,
  ProjectId,
  QueryPlan,
  LiteratureSearchResult,
  ResearchQuery,
} from '@medresearch/dsh-medical-contracts'
import { nextResearchState, type ResearchUiEvent, type ResearchUiState } from '../state/research.ts'
import { nextStatisticsState, type StatisticsUiEvent, type StatisticsUiState } from '../state/statistics.ts'
import { MissingValuesChart } from './profile-chart.tsx'
import { MedResearchIcon } from './icons.tsx'
import { MedAsyncState, MedBreadcrumb, MedPageTabs, MedSectionHeader, MedSplit, MedViewFrame as MedPanel } from './components.tsx'
import { MedEvidencePage } from './evidence-view.tsx'
import { useHandOffInput } from './panel-input.ts'
import { decodeClaimFocus, decodePageFocus, encodePaperFocus, type MedPageSegment, type PaperFocus } from './focus.ts'
import {
  NS, RESEARCH_STATE_KEY, STATISTICS_STATE_KEY, type MedViewInjected,
} from './locales.ts'
import css from './components.module.css'

/** Full props of a Med Research Conversation view. */
export type MedViewProps = ConvViewProps & InjectFace<MedViewInjected> & PropsLocale<typeof NS>

/** One asynchronous read: the last value, the failure message, and a reload trigger. */
export interface MedLoad<T> {
  value: T | undefined
  error: string | undefined
  loading: boolean
  reload: () => void
}

/**
 * Hold one view state machine. The authoritative state lives in a ref so a
 * batch of events applies in the caller's order regardless of React's updater
 * evaluation, while `setState` still drives the render. An invalid transition
 * still throws from the machine, so a missing edge is loud, never absorbed.
 * @param initial - starting state.
 * @param next - pure transition function.
 * @returns the rendered state and an event dispatcher accepting one or many events.
 */
function useUiMachine<S, E>(
  initial: S,
  next: (state: S, event: E) => S,
): readonly [S, (events: E | readonly E[]) => void] {
  const current = useRef(initial)
  const [state, setState] = useState(initial)
  const advance = useCallback((events: E | readonly E[]) => {
    for (const event of Array.isArray(events) ? events : [events as E]) {
      current.current = next(current.current, event)
    }
    setState(current.current)
  }, [next])
  return [state, advance]
}

/**
 * Read one Remote value for the life of the view, aborting in-flight work on
 * unmount or dependency change.
 * @param load - reader receiving the caller's abort signal.
 * @param deps - dependency list; a change cancels the previous read and starts one.
 * @returns the read state and a reload trigger.
 */
export function useMedLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[] = []): MedLoad<T> {
  const [value, setValue] = useState<T>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(undefined)
    void load(controller.signal).then(
      (result) => {
        if (!active) return
        setValue(result)
        setLoading(false)
      },
      (cause: unknown) => {
        if (!active || controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : String(cause))
        setLoading(false)
      },
    )
    return () => {
      active = false
      controller.abort()
    }
    // The reader is recreated with the dependency list the caller owns.
  }, [...deps, revision])

  return { value, error, loading, reload: useCallback(() => { setRevision(current => current + 1) }, []) }
}

/**
 * Read the project bound to the current Session.
 * @param remote - typed Remote client.
 * @param sessionId - host Session id.
 * @returns the binding read state.
 */
export function useMedSessionProject(remote: MedViewProps['remote'], sessionId: string): MedLoad<{ projectId?: ProjectId } | undefined> {
  return useMedLoad(
    useCallback(
      (signal: AbortSignal) => remote.projects.sessionProject(sessionId, signal),
      [remote, sessionId],
    ),
    [remote, sessionId],
  )
}

/**
 * Resolve a Session's project through its persisted binding, with the
 * workspace directory as the same fallback used by the left project tree.
 * Older Sessions predate project bindings but still retain their workspace
 * path; treating that path as a fallback keeps the selected project and its
 * overview from disagreeing for those Sessions.
 * @param remote - Project Remote surface.
 * @param sessionId - Current host Session id.
 * @param cwd - Session working directory, if the host recorded one.
 * @returns The bound or workspace-derived project id and its loading state.
 */
export function useMedResolvedSessionProject(
  remote: MedViewProps['remote'], sessionId: string, cwd: string | undefined,
): MedLoad<{ projectId?: ProjectId } | undefined> {
  const binding = useMedSessionProject(remote, sessionId)
  const projects = useMedLoad(
    useCallback(
      (signal: AbortSignal) => cwd === undefined ? Promise.resolve<readonly Project[]>([]) : remote.projects.list(signal),
      [remote, cwd],
    ),
    [remote, cwd],
  )
  const fallback = cwd === undefined
    ? undefined
    : projects.value?.find(project => project.status === 'active' && project.workspacePath === cwd)?.id
  const projectId = binding.value?.projectId ?? fallback
  return {
    value: projectId === undefined ? binding.value : { projectId },
    error: binding.error ?? projects.error,
    loading: binding.loading || (binding.value?.projectId === undefined && cwd !== undefined && projects.loading),
    reload: () => { binding.reload(); projects.reload() },
  }
}

/**
 * Read one project's name for a page breadcrumb.
 * @param remote - typed Remote client.
 * @param projectId - bound project, absent before the binding resolves.
 * @returns the project name, or undefined while unknown.
 */
export function useMedProjectName(remote: MedViewProps['remote'], projectId: ProjectId | undefined): string | undefined {
  const project = useMedLoad(
    useCallback(
      (signal: AbortSignal) => projectId === undefined ? Promise.resolve(undefined) : remote.projects.get(projectId, signal),
      [remote, projectId],
    ),
    [remote, projectId],
  )
  return project.value?.name
}

/** Failure line with a reload action. */
export function MedFailure({ message, label, onReload }: {
  readonly message: string
  readonly label: string
  readonly onReload: () => void
}) {
  return <MedAsyncState message={`${label}: ${message}`} retryLabel={label} onRetry={onReload} />
}

/**
 * Research view (S02): query plan, PubMed search, and paper saving for the
 * project bound to the current session (SPEC-R001-S01-003 keeps project
 * selection on the home view). Without a binding it renders a localized
 * pointer to the home instead of any synthetic content.
 */
export function ResearchView({
  remote, t, openView, useSession, sessionId, viewRequest, viewFocus, completeViewRequest, mountComposer,
}: MedViewProps) {
  const session = useSession(snapshot => snapshot)
  const [state, advance] = useUiMachine<ResearchUiState, ResearchUiEvent>('IDLE', nextResearchState)
  const [query, setQuery] = useState('')
  const [primaryQuery, setPrimaryQuery] = useState('')
  const [broadQuery, setBroadQuery] = useState('')
  const [approvedQueryId, setApprovedQueryId] = useState<ResearchQuery['id']>()
  const [searchResult, setSearchResult] = useState<LiteratureSearchResult>()
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string>()
  const [savedPaperIds, setSavedPaperIds] = useState<Set<Paper['id']>>(new Set())
  const [segment, setSegment] = useState<MedPageSegment>('search')

  // The L2 tree, the home page, and the navigation entries address this View
  // through an opaque focus: a page segment (0917 图 4), a claim whose evidence
  // to show, or a research question to prefill.
  const focus = viewRequest?.focus || viewFocus
  const claim = focus === undefined || focus === '' ? undefined : decodeClaimFocus(focus)
  const pageSegment = focus === undefined || focus === '' ? undefined : decodePageFocus(focus)
  useEffect(() => {
    if (viewRequest === null) return
    if (pageSegment !== undefined) {
      setSegment(pageSegment)
    } else if (claim !== undefined) {
      // A claim focus opens the evidence page: that is where claims live.
      setSegment('evidence')
    } else if (focus !== undefined && focus !== '') {
      setSegment('search')
      setQuery(focus)
      setApprovedQueryId(undefined)
      setSearchResult(undefined)
    }
    completeViewRequest()
  }, [viewRequest, focus, claim, pageSegment, completeViewRequest])

  const binding = useMedSessionProject(remote, sessionId)
  const projectId = binding.value?.projectId
  const projectName = useMedProjectName(remote, projectId)

  // The results column owns the resident Session composer while the search
  // segment is showing (UI-SESSION pins the input to the bottom of the result
  // column). The evidence page has no centre input — 图 4 shows none — so there
  // the page hands its box to the assistant panel instead.
  const composerId = useId()
  const composerPlaceholder = t('research.composerPlaceholder')
  const onMessageAccepted = useCallback(() => { openView('chat', '') }, [openView])
  const composerReady = segment === 'search' && session !== undefined && binding.error === undefined && projectId !== undefined
  useHandOffInput('med-research:evidence', segment === 'evidence' && projectId !== undefined)
  useLayoutEffect(() => {
    if (!composerReady) return
    return mountComposer(composerId, { placeholder: composerPlaceholder, onMessageAccepted })
  }, [composerId, composerPlaceholder, onMessageAccepted, mountComposer, composerReady])

  const approveAndSearch = async (): Promise<void> => {
    if (projectId === undefined || query.trim() === '' || primaryQuery.trim() === '' || broadQuery.trim() === '') return
    setSearching(true)
    setSearchError(undefined)
    try {
      const plan: QueryPlan = {
        normalizedQuestion: query.trim(),
        concepts: [],
        queries: [
          { source: 'pubmed', query: primaryQuery.trim(), purpose: 'primary' },
          { source: 'pubmed', query: broadQuery.trim(), purpose: 'broad' },
        ],
      }
      const stored = await remote.literature.planQuery({ projectId, question: query.trim(), plan })
      const approved = await remote.literature.approveQuery(stored.id)
      setApprovedQueryId(approved.id)
      const result = await remote.literature.search({ projectId, researchQueryId: approved.id, query: primaryQuery.trim(), purpose: 'primary', maxResults: 100 })
      setSearchResult(result)
      advance('papers_ready')
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : String(cause))
      advance('partial_failure')
    } finally {
      setSearching(false)
    }
  }

  if (session === undefined) return null

  if (binding.error !== undefined) {
    return (
      <MedPanel title={t('view.research')} state={t(RESEARCH_STATE_KEY[state])}>
        <MedFailure message={binding.error} label={t('error.load')} onReload={binding.reload} />
      </MedPanel>
    )
  }
  if (projectId === undefined) {
    return (
      <MedPanel title={t('view.research')} state={t('research.IDLE')}>
        {binding.loading ? <p className="state">{t('home.loading')}</p> : (
          <div className="medNoProject">
            <p>{t('research.noProject')}</p>
            <button className="medPrimaryButton" type="button" onClick={() => { openView('med-home', '') }}>
              {t('research.openHome')}
            </button>
          </div>
        )}
      </MedPanel>
    )
  }

  return (
    <MedPanel
      crumb={<MedBreadcrumb page={t('view.research')} project={projectName} t={t} />}
      state={t(RESEARCH_STATE_KEY[state])}
      title={t('view.research')}
    >
      <MedPageTabs
        label={t('view.research')}
        onChange={setSegment}
        tabs={[
          { id: 'search', label: t('research.tab.search') },
          { id: 'evidence', label: t('evidence.title') },
        ]}
        value={segment}
      />
      {segment === 'evidence' ? (
        <MedEvidencePage
          onAddEvidence={() => { setSegment('search') }}
          onOpenSource={paperFocus => { openView('med-knowledge', paperFocus) }}
          projectId={projectId}
          remote={remote}
          t={t}
        />
      ) : (
      <section className="researchWorkspace" aria-label={t('research.workspace')}>
          <div className="researchQuestionBar"><Input aria-label={t('research.question')} icon={<MedResearchIcon size={16} />} size="md" value={query} onChange={event => { setQuery(event.currentTarget.value); setApprovedQueryId(undefined); setSearchResult(undefined) }} placeholder={t('research.questionPlaceholder')} /></div>
        <div className="planCard">
          <MedSectionHeader title={t('research.plan')} meta={approvedQueryId === undefined ? t('research.unconfirmed') : t('research.confirmed')} />
          <div className="planGrid">
            <Field label={t('research.primary')}>{control => <Input {...control} size="md" value={primaryQuery} onChange={event => { setPrimaryQuery(event.currentTarget.value); setApprovedQueryId(undefined) }} placeholder={t('research.primaryPlaceholder')} />}</Field>
            <Field label={t('research.broad')}>{control => <Input {...control} size="md" value={broadQuery} onChange={event => { setBroadQuery(event.currentTarget.value); setApprovedQueryId(undefined) }} placeholder={t('research.broadPlaceholder')} />}</Field>
            <div className={css.inlineActions}><Button size="lg" variant="primary" disabled={searching || approvedQueryId !== undefined} onClick={() => { void approveAndSearch() }}>{searching ? t('research.searching') : t('research.confirmSearch')}</Button>{approvedQueryId === undefined ? null : <Button size="sm" variant="outline" onClick={() => { setApprovedQueryId(undefined); setSearchResult(undefined) }}>{t('action.editQuery')}</Button>}</div>
          </div>
        </div>
        {searchError === undefined ? null : <MedFailure message={searchError} label={t('action.retry')} onReload={() => { void approveAndSearch() }} />}
        {searchResult !== undefined ? <section className="resultSection"><MedSectionHeader title={t('research.results')} meta={`${searchResult.papers.length} / ${searchResult.totalCount}`} /><div className="resultFilters"><span>{t('research.filterAll')}</span><span>{t('research.filterCounter')}</span><span>{t('research.filterRelated')}</span></div><div className="resultList">{searchResult.papers.map((paper, index) => <article className="resultRow" key={paper.id}><div className="resultBadge" aria-hidden="true">{index + 1}</div><div className="resultBody"><strong>{paper.title}</strong><span>{paper.authors.slice(0, 3).map(author => author.name).join(', ')} · {paper.journal ?? ''} · {paper.publicationDate ?? ''}</span><small>PMID {paper.pmid ?? '—'} {paper.doi === undefined ? '' : `· DOI ${paper.doi}`}</small></div><Button size="sm" variant="outline" data-saved={savedPaperIds.has(paper.id) || undefined} onClick={() => { void remote.projects.savePaper(projectId, paper.id).then(() => { setSavedPaperIds(current => new Set(current).add(paper.id)) }) }}>{savedPaperIds.has(paper.id) ? t('research.saved') : t('research.save')}</Button></article>)}</div></section> : null}
        <div className="researchComposer" id={composerId} />
      </section>
      )}
    </MedPanel>
  )
}

/**
 * The reader page body (0917 图 3, UI-READER): the paper's metadata, its
 * catalogue, and its body, with the reading modes and zoom controls above them.
 * It is a section of the library page, not a registered View, so the owning
 * page passes the decoded focus instead of the View kit.
 *
 * The two columns are in-page; the prototype's third column is the host's right
 * panel, not something this page draws. 翻译 and 双语对照 render disabled with
 * their reason: the papers service validates a caller-provided translation, it
 * does not produce one, and this page has no translator to call.
 */
export function MedPaperReader({ remote, t, focus, title }: {
  readonly remote: MedViewProps['remote']
  readonly t: MedViewProps['t']
  readonly focus: PaperFocus | undefined
  readonly title: string
}) {
  const paragraphRef = useRef<HTMLParagraphElement>(null)
  const [zoom, setZoom] = useState(100)
  const [sectionId, setSectionId] = useState<string>()

  const paper = useMedLoad(
    useCallback(
      (signal: AbortSignal): Promise<Paper | undefined> =>
        focus === undefined ? Promise.resolve(undefined) : remote.papers.get(focus.paperId, signal),
      [remote, focus],
    ),
    [focus],
  )
  const documents = useMedLoad(
    useCallback(
      (signal: AbortSignal) => focus === undefined ? Promise.resolve([]) : remote.papers.document(focus.paperId, signal),
      [remote, focus],
    ),
    [focus],
  )
  // The focused paper's document, which the catalogue and the body both read.
  const documentId = focus?.documentId ?? documents.value?.[0]?.id
  const sections = useMedLoad(
    useCallback(
      (signal: AbortSignal) => documentId === undefined
        ? Promise.resolve([])
        : remote.papers.sections(documentId, signal),
      [remote, documentId],
    ),
    [documentId],
  )
  const paragraphs = useMedLoad(
    useCallback(
      (signal: AbortSignal) => documentId === undefined
        ? Promise.resolve([])
        : remote.papers.paragraphs(documentId, signal),
      [remote, documentId],
    ),
    [documentId],
  )
  const cited = useMedLoad(
    useCallback(
      (signal: AbortSignal) => focus?.paragraphId === undefined
        ? Promise.resolve(undefined)
        : remote.papers.paragraph(focus.paragraphId, signal),
      [remote, focus],
    ),
    [focus],
  )

  // The catalogue follows the selection; a citation moves it to its own section.
  const citedSectionId = cited.value?.sectionId
  useEffect(() => {
    if (citedSectionId !== undefined) setSectionId(citedSectionId)
  }, [citedSectionId])
  const activeSectionId = sectionId ?? citedSectionId ?? sections.value?.[0]?.id
  const body = useMemo(
    () => (paragraphs.value ?? []).filter(paragraph => paragraph.sectionId === activeSectionId),
    [paragraphs.value, activeSectionId],
  )

  // Bring the cited paragraph into view once the body it belongs to is rendered.
  useEffect(() => {
    if (cited.value !== undefined && cited.value.sectionId === activeSectionId) {
      paragraphRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [cited.value, activeSectionId])

  const highlight = (text: string): React.ReactNode => {
    const start = focus?.startOffset
    const end = focus?.endOffset
    if (start === undefined || end === undefined || start >= end || end > text.length) return text
    return (
      <>
        {text.slice(0, start)}
        <mark data-med-quote="true">{text.slice(start, end)}</mark>
        {text.slice(end)}
      </>
    )
  }

  return (
    <MedPanel crumb={<MedBreadcrumb page={t('view.papers')} project={paper.value?.journal} t={t} />} state={t('research.PAPERS_READY')} title={title}>
      {focus === undefined ? <p>{t('empty.papers')}</p> : null}
      {paper.error === undefined ? null : (
        <MedFailure message={paper.error} label={t('error.load')} onReload={paper.reload} />
      )}
      {paper.value === undefined ? null : (
        <article className="medReaderHead">
          <h3 className={css.paperTitle}>{paper.value.title}</h3>
          <p className={css.paperAbstract}>
            {[paper.value.journal, paper.value.publicationDate, paper.value.doi === undefined ? undefined : `DOI ${paper.value.doi}`, paper.value.pmid === undefined ? undefined : `PMID ${paper.value.pmid}`]
              .filter((value): value is string => value !== undefined && value !== '')
              .join(' · ')}
          </p>
        </article>
      )}

      <div className="medReaderTools">
        <MedPageTabs
          label={t('reader.mode')}
          onChange={() => {}}
          tabs={[
            { id: 'source', label: t('reader.mode.source') },
            { id: 'translated', label: t('reader.mode.translated'), reason: t('reader.mode.reason') },
            { id: 'bilingual', label: t('reader.mode.bilingual'), reason: t('reader.mode.reason') },
          ]}
          value="source"
        />
        <div className="medReaderZoom">
          <span className="medReaderZoomValue">{zoom}%</span>
          <Button aria-label={t('reader.zoomOut')} onClick={() => { setZoom(value => Math.max(80, value - 20)) }} size="sm" variant="outline">−</Button>
          <Button aria-label={t('reader.zoomIn')} onClick={() => { setZoom(value => Math.min(200, value + 20)) }} size="sm" variant="outline">+</Button>
          <Button onClick={() => { setZoom(100) }} size="sm" variant="outline">{t('reader.zoomFit')}</Button>
        </div>
      </div>

      {paragraphs.error === undefined ? null : (
        <MedFailure message={paragraphs.error} label={t('error.load')} onReload={paragraphs.reload} />
      )}

      <MedSplit label={t('reader.body')} ratio="23-77">
        <nav aria-label={t('reader.catalog')} className="medReaderCatalog">
          {sections.loading ? <p className="state">{t('home.loading')}</p> : null}
          {(sections.value ?? []).length === 0 && !sections.loading ? <p className="state">{t('reader.noDocument')}</p> : null}
          <ul>
            {(sections.value ?? []).map(section => (
              <li key={section.id}>
                <button
                  aria-current={section.id === activeSectionId ? 'true' : undefined}
                  className="medReaderSectionLink"
                  data-active={section.id === activeSectionId || undefined}
                  onClick={() => { setSectionId(section.id) }}
                  type="button"
                >
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="medReaderBody" data-zoom={zoom}>
          {body.length === 0 && !paragraphs.loading ? <p className="state">{t('reader.noBody')}</p> : null}
          {body.map(paragraph => (
            <p
              className={css.readerBody}
              key={paragraph.id}
              ref={paragraph.id === cited.value?.id ? paragraphRef : undefined}
            >
              {paragraph.id === cited.value?.id ? highlight(paragraph.text) : paragraph.text}
            </p>
          ))}
        </div>
      </MedSplit>

      {paper.value?.abstract === undefined ? null : (
        <details className="medReaderAbstract">
          <summary>{t('reader.abstract')}</summary>
          <p>{paper.value.abstract}</p>
        </details>
      )}
    </MedPanel>
  )
}

/** Statistics view: one dataset's stored profile and column schema. */
export function StatisticsView({ remote, t, viewRequest, completeViewRequest, sessionId }: MedViewProps) {
  const binding = useMedSessionProject(remote, sessionId)
  const projectName = useMedProjectName(remote, binding.value?.projectId)
  const focus = viewRequest?.focus === undefined || viewRequest.focus === '' ? undefined : viewRequest.focus as DatasetId
  useEffect(() => {
    if (viewRequest !== null && focus !== undefined) completeViewRequest()
  }, [viewRequest, focus, completeViewRequest])

  const [state, advance] = useUiMachine<StatisticsUiState, StatisticsUiEvent>('NO_DATASET', nextStatisticsState)
  const profile = useMedLoad(
    useCallback(async (signal: AbortSignal) => {
      if (focus === undefined) {
        advance('reset')
        return undefined
      }
      advance(['reset', 'upload'])
      const dataset = await remote.datasets.profile(focus, signal)
      if (!signal.aborted) advance('profiled')
      return dataset
    }, [remote, focus, advance]),
    [focus],
  )

  return (
    <MedPanel
      crumb={<MedBreadcrumb page={t('view.statistics')} project={projectName} t={t} />}
      state={t(STATISTICS_STATE_KEY[state])}
      title={t('view.statistics')}
    >
      {focus === undefined ? <p>{t('empty.datasets')}</p> : null}
      {profile.error === undefined ? null : (
        <MedFailure message={profile.error} label={t('error.load')} onReload={profile.reload} />
      )}
      {profile.value === undefined ? null : (
        <>
          <dl className={css.statistics}>
            <dt>{t('view.statistics')}</dt><dd>{profile.value.filename}</dd>
            <dt>{t('statistics.READY')}</dt><dd>{profile.value.rowCount}</dd>
          </dl>
          <MissingValuesChart dataset={profile.value} t={t} />
        </>
      )}
    </MedPanel>
  )
}
