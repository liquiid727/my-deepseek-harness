// @vitest-environment jsdom
/**
 * View bodies of the Med Research client (SPEC-R001-S01-002/003, S02 split).
 * The home and session views render against the real dictionaries and a fake
 * Remote client, so the load, empty, partial, failure, roster, and
 * citation-navigation paths are exercised without the browser bundle (see the
 * package README's Known Limitations).
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { Evidence, Paper, Project, ProjectOverview } from '@medresearch/dsh-medical-contracts'
import { en } from '../src/i18n/index.ts'
import { NS } from '../src/client/locales.ts'
import type { MedRemote } from '../src/client/remote.ts'
import { decodePaperFocus, encodeClaimFocus, encodePaperFocus } from '../src/client/focus.ts'
import { MedPaperReader, ResearchView, StatisticsView } from '../src/client/views.tsx'
import { MedEvidencePage } from '../src/client/evidence-view.tsx'
import { encodePageFocus } from '../src/client/focus.ts'
import { panelInputOwner } from '../src/client/panel-input.ts'
import { KnowledgeView } from '../src/client/knowledge-view.tsx'
import { MedHomeView } from '../src/client/home.tsx'
import { MedPrimaryNavEntry, MED_NAV_ENTRIES } from '../src/client/nav.tsx'

// Each test renders into the shared jsdom document; unmount between tests so a
// query can never match a node left by the previous one.
afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]

// jsdom implements no layout: the Papers view centers the cited paragraph with
// scrollIntoView, which jsdom leaves undefined.
Element.prototype.scrollIntoView = () => {}

function project(overrides: Record<string, unknown> = {}): Project {
  return {
    id: 'project-1',
    name: 'PONV 研究',
    researchQuestion: '地塞米松能否预防 PONV？',
    keywords: [],
    workspacePath: '/tmp/med/ponv-project1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Project
}

function paper(overrides: Record<string, unknown> = {}): Paper {
  return {
    id: 'paper-1',
    title: 'PONV and postoperative pain',
    abstract: 'A randomized trial.',
    authors: [],
    publicationTypes: [],
    meshTerms: [],
    keywords: [],
    source: 'pubmed',
    fulltextStatus: 'available',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Paper
}

function evidence(overrides: Record<string, unknown> = {}): Evidence {
  return {
    id: 'evidence-1',
    projectId: 'project-1',
    paperId: 'paper-1',
    documentId: 'document-1',
    sourceType: 'fulltext',
    paragraphId: 'paragraph-1',
    originalText: 'PONV 发生率显著降低。',
    normalizedText: 'ponv 发生率显著降低。',
    offsetBase: 'normalized_paragraph',
    relation: 'SUPPORT',
    locatorStatus: 'FOUND',
    supportStatus: 'VERIFIED',
    extractorVersion: 'v1',
    extractorModel: 'test',
    promptVersion: 'v1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Evidence
}

function overview(counts: { papers?: number | undefined; evidences?: number | undefined; notes?: number | undefined; documents?: number | undefined; datasets?: number | undefined; sessions?: number | undefined; tasks?: number | undefined; analyses?: number | undefined; charts?: number | undefined } = {}): ProjectOverview {
  const counted = (value?: number) => value === undefined
    ? { status: 'unavailable' as const }
    : { status: 'counted' as const, value }
  return {
    projectId: 'project-1' as never,
    updatedAt: '2026-01-01T00:00:00.000Z',
    papers: counted(counts.papers),
    evidences: counted(counts.evidences),
    notes: counted(counts.notes),
    documents: counted(counts.documents),
    datasets: counted(counts.datasets),
    sessions: counted(counts.sessions),
    tasks: counted(counts.tasks),
    analyses: counted(counts.analyses),
    charts: counted(counts.charts),
  }
}

function viewProps(overrides: Record<string, unknown> = {}) {
  return {
    t,
    viewRequest: null,
    viewFocus: '',
    openView: vi.fn(),
    mountComposer: vi.fn(() => () => {}),
    completeViewRequest: vi.fn(),
    useSession: () => ({}),
    useSessions: (select: (state: { byId: Record<string, { cwd?: string }> }) => unknown) => select({ byId: {} }),
    sessionId: 'session-1',
    useProjection: () => undefined,
    useInput: (select: (state: { draft: string }) => string) => select({ draft: '' }),
    inputActions: { setDraft: vi.fn(), submit: vi.fn() },
    useConversation: () => ({}),
    ...overrides,
  } as never
}

function remoteWith(overrides: Partial<MedRemote>): MedRemote {
  return overrides as MedRemote
}

describe('MedHomeView (0917 图 1 project overview)', () => {
  /** A Remote whose project, paper and note reads all succeed. */
  function overviewRemote(overrides: Record<string, unknown> = {}): MedRemote {
    return remoteWith({
      ...overrides,
      knowledge: { listPapers: async () => [], ...((overrides.knowledge ?? {}) as Record<string, unknown>) } as never,
      papers: { listNotes: async () => [], ...((overrides.papers ?? {}) as Record<string, unknown>) } as never,
      projects: {
        get: async () => project(),
        overview: async () => overview({ papers: 2, evidences: 1, notes: 3, documents: 4, datasets: 1, sessions: 5 }),
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '2026-01-01T00:00:00.000Z' }),
        ...((overrides.projects ?? {}) as Record<string, unknown>),
      } as never,
    })
  }

  /** The six counter cards, scoped so a segment label of the same name cannot match. */
  function counterTiles(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('.medCounters .medTile')]
  }

  it('renders nothing outside a conversation session', () => {
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote(), useSession: () => undefined }) as never))
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('points at the project panel instead of claiming the composer when no project is bound', async () => {
    const mountComposer = vi.fn(() => () => {})
    const remote = overviewRemote({ projects: { sessionProject: async () => undefined } })
    render(createElement(MedHomeView, viewProps({ remote, mountComposer }) as never))
    expect(await screen.findByText(en['home.noProjectHint'])).toBeDefined()
    expect(mountComposer).not.toHaveBeenCalled()
  })

  it('uses the session workspace to recover a project for sessions created before bindings', async () => {
    const mountComposer = vi.fn(() => () => {})
    const remote = overviewRemote({
      projects: { sessionProject: async () => undefined, list: async () => [project()] },
    })
    const useSessions = (select: (state: { byId: Record<string, { cwd?: string }> }) => unknown) => select({
      byId: { 'session-1': { cwd: project().workspacePath } },
    })
    render(createElement(MedHomeView, viewProps({ remote, mountComposer, useSessions }) as never))
    expect(await screen.findByRole('heading', { level: 1, name: project().name })).toBeDefined()
    expect(mountComposer).toHaveBeenCalledTimes(1)
  })

  it('heads the page with the project record and its lifecycle badge', async () => {
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote() }) as never))
    expect(await screen.findByRole('heading', { level: 1, name: project().name })).toBeDefined()
    expect(screen.getByText(en['home.status.active']).getAttribute('data-status')).toBe('active')
    expect(screen.getByText(project().researchQuestion!)).toBeDefined()
    expect(screen.getByText(new RegExp(`${en['home.createdAt']}`, 'u'))).toBeDefined()
  })

  it('renders all six persisted counters with their notes', async () => {
    const { container } = render(createElement(MedHomeView, viewProps({ remote: overviewRemote() }) as never))
    await screen.findByRole('heading', { level: 1, name: project().name })
    await waitFor(() => { expect(counterTiles(container)).toHaveLength(6) })
    const text = counterTiles(container).map(tile => tile.textContent)
    for (const [label, value] of [
      ['Papers', '2'], ['Evidence', '1'], ['Notes', '3'],
      ['Documents', '4'], ['Data', '1'], ['Sessions', '5'],
    ] as const) {
      expect(text.some(entry => entry?.includes(label) && entry.includes(value))).toBe(true)
    }
    expect(text.some(entry => entry?.includes(en['home.note.papers']))).toBe(true)
  })

  it('shows the growth chip the service reported and nothing when it reported none', async () => {
    const remote = overviewRemote({
      projects: {
        overview: async () => ({
          ...overview({ papers: 9, evidences: 0, notes: 0, documents: 0, datasets: 0, sessions: 0 }),
          papers: { status: 'counted', value: 9, delta: { value: 4, windowDays: 30 } },
        }),
      },
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))
    const chip = (await screen.findByText('↑4'))
    expect(chip.getAttribute('data-tone')).toBe('up')
    expect(chip.getAttribute('title')).toBe(en['home.deltaTitle'].replace('{days}', '30'))
    // The evidence domain reported no delta, so it gets no chip.
    expect(screen.getAllByText(/^↑/u)).toHaveLength(1)
  })

  it('shows unknown with a retry for a domain the service could not read', async () => {
    const remote = overviewRemote({
      projects: {
        overview: vi.fn()
          .mockResolvedValueOnce(overview({ papers: 2, evidences: undefined }))
          .mockResolvedValueOnce(overview({ papers: 2, evidences: 1, notes: 0, documents: 0, datasets: 0, sessions: 0 })),
      },
    })
    const { container } = render(createElement(MedHomeView, viewProps({ remote }) as never))
    await waitFor(() => { expect(counterTiles(container)).toHaveLength(6) })
    expect(counterTiles(container).some(tile => tile.textContent?.includes(en['home.count.unknown']))).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: en['home.count.retry'] })[0]!)
    await waitFor(() => {
      expect(counterTiles(container).some(tile => tile.textContent?.includes(en['home.count.unknown']))).toBe(false)
    })
  })

  it('renders the six prototype segments and marks the unregistered pages', async () => {
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote() }) as never))
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      en['home.tab.overview'], en['home.tab.papers'], en['home.tab.notes'],
      en['home.tab.documents'], en['home.tab.datasets'], en['home.tab.sessions'],
    ])
    expect(tabs[2]?.getAttribute('aria-disabled')).toBe('true')
    expect(tabs[2]?.getAttribute('title')).toBe(en['home.tab.notesReason'])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('navigates the segments and the counter cards to their pages', async () => {
    const openView = vi.fn()
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote(), openView }) as never))
    fireEvent.click(await screen.findByRole('tab', { name: en['home.tab.datasets'] }))
    fireEvent.click(screen.getByRole('tab', { name: en['home.tab.sessions'] }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['home.count.papers'], 'u') }))
    expect(openView.mock.calls).toEqual([
      ['med-statistics', ''], ['chat', ''], ['med-knowledge', ''],
    ])
  })

  it('marks a counter whose domain has no page yet instead of making it clickable', async () => {
    const { container } = render(createElement(MedHomeView, viewProps({ remote: overviewRemote() }) as never))
    await waitFor(() => { expect(counterTiles(container)).toHaveLength(6) })
    const notes = counterTiles(container).find(tile => tile.textContent?.includes('Notes'))!
    expect(notes.getAttribute('data-disabled')).toBe('true')
    expect(notes.getAttribute('aria-label')).toContain(en['home.tileNoTarget'])
    expect(notes.tagName).toBe('DIV')
  })

  it('offers to continue the most recently added paper', async () => {
    const openView = vi.fn()
    const remote = overviewRemote({
      knowledge: {
        listPapers: async () => [
          paper({ id: 'paper-old', title: 'Older paper', createdAt: '2025-01-01T00:00:00.000Z' }),
          paper({ id: 'paper-new', title: 'Newest paper', createdAt: '2025-06-01T00:00:00.000Z' }),
        ],
      },
    })
    const { container } = render(createElement(MedHomeView, viewProps({ remote, openView }) as never))
    await waitFor(() => { expect(container.querySelector('.medResumeTitle')?.textContent).toBe('Newest paper') })
    fireEvent.click(screen.getByRole('button', { name: en['home.resumeRead'] }))
    expect(openView).toHaveBeenCalledWith('med-knowledge', encodePaperFocus({ paperId: 'paper-new' as never }))
  })

  it('lists the newest papers first and shows the project notes beside them', async () => {
    const remote = overviewRemote({
      knowledge: {
        listPapers: async () => [
          paper({ id: 'paper-old', title: 'Older paper', createdAt: '2025-01-01T00:00:00.000Z' }),
          paper({ id: 'paper-new', title: 'Newest paper', createdAt: '2025-06-01T00:00:00.000Z' }),
        ],
      },
      papers: { listNotes: async () => [{ id: 'note-1', title: '用药剂量笔记' }] },
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))
    await screen.findByText(en['home.recentNotes'])
    const rows = screen.getAllByText(/paper$/u).map(node => node.textContent)
    expect(rows[0]).toBe('Newest paper')
    expect(screen.getByText('用药剂量笔记')).toBeDefined()
  })

  it('states that the tasks domain does not exist yet rather than showing an empty list', async () => {
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote() }) as never))
    expect(await screen.findByText(en['home.tasks'])).toBeDefined()
    expect(screen.getByText(en['home.tasksReason'])).toBeDefined()
  })

  it('claims the host composer into a node it does not draw, because the assistant panel owns the input', async () => {
    const openView = vi.fn()
    const mountComposer = vi.fn(() => () => {})
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote(), openView, mountComposer }) as never))
    await screen.findByRole('heading', { level: 1, name: project().name })
    const [targetId, options] = mountComposer.mock.calls[0] as unknown as [string, { onMessageAccepted(): void }]
    const host = document.getElementById(targetId)!
    expect(host.closest('.medComposerHandoff')).not.toBeNull()
    expect(document.querySelector('textarea')).toBeNull()
    options.onMessageAccepted()
    expect(openView).toHaveBeenCalledWith('chat', '')
  })

  it('brings the assistant panel forward once per bound project', async () => {
    const openInspector = vi.fn()
    render(createElement(MedHomeView, viewProps({ remote: overviewRemote(), openInspector }) as never))
    await screen.findByRole('heading', { level: 1, name: project().name })
    await waitFor(() => { expect(openInspector).toHaveBeenCalled() })
    expect(openInspector).toHaveBeenCalledTimes(1)
  })

  it('releases the composer destination when the overview leaves the screen', async () => {
    const release = vi.fn()
    const mountComposer = vi.fn(() => release)
    const view = render(createElement(MedHomeView, viewProps({ remote: overviewRemote(), mountComposer }) as never))
    await screen.findByRole('heading', { level: 1, name: project().name })
    view.unmount()
    expect(release).toHaveBeenCalledOnce()
  })
})

