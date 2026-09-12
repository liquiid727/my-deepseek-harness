// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { en } from '../src/i18n/index.ts'
import { MedModeAction } from '../src/client/mode-action.tsx'

afterEach(cleanup)

describe('MedModeAction', () => {
  it('loads the session mode and persists a changed mode', async () => {
    const getMode = vi.fn().mockResolvedValue('research')
    const setMode = vi.fn().mockResolvedValue('paper')
    const remote = { projects: { getMode, setMode } }
    render(createElement(MedModeAction, {
      sessionId: 'session-1',
      remote,
      t: (key: keyof typeof en) => en[key],
    } as never))

    const select = await screen.findByRole('combobox', { name: en['mode.label'] })
    expect((select as HTMLSelectElement).value).toBe('research')
    fireEvent.change(select, { target: { value: 'paper' } })
    await waitFor(() => { expect(setMode).toHaveBeenCalledWith('session-1', 'paper') })
  })

  it('restores the previous selection when the mode change fails', async () => {
    const setMode = vi.fn().mockRejectedValue(new Error('mode denied'))
    const remote = { projects: { getMode: vi.fn().mockResolvedValue('research'), setMode } }
    render(createElement(MedModeAction, {
      sessionId: 'session-1',
      remote,
      t: (key: keyof typeof en) => en[key],
    } as never))

    const select = await screen.findByRole('combobox', { name: en['mode.label'] })
    fireEvent.change(select, { target: { value: 'statistics' } })
    expect((await screen.findByRole('alert')).textContent).toContain('mode denied')
    expect((select as HTMLSelectElement).value).toBe('research')
  })
})
