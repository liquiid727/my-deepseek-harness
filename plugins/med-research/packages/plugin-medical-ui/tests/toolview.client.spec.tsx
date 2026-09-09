// @vitest-environment jsdom
/**
 * Tool result card (SPEC §6, §42.2). The card shows the wire name and
 * lifecycle, and links an `artifact_export` result at the authenticated
 * download route so a binary artifact never has to ride the JSON Remote.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { MED_ARTIFACT_EXPORT_PATH } from '@medresearch/dsh-medical-contracts'
import { en } from '../src/i18n/index.ts'
import { MedToolCard } from '../src/client/toolview.tsx'

afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]

/** One settled tool result carrying the call arguments. */
function settled(toolName: string, args: Record<string, unknown>, isError = false): never {
  return {
    kind: 'tool-result',
    seq: 1,
    time: 0,
    callId: 'call-1',
    call: { name: toolName, argsRaw: JSON.stringify(args) },
    callTime: 0,
    content: [],
    isError,
    subCalls: [],
  } as never
}

describe('MedToolCard (SPEC §42.2)', () => {
  it('shows the tool name and settled status', () => {
    render(createElement(MedToolCard, { toolName: 'project_create', block: settled('project_create', {}), t } as never))
    expect(screen.getByText('project_create')).toBeDefined()
    expect(screen.getByText(en['tool.done'])).toBeDefined()
  })

  it('links an artifact export at the authenticated download route', () => {
    render(createElement(MedToolCard, {
      toolName: 'artifact_export',
      block: settled('artifact_export', { artifactId: 'artifact-1', format: 'png' }),
      t,
    } as never))
    const link = screen.getByRole('link', { name: en['action.download'] })
    expect(link.getAttribute('href')).toBe(`${MED_ARTIFACT_EXPORT_PATH}?id=artifact-1&format=png`)
    expect(link.getAttribute('data-med-artifact-download')).toBe('true')
  })

  it('shows the failure state and no download link for a failed export', () => {
    render(createElement(MedToolCard, {
      toolName: 'artifact_export',
      block: settled('artifact_export', { artifactId: 'artifact-1', format: 'png' }, true),
      t,
    } as never))
    expect(screen.getByText(en['tool.failed'])).toBeDefined()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
