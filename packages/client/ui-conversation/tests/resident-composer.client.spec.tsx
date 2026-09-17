// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { ResidentComposer } from '../src/client/skeleton/ResidentComposer.tsx'

describe('composer inside an independently rendered View', () => {
  it('dispatches toolbar and input events once without entering the enclosing View root', () => {
    const click = vi.fn()
    const input = vi.fn()
    const viewClick = vi.fn()
    const viewInput = vi.fn()
    function Shell({ targetId }: { targetId?: string }) {
      return (
        <div id="scrollport">
          <div data-testid="view-root" />
          <ResidentComposer scrollerId="scrollport" targetId={targetId}>
            <button type="button" onClick={click}>Model</button>
            <input aria-label="Draft" onInput={input} />
          </ResidentComposer>
        </div>
      )
    }
    const host = render(<Shell />)
    const view = createRoot(host.getByTestId('view-root'))
    try {
      act(() => { view.render(<div id="view-outlet" onClick={viewClick} onInput={viewInput} />) })
      host.rerender(<Shell targetId="view-outlet" />)
      const editor = host.getByRole('textbox')
      fireEvent.click(host.getByRole('button', { name: 'Model' }))
      fireEvent.input(editor, { target: { value: 'one draft' } })
      expect(click).toHaveBeenCalledOnce()
      expect(input).toHaveBeenCalledOnce()
      expect(viewClick).not.toHaveBeenCalled()
      expect(viewInput).not.toHaveBeenCalled()
      host.rerender(<Shell />)
      expect(host.getByRole('textbox')).toBe(editor)
      expect(editor).toHaveProperty('value', 'one draft')
    } finally {
      act(() => { view.unmount() })
      host.unmount()
    }
  })
})
