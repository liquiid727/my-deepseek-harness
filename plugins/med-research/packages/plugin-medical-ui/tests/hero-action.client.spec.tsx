// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { en } from '../src/i18n/index.ts'
import { MedResearchRootLaunch } from '../src/client/hero-action.tsx'

afterEach(cleanup)

describe('MedResearchRootLaunch', () => {
  it('starts a session that lands on the workbench home', () => {
    const startSession = vi.fn()
    render(createElement(MedResearchRootLaunch, {
      startSession,
      t: (key: keyof typeof en) => en[key],
    } as never))

    fireEvent.click(screen.getByRole('button', { name: en['home.openWorkspace'] }))
    expect(startSession).toHaveBeenCalledWith('med-home')
  })
})