describe('ResearchView', () => {
  it('does not render outside a conversation session', () => {
    const remote = remoteWith({ projects: { sessionProject: async () => undefined } as never })
    render(createElement(ResearchView, viewProps({ remote, useSession: () => undefined }) as never))
    expect(screen.queryByRole('heading', { name: en['view.research'] })).toBeNull()
  })

  it('guides to the home when no project is bound to the session', async () => {
    const openView = vi.fn()
    const remote = remoteWith({ projects: { sessionProject: async () => undefined } as never })
    render(createElement(ResearchView, viewProps({ remote, openView }) as never))
    expect(await screen.findByText(en['research.noProject'])).toBeDefined()
    screen.getByRole('button', { name: en['research.openHome'] }).click()
    expect(openView).toHaveBeenCalledWith('med-home', '')
  })

  it('adopts the research question from the view request focus', async () => {
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '' }),
        get: async () => project(),
      },
    } as never)
    render(createElement(ResearchView, viewProps({
      remote,
      viewRequest: { view: 'med-research', focus: 'PONV risk factors' },
    }) as never))
    expect(await screen.findByLabelText(en['research.question'])).toHaveProperty('value', 'PONV risk factors')
  })

  it('shows the failure and reloads on demand', async () => {
    const sessionProject = vi.fn()
      .mockRejectedValueOnce(new Error('gateway/internal'))
      .mockResolvedValueOnce(undefined)
    const remote = remoteWith({ projects: { sessionProject } as never })
    render(createElement(ResearchView, viewProps({ remote } as never)))

    expect(await screen.findByRole('alert')).toBeDefined()
    screen.getAllByRole('button', { name: en['error.load'] })[0]!.click()
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull() })
    expect(sessionProject).toHaveBeenCalledTimes(2)
  })

  it('owns the resident composer at the bottom of the result column', async () => {
    const release = vi.fn()
    const mountComposer = vi.fn(() => release)
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '' }),
        get: async () => project(),
      },
    } as never)
    const view = render(createElement(ResearchView, viewProps({ remote, mountComposer }) as never))
    await screen.findByLabelText(en['research.question'])
    const [targetId, options] = mountComposer.mock.calls[0] as unknown as
      [string, { placeholder: string; onMessageAccepted(): void }]
    // The destination exists and belongs to the result column, not the shell.
    expect(document.getElementById(targetId)?.closest('.researchWorkspace')).not.toBeNull()
    expect(options.placeholder).toBe(en['research.composerPlaceholder'])
    view.unmount()
    expect(release).toHaveBeenCalledOnce()
  })

  it('claims no composer destination while it guides to the home', async () => {
    const mountComposer = vi.fn(() => () => {})
    const remote = remoteWith({ projects: { sessionProject: async () => undefined } as never })
    render(createElement(ResearchView, viewProps({ remote, mountComposer }) as never))
    await screen.findByText(en['research.noProject'])
    expect(mountComposer).not.toHaveBeenCalled()
  })

  it('hosts the evidence page as a segment and sends a citation to the library', async () => {
    const openView = vi.fn()
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '' }),
        get: async () => project(),
        overview: async () => overview({ evidences: 1 }),
      } as never,
      evidence: {
        listClaims: async () => [{ id: 'claim-1', projectId: 'project-1', text: '地塞米松可降低 PONV', createdAt: '2025-01-01T00:00:00.000Z' }],
        listForClaim: async () => [evidence({ startOffset: 17, endOffset: 21 })],
      } as never,
      knowledge: { listPapers: async () => [paper()] } as never,
      papers: { listNotes: async () => [] } as never,
    })
    render(createElement(ResearchView, viewProps({
      remote,
      openView,
      viewRequest: { view: 'med-research', focus: encodePageFocus('evidence') },
    }) as never))

    // The segment is addressable from the L2 tree, and a claim focus lands here.
    expect(await screen.findByText(en['evidence.title'])).toBeDefined()
    await waitFor(() => { expect(screen.getAllByRole('button', { name: en['action.openSource'] }).length).toBeGreaterThan(0) })
    screen.getAllByRole('button', { name: en['action.openSource'] })[0]!.click()
    expect(openView).toHaveBeenCalledWith('med-knowledge', 'paper-1|document-1|paragraph-1|17|21')
  })

  it('hands its input to the assistant panel on the evidence segment only', async () => {
    const mountComposer = vi.fn(() => () => {})
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '' }),
        get: async () => project(),
        overview: async () => overview({ evidences: 0 }),
      } as never,
      evidence: { listClaims: async () => [], listForClaim: async () => [] } as never,
      knowledge: { listPapers: async () => [] } as never,
      papers: { listNotes: async () => [] } as never,
    })
    render(createElement(ResearchView, viewProps({
      remote,
      mountComposer,
      viewRequest: { view: 'med-research', focus: encodePageFocus('evidence') },
    }) as never))
    await screen.findByText(en['evidence.title'])
    await waitFor(() => { expect(panelInputOwner()).toBe('med-research:evidence') })
    // 图 4 has no centre input, so the host composer is not claimed here.
    expect(mountComposer).not.toHaveBeenCalled()
  })
})

