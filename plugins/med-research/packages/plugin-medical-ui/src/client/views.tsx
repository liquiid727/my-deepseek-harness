/**
 * The four Med Research Conversation views (SPEC §42.2, §43–§45). Each view is
 * a pure function of the typed Remote client plus the framework standard kit:
 * it reads through `createMedRemote`, shows the state machine's current label
 * from the zh/en dictionaries, and never holds business data of its own.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/views
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ClaimId,
  DatasetId,
  Evidence,
  Paper,
  Project,
  ProjectId,
  ProjectOverview,
} from '@medresearch/dsh-medical-contracts'
import { evidenceUiState } from '../state/evidence.ts'
import { nextResearchState, type ResearchUiEvent, type ResearchUiState } from '../state/research.ts'
import { nextStatisticsState, type StatisticsUiEvent, type StatisticsUiState } from '../state/statistics.ts'
import { MissingValuesChart } from './profile-chart.tsx'
import { decodePaperFocus, encodePaperFocus } from './focus.ts'
import {
  EVIDENCE_STATE_KEY, NS, RESEARCH_STATE_KEY, STATISTICS_STATE_KEY, type MedViewInjected,
} from './locales.ts'

/** Full props of a Med Research Conversation view. */
export type MedViewProps = ConvViewProps & InjectFace<MedViewInjected> & PropsLocale<typeof NS>

/** One asynchronous read: the last value, the failure message, and a reload trigger. */
interface MedLoad<T> {
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
function useMedLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]): MedLoad<T> {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision])

  return { value, error, loading, reload: useCallback(() => { setRevision(current => current + 1) }, []) }
}

/** Shared view chrome: localized title, current state label, and the body. */
function MedPanel({ title, state, children }: {
  readonly title: string
  readonly state: string
  readonly children: ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14 }}>{title}</h2>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{state}</span>
      </header>
      {children}
    </section>
  )
}

/** Failure line with a reload action. */
function MedFailure({ message, label, onReload }: {
  readonly message: string
  readonly label: string
  readonly onReload: () => void
}) {
  return (
    <p role="alert" style={{ margin: 0, color: 'var(--dsh-color-danger, #b3261e)' }}>
      {label}: {message} <button type="button" onClick={onReload}>{label}</button>
    </p>
  )
}

/** Research view: the project roster, the entry point of the Evidence Chain. */
export function ResearchView({ remote, t, openView }: MedViewProps) {
  const [state, advance] = useUiMachine<ResearchUiState, ResearchUiEvent>('IDLE', nextResearchState)
  const [selected, setSelected] = useState<ProjectId | undefined>()
  const load = useCallback(async (signal: AbortSignal): Promise<Project[]> => {
    advance(['reset', 'plan'])
    try {
      const projects = await remote.projects.list(signal)
      if (!signal.aborted) advance('plan_ready')
      return projects
    } catch (cause) {
      if (!signal.aborted) advance('partial_failure')
      throw cause
    }
  }, [remote, advance])
  const projects = useMedLoad(load, [load])
  const overview = useMedLoad(
    useCallback(
      (signal: AbortSignal): Promise<ProjectOverview | undefined> =>
        selected === undefined ? Promise.resolve(undefined) : remote.projects.overview(selected, signal),
      [remote, selected],
    ),
    [selected],
  )

  return (
    <MedPanel title={t('view.research')} state={t(RESEARCH_STATE_KEY[state])}>
      {projects.loading ? <p>{t('research.PLANNING')}</p> : null}
      {projects.error === undefined ? null : (
        <MedFailure message={projects.error} label={t('error.load')} onReload={projects.reload} />
      )}
      {!projects.loading && projects.error === undefined && (projects.value ?? []).length === 0
        ? <p>{t('empty.projects')}</p>
        : null}
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {(projects.value ?? []).map(project => (
          <li key={project.id}>
            <button type="button" onClick={() => { setSelected(project.id) }}>{project.name}</button>
          </li>
        ))}
      </ul>
      {selected === undefined ? null : (
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 4, margin: 0 }}>
          <dt>{t('view.papers')}</dt><dd>{overview.value?.papers ?? 0}</dd>
          <dt>{t('view.evidence')}</dt><dd>{overview.value?.evidences ?? 0}</dd>
          <dt>{t('view.statistics')}</dt><dd>{overview.value?.analyses ?? 0}</dd>
        </dl>
      )}
      <button type="button" onClick={() => { openView('med-papers', '') }}>
        {t('view.papers')}
      </button>
    </MedPanel>
  )
}

/** Papers view: one paper's metadata plus the cited paragraph, highlighted. */
export function PapersView({ remote, t, viewRequest, completeViewRequest }: MedViewProps) {
  const focusString = viewRequest?.focus
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
          <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>{paper.value.title}</h3>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>{paper.value.abstract}</p>
        </article>
      )}
      {paragraph.value === undefined ? null : (
        <article style={{ borderLeft: '3px solid var(--dsh-color-border, #d0d0d0)', paddingLeft: 8 }}>
          {sectionTitle === undefined ? null : <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>{sectionTitle}</h4>}
          <p ref={paragraphRef} style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
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
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {(documents.value ?? []).map(document => (
          <li key={document.id}>{document.sourceType} — {document.parseStatus}</li>
        ))}
      </ul>
    </MedPanel>
  )
}

/** Evidence view: every stored evidence of one claim, with its display state. */
export function EvidenceView({ remote, t, viewRequest, completeViewRequest, openView }: MedViewProps) {
  const focus = viewRequest?.focus === undefined || viewRequest.focus === '' ? undefined : viewRequest.focus
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
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {(evidence.value ?? []).map(item => {
          const state = evidenceUiState(item)
          return (
            <li key={item.id} style={{ border: '1px solid var(--dsh-color-border, #d0d0d0)', borderRadius: 6, padding: 8 }}>
              <strong style={{ fontSize: 12 }}>{t(EVIDENCE_STATE_KEY[state])}</strong>
              <blockquote style={{ margin: '4px 0', fontSize: 12 }}>{item.originalText}</blockquote>
              <button type="button" onClick={() => { openView('med-papers', encodePaperFocus({
                paperId: item.paperId,
                documentId: item.documentId,
                ...item.paragraphId === undefined ? {} : { paragraphId: item.paragraphId },
                ...item.startOffset === undefined ? {} : { startOffset: item.startOffset },
                ...item.endOffset === undefined ? {} : { endOffset: item.endOffset },
              })) }}>
                {t('action.openSource')}
              </button>
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
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 4, margin: 0 }}>
            <dt>{t('view.statistics')}</dt><dd>{profile.value.filename}</dd>
            <dt>{t('statistics.READY')}</dt><dd>{profile.value.rowCount}</dd>
          </dl>
          <MissingValuesChart dataset={profile.value} t={t} />
        </>
      )}
    </MedPanel>
  )
}
