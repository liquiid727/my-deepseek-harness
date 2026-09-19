// @vitest-environment jsdom
/**
 * Browser half of the Med Research UI (SPEC §42.2). Registration runs on the
 * published `SlotCore` — the same pure core the browser `SlotRegistry` wraps —
 * so list ids, keyed tool names, declaration ordering, and disposal are
 * validated by the real registry rather than by a hand-rolled double. The
 * locale service is a structural double because the published client packages
 * ship browser bundles only (see the package README's Known Limitations).
 */

import { Context } from '@deepseek-ai/cordis'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.tsx'
import { NS } from '../src/client/locales.ts'
import { MED_INSPECTOR_ID, MED_INSPECTOR_KIND } from '../src/client/inspector.tsx'
import { MED_TOOL_NAMES } from '../src/client/toolview.tsx'
import { en, zh } from '../src/i18n/index.ts'

const Empty = () => null

interface SlotService {
  register(options: unknown, component: unknown): () => void
  entries(key: string): readonly {
    options: { id?: string; key?: string; label?: unknown; priority?: number }
    inject?: (...args: never[]) => Record<string, unknown>
  }[]
  inject(key: string, callback: () => () => void): () => void
}

interface LocaleService {
  register(ns: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): () => void
  bind(ns: string): (key: string) => string
}

interface Harness {
  ctx: Context
  /** Tab types the right Sidebar's registry accepted, in registration order. */
  tabTypes: readonly { id: string; kind: string; title?: (address: string) => string }[]
  /** Calls made by the plugin when it asks the right Sidebar to open content. */
  openTabCalls: readonly { kind: string; options: unknown }[]
  setLocale(locale: 'zh' | 'en'): void
}

async function harness(): Promise<Harness> {
  const core = new SlotCore()
  const dictionaries = new Map<string, { zh: Record<string, string>; en: Record<string, string> }>()
  let locale: 'zh' | 'en' = 'en'
  const slots: SlotService = {
    register: (options, component) => core.register(options as never, component as never),
    entries: key => core.entries(key) as never,
    // The browser SlotRegistry waits for the declaration and re-runs on every
    // registry mutation; SlotCore itself throws on an undeclared slot, so this
    // double retries on mutation and lets every other failure through.
    inject: (_key, callback) => {
      let dispose: (() => void) | undefined
      let registering = false
      const attempt = (): void => {
        // Registering mutates the core, which notifies this same injection
        // re-entrantly; the flag keeps one callback to one live entry.
        if (dispose !== undefined || registering) return
        registering = true
        try {
          dispose = callback()
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('is not declared')) throw error
        } finally {
          registering = false
        }
      }
      attempt()
      const off = core.onMutate(() => { attempt() })
      return () => {
        off()
        dispose?.()
      }
    },
  }
  const localeService: LocaleService = {
    register: (ns, dict) => {
      dictionaries.set(ns, dict)
      return () => { dictionaries.delete(ns) }
    },
    bind: ns => key => dictionaries.get(ns)?.[locale][key] ?? key,
  }
  const ctx = new Context()
  ctx.provide('slots', slots as never)
  ctx.provide('locale', localeService as never)
  ctx.provide('connection', {
    rpc: { call: async () => ({ ok: true, value: [] }) },
    isLoopback: true,
  } as never)
  ctx.provide('uiConversation', undefined as never)
  ctx.provide('uiWorkspace', undefined as never)
  const tabTypes: { id: string; kind: string; title?: (address: string) => string }[] = []
  ctx.provide('sidebarRightTabs', {
    register: (definition: { id: string; kind: string }) => {
      tabTypes.push(definition)
      return () => { tabTypes.splice(tabTypes.indexOf(definition), 1) }
    },
  } as never)
  const openTabCalls: { kind: string; options: unknown }[] = []
  ctx.provide('sidebarRight', {
    active: () => ({ id: 'tab-current', kind: 'guide' }),
    openTab: (kind: string, options: unknown) => { openTabCalls.push({ kind, options }) },
  } as never)
  ctx.provide('sessions', undefined as never)
  ctx.provide('theme', {
    overrideTokens: () => () => {},
  } as never)
  return { ctx, tabTypes, openTabCalls, setLocale: (next) => { locale = next } }
}

