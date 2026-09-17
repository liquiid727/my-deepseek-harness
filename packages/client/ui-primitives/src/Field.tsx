import { useId, type ReactNode } from 'react'
import css from './Field.module.css'

/** Accessibility attributes supplied to a field's native control. */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/** Props for a label, supporting text, error, action, and caller-owned control. */
export interface FieldProps {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  action?: ReactNode
  id?: string
  children: (props: FieldControlProps) => ReactNode
}

/**
 * Associate locale-owned field copy with a caller-rendered form control.
 * @param props - Label, optional supporting content, and a control render function.
 * @returns A field group with stable label and description relationships.
 */
export function Field({ label, description, error, action, id, children }: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? `dsh-field-${generatedId.replaceAll(':', '')}`
  const descriptionId = description == null ? undefined : `${controlId}-description`
  const errorId = error == null ? undefined : `${controlId}-error`
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={css.field}>
      <div className={css.heading}>
        <label className={css.label} htmlFor={controlId}>{label}</label>
        {action != null && <div className={css.action}>{action}</div>}
      </div>
      {children({
        id: controlId,
        ...(describedBy == null ? {} : { 'aria-describedby': describedBy }),
        ...(error == null ? {} : { 'aria-invalid': true }),
      })}
      {description != null && <div className={css.description} id={descriptionId}>{description}</div>}
      {error != null && <div className={css.error} id={errorId}>{error}</div>}
    </div>
  )
}
