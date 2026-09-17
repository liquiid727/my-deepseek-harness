// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Field, Input, TabList } from '@deepseek-ai/dsh-client-ui-primitives'

afterEach(cleanup)

describe('Field', () => {
  it('connects the label, supporting copy, and error to the rendered control', () => {
    render(
      <Field label="Query" description="Use clinical terms" error="Required">
        {control => <Input {...control} />}
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'Query' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(ids).toHaveLength(2)
    expect(ids.map(id => document.getElementById(id)?.textContent)).toEqual([
      'Use clinical terms',
      'Required',
    ])
  })

  it('omits invalid and described-by attributes when no supporting content exists', () => {
    render(<Field label="Name">{control => <Input {...control} />}</Field>)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('TabList', () => {
  const items = [
    { value: 'summary', label: 'Summary' },
    { value: 'events', label: 'Events', disabled: true },
    { value: 'json', label: 'JSON', panelId: 'json-panel' },
  ] as const

  it('exposes controlled selection and skips disabled tabs with arrow keys', () => {
    const onValueChange = vi.fn()
    render(
      <TabList
        label="Trajectory detail"
        items={items}
        value="summary"
        onValueChange={onValueChange}
      />,
    )
    const summary = screen.getByRole('tab', { name: 'Summary' })
    expect(summary.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(summary, { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenLastCalledWith('json')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'JSON' }))
  })

  it('supports Home, End, and direct activation', () => {
    const onValueChange = vi.fn()
    render(
      <TabList
        label="Trajectory detail"
        items={items}
        value="json"
        onValueChange={onValueChange}
      />,
    )
    const json = screen.getByRole('tab', { name: 'JSON' })
    expect(json.getAttribute('aria-controls')).toBe('json-panel')
    fireEvent.keyDown(json, { key: 'Home' })
    expect(onValueChange).toHaveBeenLastCalledWith('summary')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Summary' }), { key: 'End' })
    expect(onValueChange).toHaveBeenLastCalledWith('json')
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }))
    expect(onValueChange).toHaveBeenLastCalledWith('summary')
  })
})