function declareParents(ctx: Context): void {
  const slots = ctx.get('slots') as unknown as SlotService
  slots.register({
    name: 'root',
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'sidebar.primary.action': { kind: 'list', scope: 'root' },
      'sidebar.workspaces': { kind: 'single', scope: 'root' },
      'conversation.view': { kind: 'list', scope: 'session' },
      'conversation.hero.actions': { kind: 'list', scope: 'session' },
      'conversation.hero.launch': { kind: 'list', scope: 'root' },
      'conversation.session.header.actions': { kind: 'list', scope: 'session' },
      'tool.call.toolview': { kind: 'keyed', scope: 'session' },
      'settings.section': { kind: 'list', scope: 'root' },
      // The right Sidebar's tab-body seat; the real one is declared by
      // ui-sidebar-right's `rightbar` seat, one level deeper.
      'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
    },
  }, Empty)
}

function entries(ctx: Context, key: string): readonly {
  options: { id?: string; key?: string; label?: unknown; priority?: number }
  inject?: (...args: never[]) => Record<string, unknown>
}[] {
  return (ctx.get('slots') as unknown as SlotService).entries(key)
}

describe('plugin-medical-ui browser half', () => {
  it('declares the services that assemble its three-column workbench', () => {
    expect(inject).toEqual([
      'slots', 'locale', 'connection', 'uiConversation', 'uiWorkspace', 'theme', 'sidebarRightTabs', 'sidebarRight',
    ])
  })

  it('waits for the owner declarations, then contributes views, cards, and settings', async () => {
    const app = await harness()
    const fiber = app.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(document.body.classList.contains('medResearchWorkbench')).toBe(true)
    // SlotCore rejects a registration into an undeclared slot, so an empty
    // registry before the parent declaration proves the plugin waits.
    expect(entries(app.ctx, 'conversation.view')).toEqual([])

    declareParents(app.ctx)
    // Exactly the five prototype entries: the reader, the evidence list, and
    // the draft editor are page sections, so they contribute no tab.
    expect(entries(app.ctx, 'conversation.view').map(entry => entry.options.id))
      .toEqual(['med-home', 'med-research', 'med-knowledge', 'med-statistics', 'med-skills'])
    expect(entries(app.ctx, 'sidebar.primary.action').map(entry => entry.options.id))
      .toEqual(['med-nav-home', 'med-nav-research', 'med-nav-library', 'med-nav-statistics', 'med-nav-skills'])
    expect(entries(app.ctx, 'sidebar.brand.mark').length).toBe(1)
    expect(entries(app.ctx, 'sidebar.brand.name').length).toBe(1)
    // The home is the Session landing surface: the blank-Session Hero row
    // carries no launch control, only the root Hero does.
    expect(entries(app.ctx, 'conversation.hero.actions')).toEqual([])
    expect(entries(app.ctx, 'conversation.hero.launch').map(entry => entry.options.id))
      .toEqual(['med-research'])
    expect(entries(app.ctx, 'tool.call.toolview').map(entry => entry.options.key).sort())
      .toEqual([...MED_TOOL_NAMES].sort())
    expect(entries(app.ctx, 'settings.section').map(entry => entry.options.id)).toEqual(['med-research'])
    expect(entries(app.ctx, 'conversation.session.header.actions').map(entry => entry.options.id)).toEqual(['med.mode'])
    // The inspector contributes a tab type and its body under the same id —
    // the host's own two-stage path, not a seat of our own.
    expect(app.tabTypes.map(type => ({ id: type.id, kind: type.kind })))
      .toEqual([{ id: MED_INSPECTOR_ID, kind: MED_INSPECTOR_KIND }])
    expect(app.tabTypes[0]?.title?.('sidebar://med-inspector')).toBe(en['inspector.title'])
    expect(entries(app.ctx, 'sidebar.right.pane.tab').map(entry => entry.options.key)).toEqual([MED_INSPECTOR_ID])
    // The project panel takes over the host's Workspace browser: one `single`
    // occupant, which is the replacement the baseline asks for.
    expect(entries(app.ctx, 'sidebar.workspaces').length).toBe(1)

    await fiber.dispose()
    expect(document.body.classList.contains('medResearchWorkbench')).toBe(false)
    expect(entries(app.ctx, 'conversation.view')).toEqual([])
    expect(entries(app.ctx, 'sidebar.primary.action')).toEqual([])
    expect(entries(app.ctx, 'sidebar.brand.mark').length).toBe(0)
    expect(entries(app.ctx, 'sidebar.brand.name').length).toBe(0)
    expect(entries(app.ctx, 'conversation.hero.actions')).toEqual([])
    expect(entries(app.ctx, 'conversation.hero.launch')).toEqual([])
    expect(entries(app.ctx, 'tool.call.toolview')).toEqual([])
    expect(entries(app.ctx, 'conversation.session.header.actions')).toEqual([])
    expect(app.tabTypes).toEqual([])
    expect(entries(app.ctx, 'sidebar.right.pane.tab')).toEqual([])
    expect(entries(app.ctx, 'sidebar.workspaces')).toEqual([])
    await app.ctx.fiber.dispose()
  })

  it('shadows the host workspace browser with a lower single-slot priority', async () => {
    const app = await harness()
    declareParents(app.ctx)
    const slots = app.ctx.get('slots') as unknown as SlotService
    slots.register({ name: 'sidebar.workspaces' }, Empty)

    const fiber = app.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(entries(app.ctx, 'sidebar.workspaces').map(entry => entry.options.priority ?? 0))
      .toEqual([-1, 0])
    await fiber.dispose()
    await app.ctx.fiber.dispose()
  })

  it('replaces the active right-sidebar tab by its id when opening the inspector', async () => {
    const app = await harness()
    declareParents(app.ctx)
    const fiber = app.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const home = entries(app.ctx, 'conversation.view').find(entry => entry.options.id === 'med-home')
    const injected = home?.inject?.() as { openInspector?: () => void } | undefined
    injected?.openInspector?.()

    expect(app.openTabCalls).toEqual([{
      kind: MED_INSPECTOR_KIND,
      options: { replaceTab: 'tab-current' },
    }])

    await fiber.dispose()
    await app.ctx.fiber.dispose()
  })

  it('registers both dictionaries and follows the active locale', async () => {
    const app = await harness()
    declareParents(app.ctx)
    app.setLocale('zh')
    const fiber = app.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const translate = (app.ctx.get('locale') as unknown as LocaleService).bind(NS)
    expect(translate('view.research')).toBe(zh['view.research'])
    app.setLocale('en')
    expect(translate('view.research')).toBe(en['view.research'])
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())

    await fiber.dispose()
    expect(translate('view.research')).not.toBe(en['view.research'])
    await app.ctx.fiber.dispose()
  })

  it('labels the view tabs through the dictionary namespace', async () => {
    const app = await harness()
    declareParents(app.ctx)
    const fiber = app.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const labels = entries(app.ctx, 'conversation.view')
      .map(entry => typeof entry.options.label === 'function' ? entry.options.label() : entry.options.label)
    expect(labels).toEqual([
      en['view.home'], en['view.research'], en['view.knowledge'], en['view.statistics'], en['view.skills'],
    ])
    const navLabels = entries(app.ctx, 'sidebar.primary.action')
      .map(entry => typeof entry.options.label === 'function' ? entry.options.label() : entry.options.label)
    expect(navLabels).toEqual([
      en['nav.home'], en['nav.research'], en['nav.library'], en['nav.statistics'], en['nav.skills'],
    ])
    await fiber.dispose()
    await app.ctx.fiber.dispose()
  })
})