describe('MedPrimaryNavEntry', () => {
  const noSessions = (select: (state: { current?: string }) => unknown) => select({ current: 'session-1' })
  const noViewSelection = () => undefined

  it('renders five entries, navigates on click, and enables the skills target', () => {
    const navigate = vi.fn()
    const wideProps = { wide: true, t, navigate, useSessions: noSessions, viewSelection: noViewSelection }
    for (const entry of MED_NAV_ENTRIES) {
      render(createElement(MedPrimaryNavEntry, { ...wideProps, entry } as never))
    }
    expect(screen.getAllByRole('button').length).toBe(5)
    screen.getByRole('button', { name: en['nav.home'] }).click()
    expect(navigate).toHaveBeenCalledWith('med-home')
    // The skills workbench is a delivered V1 surface, so its entry navigates
    // instead of rendering a disabled placeholder.
    const skills = screen.getByRole('button', { name: en['nav.skills'] })
    expect(skills.getAttribute('aria-disabled')).toBeNull()
    skills.click()
    expect(navigate).toHaveBeenCalledWith('med-skills')
  })

  // The host strip hands down wide:false in both column states, so the label
  // must render with and without it — an icon-only rail loses every entry name.
  it('renders the entry label in both column states', () => {
    for (const wide of [true, false]) {
      render(createElement(MedPrimaryNavEntry, {
        wide, t, navigate: vi.fn(), useSessions: noSessions, viewSelection: noViewSelection,
        entry: MED_NAV_ENTRIES[0]!,
      } as never))
    }
    expect(screen.getAllByText(en['nav.home']).length).toBe(2)
    expect(screen.getAllByRole('button', { name: en['nav.home'] }).length).toBe(2)
  })

  it('highlights the entry whose view is active on the current session', async () => {
    let listener: (() => void) | undefined
    let view: string | null = 'med-research'
    const source = {
      getSnapshot: () => ({ view }),
      subscribe: (fn: () => void) => { listener = fn; return () => { listener = undefined } },
    }
    render(createElement(MedPrimaryNavEntry, {
      wide: true, t, navigate: vi.fn(),
      useSessions: (select: (state: { current?: string }) => unknown) => select({ current: 'session-1' }),
      viewSelection: () => source,
      entry: MED_NAV_ENTRIES[1]!,
    } as never))
    const button = screen.getByRole('button', { name: en['nav.research'] })
    expect(button.getAttribute('aria-current')).toBe('page')
    view = 'med-home'
    listener?.()
    await waitFor(() => { expect(button.getAttribute('aria-current')).toBeNull() })
  })
})

