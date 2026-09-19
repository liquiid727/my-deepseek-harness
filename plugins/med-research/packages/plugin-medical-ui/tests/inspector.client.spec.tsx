// @vitest-environment jsdom
/**
 * The right-column inspector (0917 图 1 的「项目助手」). It is a tab type in the
 * host's right Sidebar, so these tests drive the body through the injected face
 * the registration supplies: a fake Remote for project reads and writes, a spy
 * for View navigation, and a spy for the plugin-built message box that sends
 * through `ISession.prompt`.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { Project } from '@medresearch/dsh-medical-contracts'
import { en } from '../src/i18n/index.ts'
import type { MedRemote } from '../src/client/remote.ts'
import { MedInspectorBody } from '../src/client/inspector.tsx'
import { setPanelInputOwner } from '../src/client/panel-input.ts'

afterEach(cleanup)

// The panel draws its message box only while a page has handed its input over;
// most cases here are about what the box does once it is on screen.
beforeEach(() => { setPanelInputOwner('test-page') })
afterEach(() => { setPanelInputOwner(undefined) })

const t = (key: keyof typeof en): string => en[key]

function project(overrides: Record<string, unknown> = {}): Project {
  return {
    id: 'project-1',
    name: 'PONV 研究',
    researchQuestion: '地塞米松能否预防术后恶心呕吐？',
    background: '术后恶心呕吐是常见的麻醉后并发症。',
    population: '成人全麻手术患者',
    interventionOrExposure: '地塞米松 4–8 mg',
    comparison: '安慰剂',
    outcome: 'PONV 发生率',
    keywords: ['PONV', '地塞米松'],
    workspacePath: '/tmp/med/ponv',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Project
}

/** Props of the tab body, with the framework's tab-information hook stubbed out. */
function inspectorProps(remote: MedRemote, overrides: Record<string, unknown> = {}) {
  return {
    remote,
    sessionId: 'session-1',
    t,
    useTabInfo: () => ({}),
    useSessions: (select: (state: { byId: Record<string, { cwd?: string }> }) => unknown) => select({ byId: {} }),
    openView: vi.fn(),
    promptSession: vi.fn(async () => {}),
    ...overrides,
  } as never
}

