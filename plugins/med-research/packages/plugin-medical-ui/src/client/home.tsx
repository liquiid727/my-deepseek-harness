/**
 * The S01 workbench home view (SPEC-R001-S01-002/003, UI-HOME). It projects
 * only persisted Remote state: the session's project binding, the project
 * roster, and the per-domain overview counters. The Hero mounts the resident
 * host composer; inspiration fills its draft and ordinary message admission
 * opens Chat in the current Session.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/home
 */

import { useCallback, useId, useLayoutEffect, useMemo, useState, type FormEvent } from 'react'
import { Button, Field, Input, Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MedUiKey } from '../i18n/index.ts'
import type {
  Project,
  ProjectId,
  ProjectOverview,
  ProjectOverviewCounter,
} from '@medresearch/dsh-medical-contracts'
import {
  MedAnalysisIcon, MedArchiveIcon, MedBrandMark, MedChartIcon, MedDatasetIcon,
  MedEvidenceIcon, MedInspireIcon, MedLibraryIcon, MedPaperIcon, MedPlusIcon, MedResearchIcon,
  MedRestoreIcon, MedSearchIcon, MedSkillsIcon, MedStatisticsIcon,
} from './icons.tsx'
import { MedCapabilityCard, MedMetricTile } from './components.tsx'
import { MedFailure, useMedLoad } from './views.tsx'
import { NS, type MedViewInjected } from './locales.ts'

/** Number of inspiration prompts shown per batch. */
const INSPIRE_BATCH = 4
/** Total inspiration prompts in the local catalog. */
const INSPIRE_TOTAL = 8

/** Full props of the home view: standard Conversation view kit + Remote inject + locale. */
export type MedHomeProps =
  & ConvViewProps
  & InjectFace<MedViewInjected>
  & PropsLocale<typeof NS>

/** Localized text reader of the standard locale seat. */
type HomeTranslate = <K extends MedUiKey>(key: K) => string

/** One registered, fully rendered overview target. */
interface OverviewDomain {
  readonly key: MedUiKey
  readonly counter: ProjectOverviewCounter
  /** Declared view opened on click; absent renders a localized disabled tile. */
  readonly view?: string
  /** Icon shown beside the count. */
  readonly Icon: (props: { readonly size?: number }) => React.JSX.Element
  readonly tone: 'blue' | 'green' | 'purple' | 'orange'
}

/** One quick-access entry of the prototype's shortcut row. */
interface QuickEntry {
  readonly key: MedUiKey
  readonly view?: string
  readonly unavailable?: MedUiKey
  readonly Icon: (props: { readonly size?: number }) => React.JSX.Element
}

/** The five quick entries (prototype shortcut row); Skills has no live target yet. */
const QUICK_ENTRIES: readonly QuickEntry[] = [
  { key: 'home.quick.pubmed', view: 'med-research', Icon: MedResearchIcon },
  { key: 'home.quick.reader', view: 'med-papers', Icon: MedPaperIcon },
  { key: 'home.quick.evidence', view: 'med-evidence', Icon: MedEvidenceIcon },
  { key: 'home.quick.statistics', view: 'med-statistics', Icon: MedStatisticsIcon },
  { key: 'home.quick.skills', unavailable: 'nav.skillsUnavailable', Icon: MedSkillsIcon },
] as const

/**
 * The S01 home view.
 * @param props - Conversation view kit (session, draft, navigation), Remote, and locale.
 * @returns the workbench home, or nothing without a session (session-scoped).
 */
