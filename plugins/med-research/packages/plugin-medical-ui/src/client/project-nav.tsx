/**
 * The medical sidebar's second panel (0917 图 2 的 L2：当前项目 + 会话搜索 +
 * 会话列表 + 域分组计数 + 项目信息组).
 *
 * It takes over the host's `sidebar.workspaces` seat rather than adding to it:
 * that seat is `single`, and the 0917 baseline's second column is a project
 * tree, not a Workspace list. The host shell still draws the brand row and the
 * New Session button above this panel, and the panel itself keeps the session
 * entry points the acceptance rules refuse to lose — the list, the search, and
 * a second New Session beside the group header.
 *
 * Sessions are the host's; med projects are ours. The two meet on the session's
 * `cwd`, which is the DSH workspace path, and a med project owns exactly one of
 * those. Domains without a service yet (notes, documents, tasks) render an
 * unknown count rather than a zero, and entries without a target render
 * disabled with their reason.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/project-nav
 */

import { useCallback, useId, useMemo, useState, type ReactElement } from 'react'
import {
  Button, IconArchiveOutline20, IconBranchOutline16, IconEditOutline16,
  IconEllipsisOutline16, Input, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ProjectId, ProjectOverview } from '@medresearch/dsh-medical-contracts'
import type { MedUiKey } from '../i18n/index.ts'
import { NS } from './locales.ts'
import type { MedRemote } from './remote.ts'
import { useMedLoad } from './views.tsx'
import { encodePageFocus } from './focus.ts'
import { MedArchiveIcon, MedRestoreIcon, MedSearchIcon } from './icons.tsx'

/** Business face the project panel receives through its registration's `inject`. */
export interface MedProjectNavInjected {
  /** Typed Remote client over the live Connection. */
  readonly remote: MedRemote
  /** Activate a registered Conversation View on the current Session. */
  readonly openView: (view: string, focus: string) => void
  /** Select one of the host's Sessions as current. */
  readonly openSession: (id: string) => void
  /** Start a New Session through the host flow, inheriting the current Workspace. */
  readonly startSession: () => void
  /** Rename a persisted Session title. */
  readonly renameSession: (id: string, title: string) => Promise<void>
  /** Fork a Session and open the new child. */
  readonly forkSession: (id: string) => Promise<void>
  /** Archive a Session from the visible session registry. */
  readonly archiveSession: (id: string) => Promise<void>
}

/** Composed props of the project panel. */
export type MedProjectNavProps =
  & PropsRuntime<'sidebar.workspaces'>
  & InjectFace<MedProjectNavInjected>
  & PropsLocale<typeof NS>

/** One domain row of the project tree. */
interface DomainRow {
  readonly id: string
  readonly label: MedUiKey
  /** Target Conversation View; absent means no target in V1. */
  readonly view?: string
  /** Opaque focus the target decodes; the evidence page is a page segment. */
  readonly focus?: string
  /** Overview field backing the count; absent means no service counts it yet. */
  readonly domain?: keyof Pick<ProjectOverview, 'papers' | 'evidences' | 'notes' | 'documents' | 'datasets' | 'sessions'>
  /** Why the row has no target, when it has none. */
  readonly reason?: MedUiKey
}

/** The evidence page is the research View's second segment (0917 图 4). */
const EVIDENCE_PAGE_FOCUS = encodePageFocus('evidence')

/** The domain rows of one project, in the prototype's order. */
const DOMAIN_ROWS: readonly DomainRow[] = [
  { id: 'papers', label: 'nav.library', view: 'med-knowledge', domain: 'papers' },
  { id: 'evidences', label: 'view.evidence', view: 'med-research', focus: EVIDENCE_PAGE_FOCUS, domain: 'evidences' },
  { id: 'notes', label: 'nav.notes', domain: 'notes' },
  { id: 'documents', label: 'nav.documents', domain: 'documents' },
  { id: 'datasets', label: 'nav.datasets', view: 'med-statistics', domain: 'datasets' },
  { id: 'tasks', label: 'nav.tasks', reason: 'nav.pendingService' },
]

