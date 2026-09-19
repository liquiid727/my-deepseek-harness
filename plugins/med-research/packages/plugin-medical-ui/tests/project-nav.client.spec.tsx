// @vitest-environment jsdom
/**
 * The sidebar's project panel (0917 图 2 的 L2). It replaces the host's
 * Workspace browser, so these tests pin the things that replacement must keep:
 * the session list with its search and its open verb, the current project, the
 * per-domain counts, and the archive/restore pair — plus the rows that have no
 * service behind them, which must say so rather than look clickable.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { Project, ProjectOverview } from '@medresearch/dsh-medical-contracts'
import { en } from '../src/i18n/index.ts'
import type { MedRemote } from '../src/client/remote.ts'
import { MedProjectNav } from '../src/client/project-nav.tsx'

afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]

/** Session rows as the host's list store carries them. */
interface Row {
  id: string
  displayTitle: string
  cwd?: string
  blank: boolean
  updatedAt: number
}

function row(id: string, displayTitle: string, at: number, overrides: Partial<Row> = {}): Row {
  return { id, displayTitle, blank: false, cwd: '/tmp/med/ponv', updatedAt: at, ...overrides }
}

function project(overrides: Record<string, unknown> = {}): Project {
  return {
    id: 'project-1',
    name: 'PONV 研究',
    keywords: [],
    status: 'active',
    workspacePath: '/tmp/med/ponv',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Project
}

function overview(counts: Partial<Record<'papers' | 'evidences' | 'notes' | 'documents' | 'datasets' | 'sessions', number | 'unavailable'>>): ProjectOverview {
  const counter = (value: number | 'unavailable' | undefined) => value === undefined || value === 'unavailable'
    ? { status: 'unavailable' as const }
    : { status: 'counted' as const, value }
  return {
    projectId: 'project-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    papers: counter(counts.papers),
    evidences: counter(counts.evidences),
    notes: counter(counts.notes),
    documents: counter(counts.documents),
    datasets: counter(counts.datasets),
    sessions: counter(counts.sessions),
    analyses: counter(undefined),
    charts: counter(undefined),
  } as unknown as ProjectOverview
}

function navProps(remote: MedRemote, rows: readonly Row[], current: string | undefined, overrides: Record<string, unknown> = {}) {
  const byId = Object.fromEntries(rows.map(item => [item.id, item]))
  return {
    t,
    remote,
    useSessions: (select: (state: unknown) => unknown) => select({ byId, current, ids: rows.map(item => item.id) }),
    wide: true,
    expandSidebar: vi.fn(),
    openView: vi.fn(),
    openSession: vi.fn(),
    startSession: vi.fn(),
    renameSession: vi.fn(async () => {}),
    forkSession: vi.fn(async () => {}),
    archiveSession: vi.fn(async () => {}),
    ...overrides,
  } as never
}

function remoteWith(projects: Record<string, unknown>): MedRemote {
  return { projects } as unknown as MedRemote
}

const STANDARD = {
  list: async () => [project()],
  sessionProject: async () => ({ projectId: 'project-1', sessionId: 'session-1', updatedAt: '2026-01-01T00:00:00.000Z' }),
  overview: async () => overview({ papers: 28, evidences: 36, notes: 12, documents: 4, datasets: 2, sessions: 5 }),
  selectProject: async () => ({ projectId: 'project-1', sessionId: 'session-1', updatedAt: '2026-01-01T00:00:00.000Z' }),
  restore: async () => project(),
}

describe('MedProjectNav', () => {
  it('collapses to a single expand control in the rail column', () => {
    const expandSidebar = vi.fn()
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [], undefined, { wide: false, expandSidebar })))
    fireEvent.click(screen.getByRole('button', { name: en['nav.expand'] }))
    expect(expandSidebar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('navigation', { name: en['nav.workspacePanel'] })?.textContent).toBe('')
  })

  it('says there are no projects and offers a create form as the next step', async () => {
    const create = vi.fn(async () => project())
    const selectProject = vi.fn(STANDARD.selectProject)
    const remote = remoteWith({ ...STANDARD, list: async () => [], create, selectProject })
    render(createElement(MedProjectNav, navProps(remote, [], 's-1')))
    expect(await screen.findByText(en['empty.projects'])).toBeDefined()

    fireEvent.change(screen.getByLabelText(en['home.name']), { target: { value: '胸外科队列' } })
    fireEvent.change(screen.getByLabelText(en['home.question']), { target: { value: '术后镇痛方案' } })
    fireEvent.click(screen.getByRole('button', { name: en['home.create'] }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({ name: '胸外科队列', researchQuestion: '术后镇痛方案' })
      expect(selectProject).toHaveBeenCalledWith('s-1', 'project-1')
    })
  })

  it('keeps both fields when the create fails', async () => {
    const create = vi.fn(async () => { throw new Error('名称重复') })
    const remote = remoteWith({ ...STANDARD, list: async () => [], create })
    render(createElement(MedProjectNav, navProps(remote, [], 's-1')))
    fireEvent.change(await screen.findByLabelText(en['home.name']), { target: { value: '重复名' } })
    fireEvent.click(screen.getByRole('button', { name: en['home.create'] }))
    expect(await screen.findByText(/名称重复/u)).toBeDefined()
    expect((screen.getByLabelText(en['home.name']) as HTMLInputElement).value).toBe('重复名')
  })

  it('reports a failed project read and offers a reload', async () => {
    const list = vi.fn(async () => { throw new Error('连接中断') })
    render(createElement(MedProjectNav, navProps(remoteWith({ ...STANDARD, list }), [], undefined)))
    expect(await screen.findByText('连接中断')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: en['action.reload'] }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
  })

  it('lists the current project sessions newest first, ignoring blanks and other projects', async () => {
    const rows = [
      row('s-old', '开题报告讨论', 1_700_000_000_000),
      row('s-new', '地塞米松剂量证据整理', 1_800_000_000_000),
      row('s-blank', '新会话', 1_900_000_000_000, { blank: true }),
      row('s-other', '别的项目的会话', 1_950_000_000_000, { cwd: '/tmp/med/other' }),
    ]
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), rows, 's-new')))
    await screen.findByText('地塞米松剂量证据整理')

    const titles = screen.getAllByRole('button')
      .map(node => node.querySelector('.medNavRowTitle')?.textContent)
      .filter((value): value is string => typeof value === 'string' && value.includes('会话') === false)
    expect(titles).toContain('地塞米松剂量证据整理')
    expect(titles).not.toContain('新会话')
    expect(titles).not.toContain('别的项目的会话')
    const ordered = [...screen.getAllByText(/讨论|证据整理/u)].map(node => node.textContent)
    expect(ordered[0]).toBe('地塞米松剂量证据整理')
  })

  it('filters the list by the search box', async () => {
    const rows = [row('s-1', '开题报告讨论', 1), row('s-2', 'Meta 分析结果解读', 2)]
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), rows, 's-1')))
    await screen.findByText('开题报告讨论')
    fireEvent.change(screen.getByRole('textbox', { name: en['nav.searchSessions'] }), { target: { value: 'meta' } })
    expect(screen.queryByText('开题报告讨论')).toBeNull()
    expect(screen.getByText('Meta 分析结果解读')).toBeDefined()
  })

  it('keeps a long session title within the navigation row and exposes its full text on hover', async () => {
    const title = '只读重点审查 /Users/liquiid/code/work/xqd/xqd_这是一个不能撑开左侧导航栏的很长会话名称'
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [row('s-1', title, 1)], 's-1')))
    const label = await screen.findByText(title)
    expect(label.className).toContain('medNavRowTitle')
    expect(label.getAttribute('title')).toBe(title)
  })

  it('opens the session a row names', async () => {
    const openSession = vi.fn()
    const rows = [row('s-2', 'Meta 分析结果解读', 2)]
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), rows, 's-1', { openSession })))
    fireEvent.click(await screen.findByText('Meta 分析结果解读'))
    expect(openSession).toHaveBeenCalledWith('s-2')
  })

  it('starts a new session from the group header', async () => {
    const startSession = vi.fn()
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [], 's-1', { startSession })))
    fireEvent.click(await screen.findByRole('button', { name: en['nav.newSession'] }))
    expect(startSession).toHaveBeenCalledTimes(1)
  })

  it('shows every served domain count and leaves only the unserved one unknown', async () => {
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [], 's-1')))
    await screen.findByText(en['nav.project'])

    for (const [key, value] of [
      ['nav.library', '28'], ['view.evidence', '36'], ['nav.notes', '12'],
      ['nav.documents', '4'], ['nav.datasets', '2'],
    ] as const) {
      const row = screen.getByRole('button', { name: new RegExp(en[key], 'u') })
      expect(row.textContent).toContain(value)
      expect(row.getAttribute('aria-disabled')).toBeNull()
    }

    const tasks = screen.getByRole('button', { name: new RegExp(en['nav.tasks'], 'u') })
    expect(tasks.getAttribute('aria-disabled')).toBe('true')
    expect(tasks.getAttribute('title')).toBe(en['nav.pendingService'])
    expect(tasks.textContent).toContain(en['home.count.unknown'])
  })

  it('takes the session group count from the project counter, not from the visible list', async () => {
    // The counter is the project's persisted bindings (5); the list is empty
    // here, so a header reading 0 would be a different number from the same
    // fact the overview card shows.
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [], 's-1')))
    const header = (await screen.findByText(en['nav.sessions'])).parentElement
    expect(header?.querySelector('.medNavGroupCount')?.textContent).toBe('5')
  })

  it('marks a served domain unknown when its counter failed', async () => {
    const remote = remoteWith({ ...STANDARD, overview: async () => overview({ papers: 'unavailable' }) })
    render(createElement(MedProjectNav, navProps(remote, [], 's-1')))
    const papers = await screen.findByRole('button', { name: new RegExp(en['nav.library'], 'u') })
    expect(papers.textContent).toContain(en['home.count.unknown'])
    expect(papers.textContent).not.toContain('0')
  })

  it('navigates the served domain rows and the overview row', async () => {
    const openView = vi.fn()
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [], 's-1', { openView })))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en['nav.overview'], 'u') }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['nav.library'], 'u') }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['nav.datasets'], 'u') }))
    expect(openView.mock.calls).toEqual([['med-home', ''], ['med-knowledge', ''], ['med-statistics', '']])
  })

  it('offers rename, fork, and archive actions for each session row', async () => {
    const renameSession = vi.fn(async () => {})
    const forkSession = vi.fn(async () => {})
    const archiveSession = vi.fn(async () => {})
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [row('s-1', '研究会话', 3)], 's-1', {
      renameSession, forkSession, archiveSession,
    })))
    const openActions = async () => fireEvent.click(await screen.findByRole('button', { name: en['nav.sessionActions'] }))
    await openActions()
    fireEvent.click(await screen.findByRole('menuitem', { name: en['nav.renameSession'] }))
    const renameInput = screen.getByRole('textbox', { name: en['nav.renameSession'] })
    fireEvent.change(renameInput, { target: { value: '新的会话名' } })
    fireEvent.click(screen.getByRole('button', { name: en['nav.save'] }))
    await waitFor(() => { expect(renameSession).toHaveBeenCalledWith('s-1', '新的会话名') })

    await openActions()
    fireEvent.click(await screen.findByRole('menuitem', { name: en['nav.forkSession'] }))
    await waitFor(() => { expect(forkSession).toHaveBeenCalledWith('s-1') })

    await openActions()
    fireEvent.click(await screen.findByRole('menuitem', { name: en['nav.archiveSession'] }))
    await waitFor(() => { expect(archiveSession).toHaveBeenCalledWith('s-1') })
  })

  it('switches the bound project through the picker', async () => {
    const selectProject = vi.fn(STANDARD.selectProject)
    const remote = remoteWith({
      ...STANDARD,
      list: async () => [project(), project({ id: 'project-2', name: '胸外科队列', workspacePath: '/tmp/med/thoracic' })],
      selectProject,
    })
    render(createElement(MedProjectNav, navProps(remote, [], 's-1')))
    const picker = await screen.findByRole('combobox', { name: en['nav.currentProject'] })
    fireEvent.change(picker, { target: { value: 'project-2' } })
    await waitFor(() => { expect(selectProject).toHaveBeenCalledWith('s-1', 'project-2' as never) })
  })

  it('lists archived projects and restores one', async () => {
    const restore = vi.fn(async () => project())
    const remote = remoteWith({
      ...STANDARD,
      list: async () => [project(), project({ id: 'project-9', name: '旧队列', status: 'archived' as never })],
      restore,
    })
    render(createElement(MedProjectNav, navProps(remote, [], 's-1')))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en['home.archivedTitle'], 'u') }))
    fireEvent.click(screen.getByRole('button', { name: `${en['home.restore']} 旧队列` }))
    await waitFor(() => { expect(restore).toHaveBeenCalledWith('project-9' as never) })
  })

  it('renders the entries without a target as disabled with their reason', async () => {
    render(createElement(MedProjectNav, navProps(remoteWith(STANDARD), [], 's-1')))
    await screen.findByText(en['nav.projectInfo'])
    for (const key of ['nav.members', 'nav.projectSettings'] as const) {
      const row = screen.getByRole('button', { name: new RegExp(en[key], 'u') })
      expect(row.getAttribute('aria-disabled')).toBe('true')
      expect(row.getAttribute('title')).toBe(en['nav.pendingService'])
    }
  })
})