export function MedHomeView({
  remote, t, openView, useSession, inputActions, sessionId, mountComposer,
}: MedHomeProps) {
  const session = useSession(snapshot => snapshot)
  const setDraft = inputActions.setDraft
  const composerId = useId()
  const placeholder = t('home.inputPlaceholder')
  const onMessageAccepted = useCallback(() => { openView('chat', '') }, [openView])
  useLayoutEffect(() => {
    if (session === undefined) return
    return mountComposer(composerId, { placeholder, onMessageAccepted })
  }, [composerId, placeholder, onMessageAccepted, mountComposer, session !== undefined])

  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [inspireOffset, setInspireOffset] = useState(0)

  const binding = useMedLoad(
    useCallback((signal: AbortSignal) => remote.projects.sessionProject(sessionId, signal), [remote, sessionId]),
    [remote, sessionId],
  )
  const projects = useMedLoad(
    useCallback((signal: AbortSignal) => remote.projects.list(signal), [remote]),
    [remote],
  )
  const projectId = binding.value?.projectId
  const project = useMemo(
    () => projects.value?.find(candidate => candidate.id === projectId),
    [projects.value, projectId],
  )
  const overview = useMedLoad(
    useCallback(
      (signal: AbortSignal) =>
        projectId === undefined ? Promise.resolve(undefined) : remote.projects.overview(projectId, signal),
      [remote, projectId],
    ),
    [remote, projectId],
  )

  const normalizedSearch = search.trim().toLowerCase()
  const matches = (candidate: Project): boolean =>
    normalizedSearch === ''
    || candidate.name.toLowerCase().includes(normalizedSearch)
    || (candidate.researchQuestion ?? '').toLowerCase().includes(normalizedSearch)
  const activeProjects = (projects.value ?? []).filter(candidate => candidate.status === 'active' && matches(candidate))
  const archivedProjects = (projects.value ?? []).filter(candidate => candidate.status === 'archived' && matches(candidate))

  const reloadAll = (): void => {
    binding.reload()
    projects.reload()
    overview.reload()
  }

  const createProject = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setCreateError(undefined)
    setActionError(undefined)
    try {
      const trimmed = name.trim()
      const created = await remote.projects.create({
        name: trimmed,
        ...question.trim() === '' ? {} : { researchQuestion: question.trim() },
      })
      await remote.projects.selectProject(sessionId, created.id)
      setName('')
      setQuestion('')
      setSearch('')
      reloadAll()
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCreating(false)
    }
  }

  const selectProject = async (id: ProjectId): Promise<void> => {
    setActionError(undefined)
    try {
      await remote.projects.selectProject(sessionId, id)
      binding.reload()
      overview.reload()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const changeStatus = async (id: ProjectId, action: 'archive' | 'restore'): Promise<void> => {
    setActionError(undefined)
    try {
      await (action === 'archive' ? remote.projects.archive(id) : remote.projects.restore(id))
      projects.reload()
      overview.reload()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const inspiration: readonly string[] = useMemo(() => {
    const batch: string[] = []
    for (let index = 0; index < INSPIRE_BATCH; index += 1) {
      batch.push(t(`inspire.${(inspireOffset + index) % INSPIRE_TOTAL + 1}` as MedUiKey))
    }
    return batch
  }, [inspireOffset, t])

  const overviewDomains: readonly OverviewDomain[] = overview.value === undefined ? [] : [
    { key: 'home.count.papers', counter: overview.value.papers, view: 'med-papers', Icon: MedPaperIcon, tone: 'blue' },
    { key: 'home.count.evidence', counter: overview.value.evidences, view: 'med-evidence', Icon: MedEvidenceIcon, tone: 'green' },
    { key: 'home.count.datasets', counter: overview.value.datasets, Icon: MedDatasetIcon, tone: 'purple' },
    { key: 'home.count.analyses', counter: overview.value.analyses, Icon: MedAnalysisIcon, tone: 'orange' },
    { key: 'home.count.charts', counter: overview.value.charts, Icon: MedChartIcon, tone: 'blue' },
  ]

  if (session === undefined) return null

  return (
    <section className="medHome" aria-label={t('view.home')}>
      {/*
        Current project strip: the session's persisted binding plus lifecycle
        entry points. Same skeleton for loading, empty, and failure states.
      */}
      <div className="medProjectStrip" data-state={project === undefined ? 'empty' : 'filled'}>
        <span className="medStripLabel">{t('home.currentProject')}</span>
        {binding.loading ? <span className="medStripHint">{t('home.loading')}</span> : null}
        {binding.error !== undefined && !binding.loading
          ? <MedFailure message={binding.error} label={t('error.load')} onReload={binding.reload} />
          : null}
        {binding.error === undefined && !binding.loading && project === undefined
          ? <span className="medStripHint">{t('home.noProject')}</span>
          : null}
        {project !== undefined
          ? (
            <>
              <span className="medStripName">{project.name}</span>
              <Pill className="medStatusBadge">
                <StateDot state={project.status === 'archived' ? 'warning' : 'done'} />
                {t(project.status === 'archived' ? 'home.status.archived' : 'home.status.active')}
              </Pill>
              <span className="medStripActions">
                <Button
                  className="medGhostButton"
                  size="sm"
                  variant="outline"
                  onClick={() => { void changeStatus(project.id, project.status === 'archived' ? 'restore' : 'archive') }}
                >
                  {project.status === 'archived'
                    ? <><MedRestoreIcon size={14} /> {t('home.restore')}</>
                    : <><MedArchiveIcon size={14} /> {t('home.archive')}</>}
                </Button>
              </span>
            </>
          )
          : null}
      </div>
      {actionError === undefined
        ? null
        : <MedFailure message={actionError} label={t('error.action')} onReload={reloadAll} />}

      {/* Hero + the single primary input, bound to the host composer draft. */}
      <header className="medHero">
        <h1 className="medHeroTitle">
          <span className="medHeroMark" aria-hidden="true"><MedBrandMark size={40} /></span>
          {t('home.heroTitle')}
        </h1>
        <p className="medHeroSubtitle">{t('home.heroSubtitle')}</p>
        <div className="medComposerOutlet" id={composerId} />
        <nav aria-label={t('home.quickTitle')} className="medQuickRow">
          {QUICK_ENTRIES.map((entry) => {
            const { Icon } = entry
            return entry.view === undefined
              ? (
                <Button
                  aria-disabled="true"
                  className="medQuick"
                  data-disabled="true"
                  key={entry.key}
                  size="lg"
                  title={`${t(entry.key)} — ${t(entry.unavailable as MedUiKey)}`}
                  variant="outline"
                >
                  <Icon size={16} />
                  {t(entry.key)}
                </Button>
              )
              : (
                <Button
                  className="medQuick"
                  key={entry.key}
                  size="lg"
                  variant="outline"
                  onClick={() => { openView(entry.view as string, '') }}
                >
                  <Icon size={16} />
                  {t(entry.key)}
                </Button>
              )
          })}
        </nav>
      </header>

      {/* Five persisted overview counters; unknown never collapses to zero. */}
      <section aria-label={t('home.overview')} className="medSection">
        <div className="medSectionHead">
          <h2 className="medSectionTitle">{t('home.overview')}</h2>
          {project !== undefined && overview.value !== undefined
            ? (
              <span className="medSectionMeta">
                {t('home.updatedAt')} {new Date(overview.value.updatedAt).toLocaleString()}
              </span>
            )
            : <span className="medSectionMeta">{t('home.overviewHint')}</span>}
        </div>
        {overview.loading && projectId !== undefined
          ? <div className="medTileRow" data-state="loading"><span className="medStripHint">{t('home.loading')}</span></div>
          : null}
        {overview.error !== undefined
          ? <MedFailure message={overview.error} label={t('error.load')} onReload={overview.reload} />
          : null}
        {!overview.loading && overview.error === undefined && overview.value !== undefined
          ? (
            <div className="medTileRow">
              {overviewDomains.map((domain) => {
                const { Icon } = domain
                const counted = domain.counter.status === 'counted'
                return (
                  <MedMetricTile
                    icon={<Icon size={18} />}
                    key={domain.key}
                    label={t(domain.key)}
                    tone={domain.tone}
                    value={counted ? domain.counter.value : t('home.count.unknown')}
                    {...domain.view === undefined ? { disabledLabel: t('home.listUnavailable') } : { onOpen: () => { openView(domain.view as string, '') } }}
                    {...counted ? {} : { onRetry: overview.reload, retryLabel: t('home.count.retry') }}
                  />
                )
              })}
            </div>
          )
          : null}
      </section>

      {/* Three core capability cards, prototype band. */}
      <section aria-label={t('view.home')} className="medSection">
        <div className="medCardRow">
          <MedCapabilityCard
            icon={<MedResearchIcon size={18} />}
            onOpen={() => { openView('med-research', '') }}
            openLabel={t('home.card.open')}
            tags={[t('home.card.researchTag1'), t('home.card.researchTag2')]}
            text={t('home.card.researchText')}
            title={t('home.card.researchTitle')}
            tone="blue"
          />
          <MedCapabilityCard
            icon={<MedLibraryIcon size={18} />}
            onOpen={() => { openView('med-papers', '') }}
            openLabel={t('home.card.open')}
            tags={[t('home.card.readerTag1'), t('home.card.readerTag2')]}
            text={t('home.card.readerText')}
            title={t('home.card.readerTitle')}
            tone="green"
          />
          <MedCapabilityCard
            icon={<MedStatisticsIcon size={18} />}
            onOpen={() => { openView('med-statistics', '') }}
            openLabel={t('home.card.open')}
            tags={[t('home.card.statisticsTag1'), t('home.card.statisticsTag2')]}
            text={t('home.card.statisticsText')}
            title={t('home.card.statisticsTitle')}
            tone="purple"
          />
        </div>
      </section>

      {/* Inspiration: local catalog; clicking only fills the primary input. */}
      <section aria-label={t('home.inspire')} className="medInspire">
        <span className="medInspireLabel">
          <MedInspireIcon size={16} />
          {t('home.inspire')}
        </span>
        <div className="medInspireChips">
          {inspiration.map(prompt => (
            <button
              className="medChip"
              key={prompt}
              type="button"
              onClick={() => { setDraft(prompt) }}
            >
              {prompt}
            </button>
          ))}
        </div>
        <Button className="medGhostButton" size="sm" variant="outline" onClick={() => { setInspireOffset(offset => offset + INSPIRE_BATCH) }}>
          <MedInspireIcon size={14} />
          {t('home.inspire.shuffle')}
        </Button>
      </section>

      {/*
        Project management: search/filter, create, roster, and the archive
        bin. All actions go through the Remote; the roster is never local
        state.
      */}
      <section aria-label={t('home.projectsTitle')} className="medSection">
        <div className="medSectionHead">
          <h2 className="medSectionTitle">{t('home.projectsTitle')}</h2>
          <Input
            aria-label={t('home.searchLabel')}
            className="medSearch"
            icon={<MedSearchIcon size={14} />}
            size="sm"
              placeholder={t('home.searchPlaceholder')}
              value={search}
              onChange={(event) => { setSearch(event.currentTarget.value) }}
          />
        </div>
        <form className="medCreateCard" onSubmit={event => { void createProject(event) }}>
          <h3 className="medCreateTitle">{t('home.createTitle')}</h3>
          <div className="medCreateGrid">
            <Field label={t('home.name')}>
              {control => <Input {...control} className="medInput" required size="md" value={name} onChange={event => { setName(event.currentTarget.value) }} />}
            </Field>
            <Field label={t('home.question')}>
              {control => <Input {...control} className="medInput" size="md" value={question} onChange={event => { setQuestion(event.currentTarget.value) }} />}
            </Field>
            <Button className="medPrimaryButton" disabled={creating} size="lg" type="submit" variant="primary">
              <MedPlusIcon size={14} />
              {creating ? t('home.creating') : t('home.create')}
            </Button>
          </div>
          {createError === undefined ? null : <p className="medAlert" role="alert">{createError}</p>}
        </form>

        {projects.loading ? <p className="medStripHint">{t('home.loading')}</p> : null}
        {projects.error !== undefined
          ? <MedFailure message={projects.error} label={t('error.load')} onReload={projects.reload} />
          : null}
        {projects.error === undefined && !projects.loading && activeProjects.length === 0
          ? <p className="medEmpty">{t('home.emptyProjects')}</p>
          : null}
        <div className="medProjectGrid">
          {activeProjects.map(candidate => (
            <button
              aria-label={candidate.name}
              className="medProjectCard"
              data-selected={candidate.id === projectId || undefined}
              key={candidate.id}
              type="button"
              onClick={() => { void selectProject(candidate.id) }}
            >
              <span className="medProjectName">{candidate.name}</span>
              {candidate.researchQuestion === undefined
                ? null
                : <span className="medProjectHint">{candidate.researchQuestion}</span>}
              <span
                className="medArchiveLink"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation()
                  void changeStatus(candidate.id, 'archive')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    void changeStatus(candidate.id, 'archive')
                  }
                }}
              >
                <MedArchiveIcon size={13} /> {t('home.archive')}
              </span>
            </button>
          ))}
        </div>

        <details className="medArchived">
          <summary>
            {t('home.archivedTitle')} ({archivedProjects.length})
          </summary>
          {archivedProjects.length === 0
            ? <p className="medEmpty">{t('home.archivedEmpty')}</p>
            : (
              <ul className="medArchivedList">
                {archivedProjects.map(candidate => (
                  <li key={candidate.id}>
                    <span className="medProjectName">{candidate.name}</span>
                    <Button
                      className="medGhostButton"
                      size="sm"
                      variant="outline"
                      onClick={() => { void changeStatus(candidate.id, 'restore') }}
                    >
                      <MedRestoreIcon size={13} /> {t('home.restore')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
        </details>
      </section>
    </section>
  )
}