describe('MedPaperReader', () => {
  /** A Remote serving one parsed document with a Results section. */
  function readerRemote(overrides: Record<string, unknown> = {}): MedRemote {
    return remoteWith({
      papers: {
        get: async () => paper(),
        document: async () => [{
          id: 'document-1', paperId: 'paper-1', sourceType: 'pmc_xml',
          contentHash: 'hash', parseStatus: 'READY', createdAt: '2026-01-01T00:00:00.000Z',
        }],
        paragraph: async () => ({
          id: 'paragraph-1', sectionId: 'section-1', order: 0,
          text: 'The incidence of PONV was significantly lower.',
          rawText: 'The incidence of PONV was significantly lower.',
        }),
        paragraphs: async () => [
          { id: 'paragraph-1', sectionId: 'section-1', order: 0, text: 'The incidence of PONV was significantly lower.', rawText: '' },
          { id: 'paragraph-2', sectionId: 'section-1', order: 1, text: 'No dose effect was observed.', rawText: '' },
        ],
        sections: async () => [
          { id: 'section-1', documentId: 'document-1', title: 'Results', type: 'results', order: 1 },
          { id: 'section-2', documentId: 'document-1', title: 'Discussion', type: 'discussion', order: 2 },
        ],
        ...((overrides.papers ?? {}) as Record<string, unknown>),
      } as never,
    })
  }

  it('renders the paper metadata and the catalogue of its parsed document', async () => {
    render(createElement(MedPaperReader, {
      remote: readerRemote(),
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })),
    } as never))

    expect(await screen.findByText('PONV and postoperative pain')).toBeDefined()
    expect(await screen.findByRole('navigation', { name: en['reader.catalog'] })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Results' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Discussion' })).toBeDefined()
    expect(screen.getByText('A randomized trial.')).toBeDefined()
  })

  it('renders the selected section body and switches it from the catalogue', async () => {
    const { container } = render(createElement(MedPaperReader, {
      remote: readerRemote(),
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })),
    } as never))
    await waitFor(() => { expect(container.querySelectorAll('.medReaderBody p')).toHaveLength(2) })
    fireEvent.click(screen.getByRole('button', { name: 'Discussion' }))
    // The empty section says so rather than rendering nothing at all.
    expect(await screen.findByText(en['reader.noBody'])).toBeDefined()
  })

  it('locates the cited paragraph, highlights the span, and opens its section', async () => {
    render(createElement(MedPaperReader, {
      remote: readerRemote(),
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({
        paperId: 'paper-1' as never,
        documentId: 'document-1' as never,
        paragraphId: 'paragraph-1' as never,
        startOffset: 17,
        endOffset: 21,
      })),
    } as never))

    const quote = await screen.findByText('PONV')
    expect(quote.tagName).toBe('MARK')
    expect(quote.getAttribute('data-med-quote')).toBe('true')
    expect(screen.getByRole('button', { name: 'Results' }).getAttribute('data-active')).toBe('true')
  })

  it('offers the reading modes, disabling the two without a translator', async () => {
    render(createElement(MedPaperReader, {
      remote: readerRemote(),
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })),
    } as never))
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      en['reader.mode.source'], en['reader.mode.translated'], en['reader.mode.bilingual'],
    ])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
    expect(tabs[1]?.getAttribute('aria-disabled')).toBe('true')
    expect(tabs[1]?.getAttribute('title')).toBe(en['reader.mode.reason'])
  })

  it('zooms the body and fits it back to 100%', async () => {
    const { container } = render(createElement(MedPaperReader, {
      remote: readerRemote(),
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })),
    } as never))
    await waitFor(() => { expect(container.querySelector('.medReaderBody')?.getAttribute('data-zoom')).toBe('100') })
    fireEvent.click(screen.getByRole('button', { name: en['reader.zoomIn'] }))
    await waitFor(() => { expect(container.querySelector('.medReaderBody')?.getAttribute('data-zoom')).toBe('120') })
    fireEvent.click(screen.getByRole('button', { name: en['reader.zoomOut'] }))
    fireEvent.click(screen.getByRole('button', { name: en['reader.zoomOut'] }))
    await waitFor(() => { expect(container.querySelector('.medReaderBody')?.getAttribute('data-zoom')).toBe('80') })
    expect(screen.getByRole('button', { name: en['reader.zoomFit'] })).toBeDefined()
  })

  it('says the paper has no parsed document instead of showing an empty catalogue', async () => {
    render(createElement(MedPaperReader, {
      remote: readerRemote({ papers: { document: async () => [], sections: async () => [], paragraphs: async () => [] } }),
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })),
    } as never))
    expect(await screen.findByText(en['reader.noDocument'])).toBeDefined()
  })
})

