/**
 * The four Med Research Conversation views (SPEC §42.2, §43–§45). Each view is
 * a pure function of the typed Remote client plus the framework standard kit:
 * it reads through `createMedRemote`, shows the state machine's current label
 * from the zh/en dictionaries, and never holds business data of its own.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/views
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Field, Input, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ClaimId,
  DatasetId,
  Evidence,
  Paper,
  QueryPlan,
  LiteratureSearchResult,
  ResearchQuery,
} from '@medresearch/dsh-medical-contracts'
import { evidenceUiState } from '../state/evidence.ts'
import { nextResearchState, type ResearchUiEvent, type ResearchUiState } from '../state/research.ts'
import { nextStatisticsState, type StatisticsUiEvent, type StatisticsUiState } from '../state/statistics.ts'
import { MissingValuesChart } from './profile-chart.tsx'
import { MedResearchIcon } from './icons.tsx'
import { MedAsyncState, MedSectionHeader, MedViewFrame as MedPanel } from './components.tsx'
import { decodePaperFocus, encodePaperFocus } from './focus.ts'
import {
  EVIDENCE_STATE_KEY, NS, RESEARCH_STATE_KEY, STATISTICS_STATE_KEY, type MedViewInjected,
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
  remote, t, openView, useSession, sessionId, viewRequest, viewFocus, completeViewRequest,
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

  // The home view (or a navigation entry) addresses the research question as
  // this view's focus; consume it once into the query input.
  const focus = viewRequest?.focus || viewFocus
  useEffect(() => {
    if (viewRequest === null) return
    if (focus !== undefined && focus !== '') {
      setQuery(focus)
      setApprovedQueryId(undefined)
      setSearchResult(undefined)
    }
    completeViewRequest()
  }, [viewRequest, focus, completeViewRequest])

  const binding = useMedLoad(
    useCallback(
      (signal: AbortSignal) => remote.projects.sessionProject(sessionId, signal),
      [remote, sessionId],
    ),
    [remote, sessionId],
  )
  const projectId = binding.value?.projectId

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
    <MedPanel title={t('view.research')} state={t(RESEARCH_STATE_KEY[state])}>
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
      </section>
    </MedPanel>
  )
}

/** Papers view: one paper's metadata plus the cited paragraph, highlighted. */
export function PapersView({ remote, t, viewRequest, viewFocus, completeViewRequest }: MedViewProps) {
  const focusString = viewRequest?.focus || viewFocus
  // The decoded focus is a fresh object; memoize on the string so the load
  // effects below do not restart on every render.
  const focus = useMemo(
    () => focusString === undefined || focusString === '' ? undefined : decodePaperFocus(focusString),
    [focusString],
  )
  const paragraphRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (viewRequest !== null && focus !== undefined) completeViewRequest()
  }, [viewRequest, focus, completeViewRequest])

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
  const paragraph = useMedLoad(
    useCallback(
      (signal: AbortSignal) => focus?.paragraphId === undefined
        ? Promise.resolve(undefined)
        : remote.papers.paragraph(focus.paragraphId, signal),
      [remote, focus],
    ),
    [focus],
  )
  const sections = useMedLoad(
    useCallback(
      (signal: AbortSignal) => focus?.documentId === undefined
        ? Promise.resolve([])
        : remote.papers.sections(focus.documentId, signal),
      [remote, focus],
    ),
    [focus],
  )
  // Bring the cited paragraph into view once it has loaded.
  useEffect(() => {
    if (paragraph.value !== undefined) paragraphRef.current?.scrollIntoView({ block: 'center' })
  }, [paragraph.value])

  const sectionTitle = sections.value?.find(section => section.id === paragraph.value?.sectionId)?.title
  const text = paragraph.value?.text ?? ''
  const start = focus?.startOffset
  const end = focus?.endOffset
  const highlighted = start !== undefined && end !== undefined && start < end && end <= text.length
    ? { before: text.slice(0, start), span: text.slice(start, end), after: text.slice(end) }
    : undefined

  return (
    <MedPanel title={t('view.papers')} state={paper.loading ? t('research.SEARCHING') : t('research.PAPERS_READY')}>
      {focus === undefined ? <p>{t('empty.papers')}</p> : null}
      {paper.error === undefined ? null : (
        <MedFailure message={paper.error} label={t('error.load')} onReload={paper.reload} />
      )}
      {paper.value === undefined ? null : (
        <article>
          <h3 className={css.paperTitle}>{paper.value.title}</h3>
          <p className={css.paperAbstract}>{paper.value.abstract}</p>
        </article>
      )}
      {paragraph.value === undefined ? null : (
        <article className={css.readerQuote}>
          {sectionTitle === undefined ? null : <h4 className={css.readerSection}>{sectionTitle}</h4>}
          <p ref={paragraphRef} className={css.readerBody}>
            {highlighted === undefined ? text : (
              <>
                {highlighted.before}
                <mark data-med-quote="true">{highlighted.span}</mark>
                {highlighted.after}
              </>
            )}
          </p>
        </article>
      )}
      <ul className={css.documentList}>
        {(documents.value ?? []).map(document => (
          <li key={document.id}>{document.sourceType} — {document.parseStatus}</li>
        ))}
      </ul>
    </MedPanel>
  )
}

/** Evidence view: every stored evidence of one claim, with its display state. */
export function EvidenceView({ remote, t, viewRequest, viewFocus, completeViewRequest, openView }: MedViewProps) {
  const focusValue = viewRequest?.focus || viewFocus
  const focus = focusValue === '' ? undefined : focusValue
  useEffect(() => {
    if (viewRequest !== null && focus !== undefined) completeViewRequest()
  }, [viewRequest, focus, completeViewRequest])

  const evidence = useMedLoad(
    useCallback(
      (signal: AbortSignal): Promise<Evidence[]> =>
        focus === undefined ? Promise.resolve([]) : remote.evidence.listForClaim(focus as ClaimId, signal),
      [remote, focus],
    ),
    [focus],
  )

  return (
    <MedPanel title={t('view.evidence')} state={t('research.VERIFYING')}>
      {focus === undefined ? <p>{t('empty.evidence')}</p> : null}
      {evidence.error === undefined ? null : (
        <MedFailure message={evidence.error} label={t('error.load')} onReload={evidence.reload} />
      )}
      <ul className={css.evidenceList}>
        {(evidence.value ?? []).map(item => {
          const state = evidenceUiState(item)
          return (
            <li className={css.evidenceItem} key={item.id}>
              <strong className={css.evidenceState}><StateDot state={state.endsWith('_FOUND') ? 'done' : state === 'NOT_FOUND' || state === 'REJECTED' ? 'error' : 'warning'} /> {t(EVIDENCE_STATE_KEY[state])}</strong>
              <blockquote className={css.evidenceQuote}>{item.originalText}</blockquote>
              <Button size="sm" variant="outline" onClick={() => { openView('med-papers', encodePaperFocus({
                paperId: item.paperId,
                documentId: item.documentId,
                ...item.paragraphId === undefined ? {} : { paragraphId: item.paragraphId },
                ...item.startOffset === undefined ? {} : { startOffset: item.startOffset },
                ...item.endOffset === undefined ? {} : { endOffset: item.endOffset },
              })) }}>
                {t('action.openSource')}
              </Button>
            </li>
          )
        })}
      </ul>
    </MedPanel>
  )
}

/** Statistics view: one dataset's stored profile and column schema. */
export function StatisticsView({ remote, t, viewRequest, completeViewRequest }: MedViewProps) {
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
    <MedPanel title={t('view.statistics')} state={t(STATISTICS_STATE_KEY[state])}>
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
