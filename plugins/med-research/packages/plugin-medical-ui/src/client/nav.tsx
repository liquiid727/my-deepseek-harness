/**
 * Sidebar contributions of the Med Research workbench shell (SPEC-R001-S01-003):
 * the medical brand seats and the five primary-navigation entries rendered by
 * the host-owned additive `sidebar.primary.action` strip. Entries own their
 * navigation behavior through the injected {@link MedNavInjected} face and
 * highlight the View that is currently active on the live Session; the strip
 * owner shares only the column state.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/nav
 */

import { useEffect, useState, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MedUiKey } from '../i18n/index.ts'
import { NS } from './locales.ts'
import {
  MedBrandMark, MedHomeIcon, MedLibraryIcon, MedResearchIcon, MedSkillsIcon, MedStatisticsIcon,
} from './icons.tsx'

/** Column state shared by the strip owner, the entry's own inject, and the locale seat. */
export type MedNavProps =
  & PropsRuntime<'sidebar.primary.action'>
  & InjectFace<MedNavInjected>
  & PropsLocale<typeof NS>

/** Navigation face injected into every primary-navigation entry. */
export interface MedNavInjected {
  /**
   * Activate a registered Conversation View on the current Session, or launch
   * a Session through the host flow and open the View once it is addressable.
   */
  navigate: (view: string) => void
  /**
   * Observable View-selection source for one Session, or `undefined` when the
   * Session is unknown. Entries subscribe to highlight the active View.
   */
  viewSelection:
    | ((sessionId: string) =>
      | { getSnapshot(): { view?: string | null } | null; subscribe(listener: () => void): () => void }
      | undefined)
    | undefined
}

/** Icon component shape of one entry. */
type NavIcon = (props: { readonly size?: number }) => ReactElement

/** One primary-navigation entry definition. */
export interface MedNavEntry {
  readonly id: string
  readonly order: number
  readonly label: MedUiKey
  /** Registered Conversation View id; absent for entries without a live target. */
  readonly view?: string
  /** Unavailable reason key; rendered as a disabled control with a title. */
  readonly unavailable?: MedUiKey
  readonly Icon: NavIcon
}

/** The five workbench entries (prototype 首页/研究/文献库/统计/技能). */
export const MED_NAV_ENTRIES: readonly MedNavEntry[] = [
  { id: 'med-nav-home', order: 10, label: 'nav.home', view: 'med-home', Icon: MedHomeIcon },
  { id: 'med-nav-research', order: 20, label: 'nav.research', view: 'med-research', Icon: MedResearchIcon },
  { id: 'med-nav-library', order: 30, label: 'nav.library', view: 'med-knowledge', Icon: MedLibraryIcon },
  { id: 'med-nav-statistics', order: 40, label: 'nav.statistics', view: 'med-statistics', Icon: MedStatisticsIcon },
  {
    id: 'med-nav-skills', order: 50, label: 'nav.skills',
    view: 'med-skills', Icon: MedSkillsIcon,
  },
] as const

/**
 * Render one primary-navigation entry. The entry is always the stacked rail
 * unit — icon above its localized label — because the host-owned strip hands
 * down `wide: false` in both column states (`SidebarRoot` renders the additive
 * strip as an icon rail); a label gated on `wide` never renders. The entry
 * whose View is active on the current Session carries the blue pill
 * highlight; unavailable targets render disabled with their localized reason.
 * @param props - strip owner state, injected navigation, the entry
 *   definition, and locale.
 * @returns the entry control.
 */
export function MedPrimaryNavEntry(props: MedNavProps & { readonly entry: MedNavEntry }): ReactElement {
  const { wide, t, navigate, viewSelection, useSessions, entry } = props
  const { Icon } = entry
  const currentSessionId = useSessions(s => s.current)
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (entry.view === undefined || currentSessionId === undefined) {
      setActive(false)
      return
    }
    const source = viewSelection?.(currentSessionId)
    if (source === undefined) {
      setActive(false)
      return
    }
    const read = (): void => { setActive(source.getSnapshot()?.view === entry.view) }
    read()
    return source.subscribe(read)
  }, [currentSessionId, viewSelection, entry.view])

  const body = (
    <>
      <span className="medNavIcon" aria-hidden="true"><Icon size={18} /></span>
      <span className="medNavLabel">{t(entry.label)}</span>
    </>
  )
  if (entry.view !== undefined) {
    return (
      <Button
        aria-current={active ? 'page' : undefined}
        aria-label={t(entry.label)}
        className="medNavEntry"
        data-active={active || undefined}
        data-wide={wide || undefined}
        onClick={() => { navigate(entry.view as string) }}
        title={t(entry.label)}
        variant="ghost"
      >
        {body}
      </Button>
    )
  }
  const reason = t(entry.unavailable as MedUiKey)
  return (
    <Button
      aria-disabled="true"
      aria-label={`${t(entry.label)} — ${reason}`}
      className="medNavEntry"
      data-disabled="true"
      data-wide={wide || undefined}
      title={`${t(entry.label)} — ${reason}`}
      variant="ghost"
    >
      {body}
    </Button>
  )
}

type BrandNameProps = PropsRuntime<'sidebar.brand.name'> & PropsLocale<typeof NS>

/** Localized medical brand name rendered beside the sidebar mark. */
export function MedSidebarBrandName({ t }: BrandNameProps): ReactElement {
  return <span className="medBrandName" title={t('brand.name')}>{t('brand.name')}</span>
}

/** Props of the brand-mark seat, plus nothing else. */
export type MedBrandMarkProps = PropsRuntime<'sidebar.brand.mark'>

/** Medical brand mark rendered in the sidebar brand row and collapsed rail. */
export function MedSidebarBrandMark(_: MedBrandMarkProps): ReactElement {
  return <MedBrandMark size={24} />
}
