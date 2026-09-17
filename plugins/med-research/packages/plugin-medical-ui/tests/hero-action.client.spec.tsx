// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { en } from '../src/i18n/index.ts'
import { MedResearchLaunch, MedResearchRootLaunch } from '../src/client/hero-action.tsx'

afterEach(cleanup)

describe('MedResearchLaunch', () => {
  it('opens the Research view without a model turn', () => {
    const openView = vi.fn()
    render(createElement(MedResearchLaunch, {
      openView,
      t: (key: keyof typeof en) => en[key],
    } as never))

    fireEvent.click(screen.getByRole('button', { name: en['home.openWorkspace'] }))
    expect(openView).toHaveBeenCalledWith('med-home', '')
  })

  it('starts a session from the root Hero', () => {
    const startSession = vi.fn()
    render(createElement(MedResearchRootLaunch, {
      startSession,
      t: (key: keyof typeof en) => en[key],
    } as never))

    fireEvent.click(screen.getByRole('button', { name: en['home.openWorkspace'] }))
    expect(startSession).toHaveBeenCalledWith('med-home')
  })
})