/** `MM-DD HH:mm` in the viewer's own zone, so two rows compare at a glance. */
function sessionStamp(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The project panel body.
 * @param props - Column state, injected navigation, the Remote client, and copy.
 * @returns the panel; without projects it renders the empty hint instead.
 */
export function MedProjectNav({
  t, remote, openView, openSession, startSession, renameSession, forkSession, archiveSession,
  useSessions, wide, expandSidebar,
}: MedProjectNavProps): ReactElement {
  const [query, setQuery] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuSessionId, setMenuSessionId] = useState<string>()
  const [renameId, setRenameId] = useState<string>()
  const [renameValue, setRenameValue] = useState('')
  const [busySessionId, setBusySessionId] = useState<string>()
  const createNameId = useId()
  const createQuestionId = useId()
  const renameInputId = useId()

  const list = useSessions(snapshot => snapshot)
  const projects = useMedLoad(useCallback((signal: AbortSignal) => remote.projects.list(signal), [remote]))
  const currentSessionId = list.current
  const binding = useMedLoad(
    useCallback(
      (signal: AbortSignal) => currentSessionId === undefined
        ? Promise.resolve(undefined)
        : remote.projects.sessionProject(currentSessionId, signal),
      [remote, currentSessionId],
    ),
    [currentSessionId],
  )

  const active = useMemo(
    () => (projects.value ?? []).filter(project => project.status === 'active'),
    [projects.value],
  )
  const archived = useMemo(
    () => (projects.value ?? []).filter(project => project.status === 'archived'),
    [projects.value],
  )
  // The binding is the authority; before it resolves — or with none — the
  // current session's own directory still identifies its project.
  const currentCwd = currentSessionId === undefined ? undefined : list.byId[currentSessionId]?.cwd
  const currentProject = useMemo(() => {
    const bound = binding.value?.projectId
    if (bound !== undefined) return active.find(project => project.id === bound)
    return currentCwd === undefined ? undefined : active.find(project => project.workspacePath === currentCwd)
  }, [binding.value?.projectId, currentCwd, active])

  const overview = useMedLoad(
    useCallback(
      (signal: AbortSignal) => currentProject === undefined
        ? Promise.resolve(undefined)
        : remote.projects.overview(currentProject.id, signal),
      [remote, currentProject],
    ),
    [currentProject],
  )

  const sessions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return list.ids
      .map(id => list.byId[id])
      // A blank Session is the host's own New Session placeholder; it belongs to
      // no project until the user picks one.
      .filter((row): row is NonNullable<typeof row> => row !== undefined && !row.blank)
      .filter(row => currentProject === undefined || row.cwd === currentProject.workspacePath)
      .filter(row => needle === '' || row.displayTitle.toLowerCase().includes(needle))
      .sort((left, right) => right.updatedAt - left.updatedAt)
  }, [list, currentProject, query])

  // The counter is the authority (the project's persisted bindings); while it
  // is unknown the header falls back to what the list actually holds.
  const sessionTotal = overview.value?.sessions.status === 'counted'
    ? String(overview.value.sessions.value)
    : String(sessions.length)

  const choose = async (id: ProjectId): Promise<void> => {    if (currentSessionId === undefined) return
    setFailure(undefined)
    try {
      await remote.projects.selectProject(currentSessionId, id)
      binding.reload()
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const restore = async (id: ProjectId): Promise<void> => {
    setFailure(undefined)
    try {
      await remote.projects.restore(id)
      projects.reload()
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause))
    }
  }

  /**
   * Create the first project and bind it to the current session. The name is
   * required by the form; the question is optional and only sent when filled.
   */
  const createProject = async (): Promise<void> => {
    if (name.trim() === '' || creating) return
    setCreating(true)
    setFailure(undefined)
    try {
      const created = await remote.projects.create(
        question.trim() === '' ? { name: name.trim() } : { name: name.trim(), researchQuestion: question.trim() },
      )
      if (currentSessionId !== undefined) await remote.projects.selectProject(currentSessionId, created.id)
      setName('')
      setQuestion('')
      projects.reload()
      binding.reload()
    } catch (cause) {
      // The form keeps both fields, so a rejected name does not cost the text.
      setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCreating(false)
    }
  }

  const beginRename = (id: string, title: string): void => {
    setMenuSessionId(undefined)
    setRenameId(id)
    setRenameValue(title)
  }

  const commitRename = async (id: string): Promise<void> => {
    const title = renameValue.trim()
    if (title === '') return
    setBusySessionId(id)
    setFailure(undefined)
    try {
      await renameSession(id, title)
      setRenameId(undefined)
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusySessionId(undefined)
    }
  }

  const runSessionAction = async (id: string, action: (id: string) => Promise<void>): Promise<void> => {
    setMenuSessionId(undefined)
    setBusySessionId(id)
    setFailure(undefined)
    try {
      await action(id)
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusySessionId(undefined)
    }
  }

  if (!wide) {
    return (
      <nav aria-label={t('nav.workspacePanel')} className="medNav">
        <Button aria-label={t('nav.expand')} className="medNavRailButton" onClick={expandSidebar} size="sm" variant="ghost">
          <MedSearchIcon size={18} />
        </Button>
      </nav>
    )
  }

  if (projects.loading && projects.value === undefined) {
    return <nav aria-label={t('nav.workspacePanel')} className="medNav"><p className="state">{t('home.loading')}</p></nav>
  }
  if (projects.error !== undefined) {
    return (
      <nav aria-label={t('nav.workspacePanel')} className="medNav">
        <p className="state">{projects.error}</p>
        <Button onClick={projects.reload} size="sm" variant="outline">{t('action.reload')}</Button>
      </nav>
    )
  }
  if (active.length === 0) {
    // An empty roster still needs a next step the user can finish, so the
    // panel carries the create form rather than only saying there is nothing.
    return (
      <nav aria-label={t('nav.workspacePanel')} className="medNav">
        <p className="state">{t('empty.projects')}</p>
        <form
          className="medNavCreate"
          onSubmit={event => {
            event.preventDefault()
            void createProject()
          }}
        >
          <label className="medNavScopeLabel" htmlFor={createNameId}>{t('home.name')}</label>
          <Input
            aria-label={t('home.name')}
            id={createNameId}
            onChange={event => { setName(event.currentTarget.value) }}
            required
            size="md"
            value={name}
          />
          <label className="medNavScopeLabel" htmlFor={createQuestionId}>{t('home.question')}</label>
          <Input
            aria-label={t('home.question')}
            id={createQuestionId}
            onChange={event => { setQuestion(event.currentTarget.value) }}
            size="md"
            value={question}
          />
          {failure === undefined ? null : <p className="alert">{failure}</p>}
          <Button disabled={creating} type="submit" variant="primary">
            {creating ? t('home.creating') : t('home.create')}
          </Button>
        </form>
      </nav>
    )
  }

  return (
    <nav aria-label={t('nav.workspacePanel')} className="medNav">
      <div className="medNavScope">
        <span className="medNavScopeLabel">{t('nav.currentProject')}</span>
        <select
          aria-label={t('nav.currentProject')}
          className="medNavPicker"
          onChange={event => { void choose(event.currentTarget.value as ProjectId) }}
          value={currentProject?.id ?? ''}
        >
          {currentProject === undefined ? <option value="">{t('home.noProject')}</option> : null}
          {active.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </div>

      <div className="medNavSearch">
        <span aria-hidden="true" className="medNavSearchIcon"><MedSearchIcon size={14} /></span>
        <Input
          aria-label={t('nav.searchSessions')}
          onChange={event => { setQuery(event.currentTarget.value) }}
          placeholder={t('nav.searchSessions')}
          size="md"
          value={query}
        />
      </div>

      {failure === undefined ? null : <p className="alert">{failure}</p>}

      <section className="medNavGroup">
        <header className="medNavGroupHead">
          <span className="medNavGroupTitle">{t('nav.sessions')}</span>
          {/* The project's own session count, so this header and the overview
              card cannot drift apart; the list below shows the filtered view. */}
          <span className="medNavGroupCount">{sessionTotal}</span>
          <Button className="medNavGroupAction" onClick={startSession} size="sm" variant="ghost">
            {t('nav.newSession')}
          </Button>
        </header>
        <ul className="medNavList">
          {sessions.length === 0 ? <li className="state">{t('nav.noSessions')}</li> : null}
          {sessions.map(row => (
            <li key={row.id}>
              <div className={`medNavSessionRow${row.id === currentSessionId ? ' is-active' : ''}`}>
                {renameId === row.id ? (
                  <form className="medNavRenameForm" onSubmit={event => { event.preventDefault(); void commitRename(row.id) }}>
                    <Input
                      aria-label={t('nav.renameSession')}
                      id={renameInputId}
                      onChange={event => { setRenameValue(event.currentTarget.value) }}
                      size="sm"
                      value={renameValue}
                    />
                    <Button disabled={busySessionId === row.id} size="sm" type="submit" variant="primary">{t('nav.save')}</Button>
                    <Button onClick={() => { setRenameId(undefined) }} size="sm" type="button" variant="ghost">{t('nav.cancel')}</Button>
                  </form>
                ) : (
                  <>
                    <button
                      aria-current={row.id === currentSessionId ? 'true' : undefined}
                      className="medNavRow"
                      data-active={row.id === currentSessionId || undefined}
                      onClick={() => { openSession(row.id) }}
                      type="button"
                    >
                      <span className="medNavRowTitle" title={row.displayTitle}>{row.displayTitle}</span>
                      <span className="medNavRowMeta">{sessionStamp(row.updatedAt)}</span>
                    </button>
                    <Menu
                      open={menuSessionId === row.id}
                      onClose={() => { setMenuSessionId(undefined) }}
                      items={[
                        { id: 'rename', label: t('nav.renameSession'), icon: <IconEditOutline16 /> },
                        { id: 'fork', label: t('nav.forkSession'), icon: <IconBranchOutline16 /> },
                        { id: 'archive', label: t('nav.archiveSession'), icon: <IconArchiveOutline20 size={16} /> },
                      ]}
                      onSelect={id => {
                        if (id === 'rename') beginRename(row.id, row.title ?? row.displayTitle)
                        if (id === 'fork') void runSessionAction(row.id, async sessionId => {
                          await forkSession(sessionId)
                        })
                        if (id === 'archive') void runSessionAction(row.id, archiveSession)
                      }}
                      portal
                      anchor={(
                        <button
                          aria-label={t('nav.sessionActions', { name: row.displayTitle })}
                          className="medNavSessionAction"
                          disabled={busySessionId === row.id}
                          onClick={event => { event.stopPropagation(); setMenuSessionId(value => value === row.id ? undefined : row.id) }}
                          type="button"
                        >
                          <IconEllipsisOutline16 />
                        </button>
                      )}
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="medNavGroup">
        <header className="medNavGroupHead">
          <span className="medNavGroupTitle">{t('nav.project')}</span>
        </header>
        {overview.error === undefined ? null : <p className="alert">{overview.error}</p>}
        <ul className="medNavList">
          <li>
            <button className="medNavRow" onClick={() => { openView('med-home', '') }} type="button">
              <span className="medNavRowTitle">{t('nav.overview')}</span>
            </button>
          </li>
          {DOMAIN_ROWS.map(row => {
            const counter = row.domain === undefined ? undefined : overview.value?.[row.domain]
            const value = row.reason !== undefined || counter?.status !== 'counted'
              ? t('home.count.unknown')
              : String(counter.value)
            return (
              <li key={row.id}>
                <button
                  aria-disabled={row.reason === undefined ? undefined : true}
                  className="medNavRow"
                  data-unavailable={row.reason === undefined ? undefined : true}
                  onClick={() => { if (row.view !== undefined) openView(row.view, row.focus ?? '') }}
                  title={row.reason === undefined ? undefined : t(row.reason)}
                  type="button"
                >
                  <span className="medNavRowTitle">{t(row.label)}</span>
                  <span className="medNavRowMeta">{value}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="medNavGroup">
        <header className="medNavGroupHead">
          <span className="medNavGroupTitle">{t('nav.projectInfo')}</span>
        </header>
        <ul className="medNavList">
          <li>
            <button
              aria-expanded={archiveOpen}
              className="medNavRow"
              onClick={() => { setArchiveOpen(open => !open) }}
              type="button"
            >
              <span aria-hidden="true" className="medNavRowIcon"><MedArchiveIcon size={14} /></span>
              <span className="medNavRowTitle">{t('home.archivedTitle')}</span>
              <span className="medNavRowMeta">{archived.length}</span>
            </button>
          </li>
          {archiveOpen
            ? archived.map(project => (
              <li className="medNavSubRow" key={project.id}>
                <span className="medNavRowTitle">{project.name}</span>
                <Button
                  aria-label={`${t('home.restore')} ${project.name}`}
                  onClick={() => { void restore(project.id) }}
                  size="sm"
                  variant="ghost"
                >
                  <MedRestoreIcon size={14} />
                </Button>
              </li>
            ))
            : null}
          {(['nav.members', 'nav.projectSettings'] as const).map(key => (
            <li key={key}>
              <button aria-disabled="true" className="medNavRow" data-unavailable="true" title={t('nav.pendingService')} type="button">
                <span className="medNavRowTitle">{t(key)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </nav>
  )
}
