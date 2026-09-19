import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement, ReactNode } from 'react'
import type { MedUiKey } from '../i18n/index.ts'
import { MedArrowIcon } from './icons.tsx'

/** Lifecycle badge of one page header (prototype 图 1 「进行中」/「已归档」). */
export interface MedPageStatus {
  readonly label: string
  readonly tone: 'active' | 'archived' | 'neutral'
}

/**
 * Page header of the 0917 shell (图 1–4 共用的页头三件套): the crumb row, the
 * H1 with its lifecycle badge and page actions, then the optional description
 * and meta row. Every page renders this once, above its own tool row.
 * @param props - Crumb node, H1 text, badge, description, meta row, actions.
 * @returns the standard medical page header.
 */
export function MedPageHeader({ crumb, title, status, description, meta, actions, display }: {
  readonly crumb?: ReactNode
  readonly title: string
  readonly status?: MedPageStatus | undefined
  readonly description?: string | undefined
  readonly meta?: ReactNode
  readonly actions?: ReactNode
  /** The project overview (图 1) carries a display-scale H1; other pages do not. */
  readonly display?: boolean | undefined
}): ReactElement {
  return (
    <header className="medPageHeader" data-display={display || undefined}>
      {crumb}
      <div className="medPageTitleRow">
        <h1 className="medPageTitle">{title}</h1>
        {status === undefined ? null : (
          <span className="medStatusBadge" data-status={status.tone}>{status.label}</span>
        )}
        {actions === undefined ? null : <div className="medPageActions">{actions}</div>}
      </div>
      {description === undefined ? null : <p className="medPageDescription">{description}</p>}
      {meta === undefined ? null : <div className="medPageMeta">{meta}</div>}
    </header>
  )
}

/** One in-page segment of {@link MedPageTabs}. */
export interface MedPageTab<T extends string> {
  readonly id: T
  readonly label: string
  /** Live count from the service; absent renders no count at all. */
  readonly count?: number
  /**
   * A segment whose capability is not in force yet. Rendered, focusable, and
   * carrying the reason, but never selectable — a hidden segment would hide
   * that the page is meant to have it.
   */
  readonly reason?: string
}

/**
 * The in-page mutually exclusive segments of one page (图 1 概览/文献/笔记/…,
 * 图 4 证据/笔记, 图 3 原文/翻译/双语对照). These are page-internal structure,
 * never host Conversation View tabs: the host projects every registered View
 * into its own tab strip and offers no way to hide or restyle one.
 * @param props - The segment roster, the selected id, its setter, and the group label.
 * @returns the segment control.
 */
