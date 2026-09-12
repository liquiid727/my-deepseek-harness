/**
 * Browser half of the Med Research UI (SPEC §42). It registers the four
 * Conversation views, the keyed Tool cards, and the settings page, and owns the
 * zh/en dictionaries; all data reaches the views through the typed Remote
 * client built from the live Connection.
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
import { en, zh } from '../i18n/index.ts'
import { NS } from './locales.ts'
import { createMedRemote } from './remote.ts'
import { MedSettingsSection } from './settings.tsx'
import { MedResearchLaunch, MedResearchRootLaunch } from './hero-action.tsx'
import { MedModeAction } from './mode-action.tsx'
import { MED_TOOL_NAMES, MedToolCard } from './toolview.tsx'
import { EvidenceView, PapersView, ResearchView, StatisticsView } from './views.tsx'

export type { MedRemote, RemoteCaller, RemoteCallResult } from './remote.ts'
export { MedRemoteError } from './remote.ts'
export type { MedViewInjected } from './locales.ts'
export { NS } from './locales.ts'

/** Required services: the slot registry, the locale service, and the Connection RPC caller. */
export const inject = ['slots', 'locale', 'connection']

/** The four Conversation views this plugin owns (SPEC §42.2). */
const VIEWS = [
  { id: 'med-research', order: 30, label: 'view.research', View: ResearchView },
  { id: 'med-papers', order: 31, label: 'view.papers', View: PapersView },
  { id: 'med-evidence', order: 32, label: 'view.evidence', View: EvidenceView },
  { id: 'med-statistics', order: 33, label: 'view.statistics', View: StatisticsView },
] as const

/**
 * Register the dictionaries, views, Tool cards, and settings page.
 * @param ctx - Client root context carrying slots, locale, and connection.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'med-research-ui: dictionaries')
  // Registration-time labels read through the bound translate as thunks, so a
  // locale switch relabels the tabs without re-registering.
  const t = ctx.locale.bind(NS)
  const connection = ctx.get('connection') as ConnectionHandle | undefined
  if (connection === undefined) throw new Error('med-research-ui: the Connection service is unavailable')
  const remote = createMedRemote(connection.rpc)

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
