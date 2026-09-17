import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement, ReactNode } from 'react'
import { MedArrowIcon } from './icons.tsx'

/**
 * Shared frame for one medical Conversation view.
 * @param props - Localized heading, state summary, and body content.
 * @returns the standard medical view frame.
 */
export function MedViewFrame({ title, state, children }: {
  readonly title: string
  readonly state: string
  readonly children: ReactNode
}) {
  return (
    <section className="researchPanel">
      <div className="researchShell">
        <MedSectionHeader title={title} meta={state} />
        {children}
      </div>
    </section>
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
 * One overview metric backed by a persisted counter.
 * @param props - Metric content, presentation tone, and optional open or retry action.
 * @returns an interactive metric when a target exists, otherwise a disabled metric.
 */
export function MedMetricTile({ icon, value, label, tone, disabledLabel, onOpen, retryLabel, onRetry }: {
  readonly icon: ReactNode
  readonly value: ReactNode
  readonly label: string
  readonly tone: 'blue' | 'green' | 'purple' | 'orange'
  readonly disabledLabel?: string
  readonly onOpen?: () => void
  readonly retryLabel?: string
  readonly onRetry?: () => void
}) {
  const content = (
    <>
      <span className="medTileIcon" data-tone={tone} aria-hidden="true">{icon}</span>
      <span className="medTileValue">{value}</span>
      <span className="medTileLabel">{label}</span>
      {retryLabel === undefined || onRetry === undefined
        ? null
        : <Button className="medTileRetry" size="sm" variant="outline" onClick={onRetry}>{retryLabel}</Button>}
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