export function MedPageTabs<T extends string>({ tabs, value, onChange, label }: {
  readonly tabs: readonly MedPageTab<T>[]
  readonly value: T
  readonly onChange: (id: T) => void
  readonly label: string
}): ReactElement {
  return (
    <div aria-label={label} className="medPageTabs" role="tablist">
      {tabs.map(tab => (
        <button
          aria-disabled={tab.reason === undefined ? undefined : true}
          aria-selected={tab.id === value}
          className="medPageTab"
          data-active={tab.id === value || undefined}
          data-unavailable={tab.reason === undefined ? undefined : true}
          key={tab.id}
          onClick={() => { if (tab.reason === undefined) onChange(tab.id) }}
          role="tab"
          title={tab.reason}
          type="button"
        >
          {tab.label}
          {tab.count === undefined ? null : <span className="medPageTabCount">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * Column ratios the prototype set actually uses, expressed in `fr` units so a
 * column keeps its share instead of a frozen pixel width. The names mirror
 * `ui-acceptance.md`: 52/48 (research), 14/48/38 (reader), 30/70 (statistics),
 * 23/45/32 (skills), and 23/77 for the reader's catalogue against its body —
 * the reader's 14/48 once the host's third column is taken out of the sum.
 */
export type MedSplitRatio = 'even' | 'even-3' | '52-48' | '14-48-38' | '30-70' | '23-45-32' | '23-77'

/**
 * One page body's column grid. Below 1000px of business width every ratio
 * collapses to a single column; the 700–999px "secondary column becomes a
 * drawer" rule is not implemented here.
 * @param props - The ratio token, the group label, and one child per column.
 * @returns the column grid.
 */
export function MedSplit({ ratio, label, children }: {
  readonly ratio: MedSplitRatio
  readonly label: string
  readonly children: ReactNode
}): ReactElement {
  return <div aria-label={label} className="medSplit" data-ratio={ratio} role="group">{children}</div>
}

/**
 * Shared frame for one medical Conversation view.
 * @param props - Page header fields and body content.
 * @returns the standard medical view frame.
 */
export function MedViewFrame({ title, state, crumb, description, meta, actions, children }: {
  readonly title: string
  readonly state: string
  readonly crumb?: ReactNode
  readonly description?: string | undefined
  readonly meta?: ReactNode
  readonly actions?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section className="researchPanel">
      <div className="researchShell">
        <MedPageHeader
          actions={actions}
          crumb={crumb}
          description={description}
          meta={meta}
          status={{ label: state, tone: 'neutral' }}
          title={title}
        />
        {children}
      </div>
    </section>
  )
}

/**
 * Page breadcrumb of the prototype (`PONV 研究 › Research + Evidence`): the
 * bound project, then the page the user is on.
 * @param props - Bound project name (absent before the binding resolves), the
 *   localized page name, and the locale reader.
 * @returns the breadcrumb navigation.
 */
export function MedBreadcrumb({ project, page, t }: {
  readonly project: string | undefined
  readonly page: string
  readonly t: (key: MedUiKey) => string
}) {
  return (
    <nav aria-label={t('nav.breadcrumb')} className="medCrumb">
      <span className="medCrumbProject">{project ?? t('home.noProject')}</span>
      <span aria-hidden="true" className="medCrumbSep">›</span>
      <span className="medCrumbPage">{page}</span>
    </nav>
  )
}

/**
 * Shared heading row for medical view sections.
 * @param props - Section title and optional trailing metadata.
 * @returns the medical section heading row.
 */
export function MedSectionHeader({ title, meta }: { readonly title: string; readonly meta?: ReactNode }) {
  return (
    <header className="sectionHeader">
      <h2 className="sectionTitle">{title}</h2>
      {meta == null ? null : <span className="sectionMeta">{meta}</span>}
    </header>
  )
}

/**
 * Failure state with a caller-owned localized retry label.
 * @param props - Failure message, retry label, and retry callback.
 * @returns an alert with a retry action.
 */
export function MedAsyncState({ message, retryLabel, onRetry }: {
  readonly message: string
  readonly retryLabel: string
  readonly onRetry: () => void
}) {
  return (
    <div role="alert" className="alert">
      <span>{message}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>{retryLabel}</Button>
    </div>
  )
}

/**
 * One overview metric backed by a persisted counter (prototype 图 1's six
 * cards: value + optional period delta + one-line note).
 * @param props - Metric content, tone, optional delta and note, and an optional open or retry action.
 * @returns an interactive metric when a target exists, otherwise a disabled metric.
 */
export function MedMetricTile({
  icon, value, label, tone, note, delta, disabledLabel, onOpen, retryLabel, onRetry,
}: {
  readonly icon: ReactNode
  readonly value: ReactNode
  readonly label: string
  readonly tone: 'blue' | 'green' | 'purple' | 'orange'
  /** One-line description under the label; absent renders nothing. */
  readonly note?: string | undefined
  /** Period-over-period change. Omit it entirely while no service reports one. */
  readonly delta?: { readonly label: string; readonly tone: 'up' | 'flat'; readonly title?: string | undefined } | undefined
  readonly disabledLabel?: string | undefined
  readonly onOpen?: (() => void) | undefined
  readonly retryLabel?: string | undefined
  readonly onRetry?: (() => void) | undefined
}) {
  const content = (
    <>
      <span className="medTileIcon" data-tone={tone} aria-hidden="true">{icon}</span>
      <span className="medTileBody">
        <span className="medTileValueRow">
          <span className="medTileValue">{value}</span>
          {delta === undefined
            ? null
            : <span className="medTileDelta" data-tone={delta.tone} title={delta.title}>{delta.label}</span>}
        </span>
        <span className="medTileLabel">{label}</span>
        {note === undefined ? null : <span className="medTileNote">{note}</span>}
        {retryLabel === undefined || onRetry === undefined
          ? null
          : <Button className="medTileRetry" size="sm" variant="outline" onClick={onRetry}>{retryLabel}</Button>}
      </span>
    </>
  )
  if (onOpen !== undefined && onRetry === undefined) {
    return <button className="medTile" type="button" onClick={onOpen}>{content}</button>
  }
  return (
    <div
      aria-label={disabledLabel === undefined ? label : `${label} — ${disabledLabel}`}
      className="medTile"
      data-disabled="true"
      title={disabledLabel}
    >
      {content}
    </div>
  )
}

/**
 * One reusable capability card on the medical home.
 * @param props - Card copy, tags, icon, tone, and navigation action.
 * @returns a capability card that opens its registered view.
 */
export function MedCapabilityCard({ title, text, tags, icon, tone, onOpen, openLabel }: {
  readonly title: string
  readonly text: string
  readonly tags: readonly string[]
  readonly icon: ReactNode
  readonly tone: 'blue' | 'green' | 'purple'
  readonly onOpen: () => void
  readonly openLabel: string
}): ReactElement {
  return (
    <button className="medCard" data-tone={tone} type="button" onClick={onOpen}>
      <span className="medCardHead">
        <span className="medCardIcon" aria-hidden="true">{icon}</span>
        <span className="medCardTitle">{title}</span>
        <span className="medCardArrow" aria-hidden="true"><MedArrowIcon size={16} /></span>
      </span>
      <span className="medCardText">{text}</span>
      <span className="medCardTags">{tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</span>
      <span className="visuallyHidden">{openLabel}</span>
    </button>
  )
}
