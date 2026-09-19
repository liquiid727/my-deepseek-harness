/**
 * Browser half of the Med Research UI (SPEC §42, SPEC-R001-S01-003). It
 * registers the workbench shell contributions (brand seats and the five
 * primary-navigation entries in the host sidebar's additive strip), the
 * session-scoped Conversation views (home, research, papers, evidence,
 * statistics), the keyed Tool cards, and the settings page, and owns the zh/en
 * dictionaries; all data reaches the views through the typed Remote client
 * built from the live Connection.
 * @module @medresearch/dsh-plugin-medical-ui/src/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the locale service, the Connection RPC caller, the slot registry
// declaration, and the SlotMap rows this plugin registers into.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { en, zh } from '../i18n/index.ts'
import { NS } from './locales.ts'
import { createMedRemote } from './remote.ts'
import { MedSettingsSection } from './settings.tsx'
import { MedResearchRootLaunch } from './hero-action.tsx'
import { MedModeAction } from './mode-action.tsx'
import { MED_INSPECTOR_ID, MED_INSPECTOR_KIND, MedInspectorBody } from './inspector.tsx'
import { MedProjectNav } from './project-nav.tsx'
import { MED_TOOL_NAMES, MedToolCard } from './toolview.tsx'
import { MedSidebarBrandMark, MedSidebarBrandName, MED_NAV_ENTRIES, MedPrimaryNavEntry } from './nav.tsx'
import { ResearchView, StatisticsView } from './views.tsx'
import { KnowledgeView } from './knowledge-view.tsx'
import { SkillsView } from './skills-view.tsx'
import { MedHomeView } from './home.tsx'
import './views.css'
import './nav.css'

export type { MedRemote, RemoteCaller, RemoteCallResult } from './remote.ts'
export { MedRemoteError } from './remote.ts'
export type { MedViewInjected } from './locales.ts'
export type { MedNavInjected, MedNavEntry } from './nav.tsx'
export { NS } from './locales.ts'
export { MED_NAV_ENTRIES } from './nav.tsx'

/** Required services: slot, navigation, and the 0917 layout's right-inspector seams. */
export const inject = [
  'slots', 'locale', 'connection', 'uiConversation', 'uiWorkspace', 'theme', 'sidebarRightTabs', 'sidebarRight',
]

/**
 * The Conversation views this plugin owns: exactly the five prototype
 * navigation entries. Every registered view becomes a host tab, so the paper
 * reader, the evidence list, and the draft editor are sections of the library
 * and research pages instead of views of their own.
 */
const VIEWS = [
  { id: 'med-home', order: 20, label: 'view.home', View: MedHomeView },
  { id: 'med-research', order: 30, label: 'view.research', View: ResearchView },
  { id: 'med-knowledge', order: 31, label: 'view.knowledge', View: KnowledgeView },
  { id: 'med-statistics', order: 33, label: 'view.statistics', View: StatisticsView },
  { id: 'med-skills', order: 35, label: 'view.skills', View: SkillsView },
] as const

/**
 * Minimal faces of the host navigation services, resolved by name so this
 * bundle keeps its type-only imports of DSH client packages.
 */
interface ConversationNavigation {
  openView(view: string, options?: { focus?: string }): boolean
  viewSelection(sessionId: string):
    | {
      getSnapshot(): { view?: string | null } | null
      subscribe(listener: () => void): () => void
    }
    | undefined
}
interface WorkspaceNavigation {
  startSession(workspaceId?: string): void
  archiveSession(id: string): Promise<void>
}

/**
 * Minimal face of the sessions service, resolved by name so the bundle keeps
 * its type-only imports of DSH client packages. `prompt` is the public
 * behaviour verb for putting one turn into a session.
 */
interface PromptableSession {
  prompt(
    content: readonly { readonly type: 'text'; readonly text: string }[],
    mode: 'queue' | 'steer',
  ): Promise<{ readonly ok: boolean; readonly error?: { readonly message?: string } | undefined }>
  rename(title: string): Promise<{ readonly ok: boolean; readonly error?: { readonly message?: string } | undefined }>
}
interface SessionsNavigation {
  scope(id: string): unknown
  sessionOf(ctx: unknown): PromptableSession | undefined
  /** Select one of the host's Sessions as current. */
  open(id: string): void
  fork(opts: { sessionId: string; increaseTitle?: boolean }): Promise<string>
}

