// Input: single-line text input atom (search boxes, inline forms). Composer
// textareas are NOT this atom — they live with the conversation package.

import type { InputHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import css from './Input.module.css'

/** Supported input heights. */
export type InputSize = 'sm' | 'md'

/**
 * Render a text input with an optional leading icon.
 * @param props.icon - optional 16px leading icon node.
 * @param props.size - `sm` is 32px for dense forms; `md` is 40px.
 * @returns wrapper span containing the native input; input attributes pass through.
 */
export function Input({ icon, size = 'sm', className, ...rest }: {
  icon?: ReactNode
  size?: InputSize
  className?: string | undefined
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'
  return (
    <span className={clsx(css.wrap, css[size], invalid && css.invalid, className)}>
      {icon != null && <span className={css.icon}>{icon}</span>}
      <input className={css.input} {...rest} />
    </span>
  )
}