describe('MedEvidencePage (0917 图 4)', () => {
  /** A Remote whose claims, evidence, papers and notes all load. */
  function pageRemote(overrides: Record<string, unknown> = {}): MedRemote {
    return remoteWith({
      ...overrides,
      evidence: {
        listClaims: async () => [
          { id: 'claim-1', projectId: 'project-1', text: '地塞米松可降低 PONV 发生率', createdAt: '2025-02-01T00:00:00.000Z' },
          { id: 'claim-2', projectId: 'project-1', text: '最佳剂量为 4–8 mg', createdAt: '2025-01-01T00:00:00.000Z' },
        ],
        listForClaim: async (id: never) => id === 'claim-1'
          ? [
            evidence({ id: 'ev-1', relation: 'SUPPORT', startOffset: 17, endOffset: 21, createdAt: '2024-01-01T00:00:00.000Z' }),
            evidence({ id: 'ev-2', relation: 'AGAINST', paperId: 'paper-2', createdAt: '2025-05-01T00:00:00.000Z' }),
          ]
          : [evidence({ id: 'ev-3', paperId: 'paper-2' })],
        ...((overrides.evidence ?? {}) as Record<string, unknown>),
      } as never,
      knowledge: {
        listPapers: async () => [
          paper({ id: 'paper-1', title: 'Dexamethasone for PONV', publicationTypes: ['Randomized Controlled Trial'], publicationDate: '2023-01-01' }),
          paper({ id: 'paper-2', title: 'Dose response review', publicationTypes: ['Review'], publicationDate: '2021-01-01' }),
        ],
        ...((overrides.knowledge ?? {}) as Record<string, unknown>),
      } as never,
      papers: {
        listNotes: async () => [{ id: 'note-1', title: '剂量笔记', content: '4–8 mg 区间', paperId: 'paper-1' }],
        ...((overrides.papers ?? {}) as Record<string, unknown>),
      } as never,
      projects: {
        overview: async () => overview({ evidences: 3, notes: 1 }),
        ...((overrides.projects ?? {}) as Record<string, unknown>),
      } as never,
    })
  }

  function pageProps(remote: MedRemote, overrides: Record<string, unknown> = {}) {
    return { remote, t, projectId: 'project-1', onAddEvidence: vi.fn(), onOpenSource: vi.fn(), ...overrides } as never
  }

  it('groups the stored evidence under its claim with relation badges', async () => {
    const { container } = render(createElement(MedEvidencePage, pageProps(pageRemote())))
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceGroupBlock')).toHaveLength(2) })
    const headings = [...container.querySelectorAll('.medEvidenceGroupTitle')].map(node => node.textContent)
    expect(headings[0]).toContain('地塞米松可降低 PONV 发生率')
    expect(headings[0]).toContain('2')
    expect(screen.getAllByText(en['evidence.relation.SUPPORT'])).toHaveLength(2)
    expect(screen.getByText(en['evidence.relation.AGAINST'])).toBeDefined()
    expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(3)
  })

  it('takes the tab counts from the overview counters rather than from what it loaded', async () => {
    render(createElement(MedEvidencePage, pageProps(pageRemote())))
    const tabs = await screen.findAllByRole('tab')
    expect(tabs[0]?.textContent).toBe(`${en['evidence.tab.evidence']}3`)
    expect(tabs[1]?.textContent).toBe(`${en['evidence.tab.notes']}1`)
  })

  it('narrows the list by quote, claim text, and paper title', async () => {
    const { container } = render(createElement(MedEvidencePage, pageProps(pageRemote())))
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(3) })
    fireEvent.change(screen.getByRole('textbox', { name: en['evidence.search'] }), { target: { value: 'dose response' } })
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(2) })
    expect(screen.getByText('最佳剂量为 4–8 mg')).toBeDefined()
  })

  it('filters by publication type and by year from the loaded papers', async () => {
    const { container } = render(createElement(MedEvidencePage, pageProps(pageRemote())))
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(3) })
    fireEvent.change(screen.getByRole('combobox', { name: en['evidence.filterType'] }), { target: { value: 'Review' } })
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(2) })
    fireEvent.change(screen.getByRole('combobox', { name: en['evidence.filterYear'] }), { target: { value: '2023' } })
    await waitFor(() => { expect(screen.getByText(en['evidence.noMatch'])).toBeDefined() })
  })

  it('reorders the evidence when the reader asks for the newest first', async () => {
    const { container } = render(createElement(MedEvidencePage, pageProps(pageRemote())))
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(3) })
    const ids = () => [...container.querySelectorAll('.medEvidenceCard')].map(node => node.textContent?.slice(0, 24))
    const byRelation = ids()
    fireEvent.change(screen.getByRole('combobox', { name: en['evidence.sort'] }), { target: { value: 'newest' } })
    await waitFor(() => { expect(ids()).not.toEqual(byRelation) })
  })

  it('opens the cited passage in the library', async () => {
    const onOpenSource = vi.fn()
    const { container } = render(createElement(MedEvidencePage, pageProps(pageRemote(), { onOpenSource })))
    await waitFor(() => { expect(container.querySelectorAll('.medEvidenceCard')).toHaveLength(3) })
    fireEvent.click(screen.getAllByRole('button', { name: en['action.openSource'] })[0]!)
    expect(onOpenSource).toHaveBeenCalledWith(encodePaperFocus({
      paperId: 'paper-1' as never,
      documentId: 'document-1' as never,
      paragraphId: 'paragraph-1' as never,
      startOffset: 17,
      endOffset: 21,
    }))
  })

  it('lists the project notes on the second segment', async () => {
    render(createElement(MedEvidencePage, pageProps(pageRemote())))
    fireEvent.click((await screen.findAllByRole('tab'))[1]!)
    expect(await screen.findByText('剂量笔记')).toBeDefined()
    expect(screen.getByText('Dexamethasone for PONV')).toBeDefined()
  })

  it('sends the reader back to the search segment to add evidence', async () => {
    const onAddEvidence = vi.fn()
    render(createElement(MedEvidencePage, pageProps(pageRemote(), { onAddEvidence })))
    fireEvent.click(await screen.findByRole('button', { name: en['evidence.add'] }))
    expect(onAddEvidence).toHaveBeenCalledTimes(1)
  })
})