function boundRemote(overrides: Partial<MedRemote> = {}): MedRemote {
  return {
    ...overrides,
    projects: {
      get: async () => project(),
      sessionProject: async () => ({
        projectId: 'project-1', sessionId: 'session-1', updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      update: async () => project(),
      ...(overrides.projects ?? {}),
    },
  } as unknown as MedRemote
}

describe('MedInspectorBody', () => {
  it('points at the home when no project is bound to the session', async () => {
    const remote = { projects: { sessionProject: async () => undefined } } as unknown as MedRemote
    render(createElement(MedInspectorBody, inspectorProps(remote)))
    expect(await screen.findByText(en['inspector.noProject'])).toBeDefined()
    expect(screen.queryByText(en['inspector.title'])).toBeNull()
  })

  it('renders the four segments, with the two unserved ones disabled and explained', async () => {
    render(createElement(MedInspectorBody, inspectorProps(boundRemote())))
    expect(await screen.findByText(en['inspector.title'])).toBeDefined()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      en['inspector.tab.result'], en['inspector.tab.context'], en['inspector.tab.note'], en['inspector.tab.evidence'],
    ])
    expect(tabs[2]?.getAttribute('aria-disabled')).toBe('true')
    expect(tabs[2]?.getAttribute('title')).toBe(en['inspector.pendingService'])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('shows the recorded background and every research-question field', async () => {
    render(createElement(MedInspectorBody, inspectorProps(boundRemote())))
    expect(await screen.findByText('术后恶心呕吐是常见的麻醉后并发症。')).toBeDefined()
    expect(screen.getByText('地塞米松能否预防术后恶心呕吐？')).toBeDefined()
    expect(screen.getByText('成人全麻手术患者')).toBeDefined()
    expect(screen.getByText('PONV 发生率')).toBeDefined()
  })

  it('marks a field nobody filled rather than showing an empty row', async () => {
    const remote = boundRemote({ projects: { get: async () => project({ comparison: undefined }) } as never })
    render(createElement(MedInspectorBody, inspectorProps(remote)))
    await screen.findByText('成人全麻手术患者')
    expect(screen.getAllByText(en['inspector.unfilled']).length).toBe(1)
  })

  it('writes the edited background back with the record version it read', async () => {
    const update = vi.fn(async () => project({ background: '改写后的背景' }))
    const remote = boundRemote({ projects: { update } as never })
    render(createElement(MedInspectorBody, inspectorProps(remote)))

    fireEvent.click(await screen.findByRole('button', { name: en['inspector.edit'] }))
    const box = await screen.findByRole('textbox', { name: en['inspector.background'] })
    fireEvent.change(box, { target: { value: '改写后的背景' } })
    fireEvent.click(screen.getByRole('button', { name: en['action.save'] }))

    await waitFor(() => { expect(update).toHaveBeenCalledTimes(1) })
    expect(update.mock.calls[0]?.slice(0, 3)).toEqual([
      'project-1', { background: '改写后的背景' }, '2026-02-01T00:00:00.000Z',
    ])
  })

  it('keeps the editor and reports why when the write fails', async () => {
    const update = vi.fn(async () => { throw new Error('版本冲突') })
    const remote = boundRemote({ projects: { update } as never })
    render(createElement(MedInspectorBody, inspectorProps(remote)))

    fireEvent.click(await screen.findByRole('button', { name: en['inspector.edit'] }))
    fireEvent.click(screen.getByRole('button', { name: en['action.save'] }))

    expect(await screen.findByText(/版本冲突/u)).toBeDefined()
    expect(screen.getByRole('textbox', { name: en['inspector.background'] })).toBeDefined()
  })

  it('wires the served quick entries and disables the unserved ones with a reason', async () => {
    const openView = vi.fn()
    render(createElement(MedInspectorBody, inspectorProps(boundRemote(), { openView })))
    await screen.findByText(en['inspector.title'])

    fireEvent.click(screen.getByRole('button', { name: en['inspector.quick.literature'] }))
    expect(openView).toHaveBeenCalledWith('med-research', '')

    const extract = screen.getByRole('button', { name: en['inspector.quick.extract'] })
    expect(extract.getAttribute('aria-disabled')).toBe('true')
    expect(extract.getAttribute('title')).toBe(en['inspector.quick.extractReason'])
    fireEvent.click(extract)
    expect(openView).toHaveBeenCalledTimes(1)
  })

  it('fills the message box from a suggestion instead of sending it', async () => {
    const promptSession = vi.fn(async () => {})
    render(createElement(MedInspectorBody, inspectorProps(boundRemote(), { promptSession })))
    await screen.findByText(en['inspector.ask'])

    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['inspector.ask.1'], 'u') }))
    const box = screen.getByRole('textbox', { name: en['inspector.input'] }) as HTMLTextAreaElement
    expect(box.value).toBe(en['inspector.ask.1'])
    expect(promptSession).not.toHaveBeenCalled()
  })

  it('sends through the session face and clears the box', async () => {
    const promptSession = vi.fn(async () => {})
    render(createElement(MedInspectorBody, inspectorProps(boundRemote(), { promptSession })))
    const box = (await screen.findByRole('textbox', { name: en['inspector.input'] })) as HTMLTextAreaElement
    expect((screen.getByRole('button', { name: en['inspector.send'] }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(box, { target: { value: '  总结当前证据  ' } })
    fireEvent.keyDown(box, { key: 'Enter' })

    await waitFor(() => { expect(promptSession).toHaveBeenCalledWith('session-1', '总结当前证据') })
    await waitFor(() => { expect(box.value).toBe('') })
  })

  it('keeps the draft and reports the refusal when the session declines the turn', async () => {
    const promptSession = vi.fn(async () => { throw new Error('会话已取消') })
    render(createElement(MedInspectorBody, inspectorProps(boundRemote(), { promptSession })))
    const box = (await screen.findByRole('textbox', { name: en['inspector.input'] })) as HTMLTextAreaElement

    fireEvent.change(box, { target: { value: '保留这段草稿' } })
    fireEvent.click(screen.getByRole('button', { name: en['inspector.send'] }))

    expect(await screen.findByText(/会话已取消/u)).toBeDefined()
    expect(box.value).toBe('保留这段草稿')
  })

  it('draws no message box while no page has handed its input over', async () => {
    setPanelInputOwner(undefined)
    render(createElement(MedInspectorBody, inspectorProps(boundRemote())))
    await screen.findByText(en['inspector.title'])
    expect(screen.queryByRole('textbox', { name: en['inspector.input'] })).toBeNull()
    // The rest of the panel is unaffected.
    expect(screen.getByText(en['inspector.background'])).toBeDefined()
  })

  it('reads the project context on the second segment', async () => {
    render(createElement(MedInspectorBody, inspectorProps(boundRemote())))
    fireEvent.click((await screen.findAllByRole('tab'))[1] as HTMLElement)
    await waitFor(() => { expect(screen.getByText(en['inspector.context'])).toBeDefined() })
    expect(screen.getByText('PONV 研究')).toBeDefined()
    expect(screen.getByText('PONV · 地塞米松')).toBeDefined()
  })
})
