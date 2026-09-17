import { useId, useRef, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import css from './TabList.module.css'

/** One locale-owned item in a controlled tab list. */
export interface TabListItem<T extends string> {
  value: T
  label: string
  disabled?: boolean
  tabId?: string
  panelId?: string
}

/** Props for a controlled, keyboard-navigable tab list. */
export interface TabListProps<T extends string> {
  label: string
  items: readonly TabListItem<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string | undefined
}

/**
 * Render a controlled tab list with automatic arrow-key activation.
 * @param props - Localized label, items, selected value, and change handler.
 * @returns The tab controls; callers own and label the associated panels.
 */
export function TabList<T extends string>({ label, items, value, onValueChange, className }: TabListProps<T>) {
  const baseId = useId().replaceAll(':', '')
  const refs = useRef(new Map<T, HTMLButtonElement>())

  const selectAt = (index: number) => {
    const enabled = items.filter(item => item.disabled !== true)
    const item = enabled[(index + enabled.length) % enabled.length]
    if (item == null) return
    onValueChange(item.value)
    refs.current.get(item.value)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, itemValue: T) => {
    const enabled = items.filter(item => item.disabled !== true)
    const index = enabled.findIndex(item => item.value === itemValue)
    if (index < 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      selectAt(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectAt(index - 1)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      selectAt(event.key === 'Home' ? 0 : enabled.length - 1)
    }
  }

  return (
    <div aria-label={label} className={clsx(css.list, className)} role="tablist">
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            aria-controls={item.panelId}
            aria-selected={selected}
            className={clsx(css.tab, selected && css.selected)}
            disabled={item.disabled}
            id={item.tabId ?? `dsh-tab-${baseId}-${item.value}`}
            key={item.value}
            onClick={() => { onValueChange(item.value) }}
            onKeyDown={(event) => { onKeyDown(event, item.value) }}
            ref={(node) => {
              if (node == null) refs.current.delete(item.value)
              else refs.current.set(item.value, node)
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