/**
 * Register the dictionaries, shell contributions, views, Tool cards, and
 * settings page.
 * @param ctx - Client root context carrying slots, locale, and connection.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'med-research-ui: dictionaries')
  // Session Views remain the rendering seam, but the workbench owns their
  // navigation in the left rail. Without this profile-scoped marker the host
  // projects Chat, Trajectory, and every medical View into a duplicate tab
  // row above the workspace, which the 0917 shell does not have.
  ctx.effect(() => {
    document.body.classList.add('medResearchWorkbench')
    return () => { document.body.classList.remove('medResearchWorkbench') }
  }, 'med-research-ui: workbench shell marker')
  const theme = ctx.get('theme') as ThemeRuntime | undefined
  if (theme === undefined) throw new Error('med-research-ui: the Theme service is unavailable')
  ctx.effect(() => theme.overrideTokens('@medresearch/dsh-plugin-medical-ui', {
    '--med-accent-statistics': { light: '#7053c7', dark: '#b8a1ff' },
    '--med-accent-statistics-soft': { light: '#f1edfb', dark: '#312654' },
  }), 'med-research-ui: domain theme tokens')
  // Registration-time labels read through the bound translate as thunks, so a
  // locale switch relabels the tabs without re-registering.
  const t = ctx.locale.bind(NS)
  const connection = ctx.get('connection') as ConnectionHandle | undefined
  if (connection === undefined) throw new Error('med-research-ui: the Connection service is unavailable')
  const remote = createMedRemote(connection.rpc)

  const conversation = ctx.get('uiConversation') as ConversationNavigation | undefined
  const workspaces = ctx.get('uiWorkspace') as WorkspaceNavigation | undefined
  const sessions = ctx.get('sessions') as SessionsNavigation | undefined
  const sidebarRightTabs = ctx.get('sidebarRightTabs')
  const sidebarRight = ctx.get('sidebarRight') as ISidebarRight | undefined
  if (sidebarRightTabs === undefined || sidebarRight === undefined) {
    throw new Error('med-research-ui: the right Sidebar services are unavailable')
  }
  /**
   * Bring the assistant panel forward. The project overview hands its message
   * box to that panel, so it asks for it on mount; without a right Sidebar the
   * page simply keeps the host's docked composer.
   */
  // The shell seeds a generic “Start” guide. Project overview owns this right
  // column, so replace that guide rather than leaving an unrelated tab beside
  // the inspector; the host chrome keeps its explicit collapse button.
  const openInspector = (): void => {
    const active = sidebarRight.active()
    sidebarRight.openTab(
      MED_INSPECTOR_KIND,
      active === undefined ? {} : { replaceTab: active.id },
    )
  }
  /**
   * Activate a View on the current Session, or launch a Session through the
   * host flow and activate the View once its binding is addressable. With no
   * Session the retry window is bounded; the host Hero remains the fallback
   * launch surface.
   * @param view - registered View id.
   * @param focus - opaque focus identity the View decodes, when the caller has one.
   */
  const navigate = (view: string, focus?: string): void => {
    const options = focus === undefined ? undefined : { focus }
    if (conversation?.openView(view, options) === true) return
    workspaces?.startSession()
    let attempts = 0
    const retry = (): void => {
      if (attempts >= 20 || conversation?.openView(view, options) === true) return
      attempts += 1
      setTimeout(retry, 50)
    }
    setTimeout(retry, 50)
  }

  /**
   * Put one text turn into a Session, through the sessions service's public
   * `prompt` verb. A refusal is the caller's to show: the inspector keeps the
   * draft and offers a retry rather than dropping what the user typed.
   * @param sessionId - the Session to prompt.
   * @param text - trimmed, non-empty message body.
   */
  const promptSession = async (sessionId: string, text: string): Promise<void> => {
    const scoped = sessions?.scope(sessionId)
    const face = scoped === undefined ? undefined : sessions?.sessionOf(scoped)
    if (face === undefined) throw new Error('med-research-ui: this Session exposes no promptable agent face')
    const result = await face.prompt([{ type: 'text', text }], 'queue')
    if (result.ok !== true) {
      throw new Error(result.error?.message ?? 'med-research-ui: the Session refused the prompt')
    }
  }

  // Brand seats: replace the host fallbacks with the medical identity. Single
  // seats take no roster id — the med row is the one replacement.
  ctx.effect(() => ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({
    name: 'sidebar.brand.mark',
    locale: NS,
  }, MedSidebarBrandMark)), 'med-research-ui: brand mark')

  ctx.effect(() => ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({
    name: 'sidebar.brand.name',
    locale: NS,
  }, MedSidebarBrandName)), 'med-research-ui: brand name')

  // Five primary-navigation entries in the host-owned additive strip; each
  // entry is its own effect so unloading one leaves the rest live.
  for (const entry of MED_NAV_ENTRIES) {
    ctx.effect(() => ctx.slots.inject('sidebar.primary.action', () => ctx.slots.register({
      name: 'sidebar.primary.action',
      id: entry.id,
      order: entry.order,
      locale: NS,
      label: () => t(entry.label),
      inject: () => ({
        navigate,
        viewSelection: (sessionId: string) => conversation?.viewSelection(sessionId),
      }),
    }, props => MedPrimaryNavEntry({ ...props, entry }))), `med-research-ui: nav ${entry.id}`)
  }

  // Every contribution is an effect of this plugin's fiber: the slot wait and
  // its live registration are torn down together on unload (AGENTS.md §2.1.3).
  for (const { id, order, label, View } of VIEWS) {
    ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
      name: 'conversation.view',
      id,
      order,
      locale: NS,
      label: () => t(label),
      inject: () => ({ openInspector, remote }),
    }, View)), `med-research-ui: view ${id}`)
  }

  // The home is the Session landing surface (startSession('med-home')), so the
  // blank-Session Hero row keeps no launch control of its own.
  ctx.effect(() => ctx.slots.inject('conversation.hero.launch', () => ctx.slots.register({
    name: 'conversation.hero.launch',
    id: 'med-research',
    order: 30,
    locale: NS,
  }, MedResearchRootLaunch)), 'med-research-ui: root Hero launch')

  for (const toolName of MED_TOOL_NAMES) {
    ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview',
      key: toolName,
      locale: NS,
    }, MedToolCard)), `med-research-ui: tool card ${toolName}`)
  }

  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'med-research',
    order: 60,
    locale: NS,
    label: () => t('settings.title'),
  }, MedSettingsSection)), 'med-research-ui: settings page')

  ctx.effect(() => ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'med.mode',
    order: 40,
    locale: NS,
    inject: () => ({ remote }),
  }, MedModeAction)), 'med-research-ui: mode action')

  // The sidebar's second panel (0917 图 2 的 L2). This seat is `single` and the
  // host's Workspace browser has the default priority 0. A lower priority
  // shadows that browser with the project tree the baseline asks for.
  ctx.effect(() => ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
    name: 'sidebar.workspaces',
    priority: -1,
    locale: NS,
    inject: () => ({
      openSession: (id: string) => {
        if (sessions === undefined) throw new Error('med-research-ui: the Sessions service is unavailable')
        sessions.open(id)
      },
      openView: (view: string, focus: string) => { navigate(view, focus) },
      remote,
      startSession: () => { workspaces?.startSession() },
      renameSession: async (id: string, title: string) => {
        const scoped = sessions?.scope(id)
        const face = scoped === undefined ? undefined : sessions?.sessionOf(scoped)
        if (face === undefined) throw new Error('med-research-ui: this Session exposes no rename face')
        const result = await face.rename(title)
        if (result.ok !== true) throw new Error(result.error?.message ?? 'med-research-ui: the Session rejected the title')
      },
      forkSession: async (id: string) => {
        if (sessions === undefined) throw new Error('med-research-ui: the Sessions service is unavailable')
        const childId = await sessions.fork({ sessionId: id, increaseTitle: true })
        sessions.open(childId)
      },
      archiveSession: async (id: string) => {
        if (workspaces === undefined) throw new Error('med-research-ui: the Workspace navigation service is unavailable')
        await workspaces.archiveSession(id)
      },
    }),
  }, MedProjectNav)), 'med-research-ui: project panel')

  // The right column's inspector (0917 右侧检视栏). Stage one is the tab type;
  // stage two is its body under the same id, exactly the path the host's own
  // guide type takes. Both services are injected above, so an assembly that
  // cannot render this required third column fails at plugin load.
  ctx.effect(() => sidebarRightTabs.register({
    id: MED_INSPECTOR_ID,
    kind: MED_INSPECTOR_KIND,
    title: () => t('inspector.title'),
  }), 'med-research-ui: inspector tab type')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: MED_INSPECTOR_ID,
    locale: NS,
    inject: () => ({
      openView: (view: string, focus: string) => { navigate(view, focus) },
      promptSession,
      remote,
    }),
  }, MedInspectorBody)), 'med-research-ui: inspector body')
}
