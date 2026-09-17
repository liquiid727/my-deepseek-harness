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
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { en, zh } from '../i18n/index.ts'
import { NS } from './locales.ts'
import { createMedRemote } from './remote.ts'
import { MedSettingsSection } from './settings.tsx'
import { MedResearchLaunch, MedResearchRootLaunch } from './hero-action.tsx'
import { MedModeAction } from './mode-action.tsx'
import { MED_TOOL_NAMES, MedToolCard } from './toolview.tsx'
import { MedSidebarBrandMark, MedSidebarBrandName, MED_NAV_ENTRIES, MedPrimaryNavEntry } from './nav.tsx'
import { EvidenceView, PapersView, ResearchView, StatisticsView } from './views.tsx'
import { KnowledgeView } from './knowledge-view.tsx'
import { SkillsView } from './skills-view.tsx'
import { WritingView } from './writing-view.tsx'
import { MedHomeView } from './home.tsx'
import './views.css'
import './nav.css'

export type { MedRemote, RemoteCaller, RemoteCallResult } from './remote.ts'
export { MedRemoteError } from './remote.ts'
export type { MedViewInjected } from './locales.ts'
export type { MedNavInjected, MedNavEntry } from './nav.tsx'
export { NS } from './locales.ts'
export { MED_NAV_ENTRIES } from './nav.tsx'

/** Required services: the slot registry, the locale service, the Connection RPC caller, and the host navigation seams. */
export const inject = ['slots', 'locale', 'connection', 'uiConversation', 'uiWorkspace', 'theme']

/** The Conversation views this plugin owns; the home is the S01 workbench entry. */
const VIEWS = [
  { id: 'med-home', order: 20, label: 'view.home', View: MedHomeView },
  { id: 'med-research', order: 30, label: 'view.research', View: ResearchView },
  { id: 'med-papers', order: 31, label: 'view.papers', View: PapersView },
  { id: 'med-evidence', order: 32, label: 'view.evidence', View: EvidenceView },
  { id: 'med-statistics', order: 33, label: 'view.statistics', View: StatisticsView },
  { id: 'med-knowledge', order: 34, label: 'view.knowledge', View: KnowledgeView },
  { id: 'med-skills', order: 35, label: 'view.skills', View: SkillsView },
  { id: 'med-writing', order: 36, label: 'view.writing', View: WritingView },
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
}

/**
 * Register the dictionaries, shell contributions, views, Tool cards, and
 * settings page.
 * @param ctx - Client root context carrying slots, locale, and connection.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'med-research-ui: dictionaries')
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
  /**
   * Activate a View on the current Session, or launch a Session through the
   * host flow and activate the View once its binding is addressable. With no
   * Session the retry window is bounded; the host Hero remains the fallback
   * launch surface.
   */
  const navigate = (view: string): void => {
    if (conversation?.openView(view) === true) return
    workspaces?.startSession()
    let attempts = 0
    const retry = (): void => {
      if (attempts >= 20 || conversation?.openView(view) === true) return
      attempts += 1
      setTimeout(retry, 50)
    }
    setTimeout(retry, 50)
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
      inject: () => ({ remote }),
    }, View)), `med-research-ui: view ${id}`)
  }

  ctx.effect(() => ctx.slots.inject('conversation.hero.actions', () => ctx.slots.register({
    name: 'conversation.hero.actions',
    id: 'med-research',
    order: 30,
    locale: NS,
  }, MedResearchLaunch)), 'med-research-ui: Hero launch')

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
}