describe('KnowledgeView', () => {
  const bound = (overrides: Record<string, unknown> = {}) => remoteWith({
    projects: {
      sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '' }),
      get: async () => project(),
    } as never,
    knowledge: { listPapers: async () => [paper()], listTags: async () => [], listDrafts: async () => [] } as never,
    papers: { get: async () => paper(), document: async () => [], paragraph: async () => undefined, sections: async () => [] } as never,
    ...overrides,
  } as never)

  it('opens the reader inside the library instead of navigating to a view tab', async () => {
    const openView = vi.fn()
    render(createElement(KnowledgeView, viewProps({ remote: bound(), openView }) as never))
    fireEvent.click(await screen.findByRole('button', { name: 'PONV and postoperative pain' }))
    expect(await screen.findByText('A randomized trial.')).toBeDefined()
    expect(openView).not.toHaveBeenCalled()
  })

  it('shows the project and page in a breadcrumb', async () => {
    render(createElement(KnowledgeView, viewProps({ remote: bound() }) as never))
    expect(await screen.findByRole('navigation', { name: en['nav.breadcrumb'] })).toHaveProperty('textContent', expect.stringContaining('PONV 研究'))
  })
})

describe('StatisticsView', () => {
  it('renders the focused dataset profile', async () => {
    const remote = remoteWith({
      projects: { sessionProject: async () => undefined, get: async () => undefined } as never,
      datasets: {
        profile: async () => ({
          id: 'dataset-1', projectId: 'project-1', filename: 'cohort.csv',
          contentHash: 'hash', rowCount: 120, columnCount: 2, schema: [
            { name: 'age', inferredType: 'continuous', nullable: false, missingCount: 3, uniqueCount: 20 },
            { name: 'outcome', inferredType: 'binary', nullable: false, missingCount: 0, uniqueCount: 2 },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      } as never,
    })
    render(createElement(StatisticsView, viewProps({
      remote,
      viewRequest: { view: 'med-statistics', focus: 'dataset-1' },
    }) as never))

    expect(await screen.findByText('cohort.csv')).toBeDefined()
    expect(screen.getByText('120')).toBeDefined()
    expect(screen.getByRole('img', { name: en['statistics.MISSING_VALUES'] })).toBeDefined()
  })
})
