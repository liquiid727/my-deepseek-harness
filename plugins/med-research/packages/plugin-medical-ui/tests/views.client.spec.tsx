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
import { MedEvidenceList, MedPaperReader, ResearchView, StatisticsView } from '../src/client/views.tsx'
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

function overview(counts: { papers?: number | undefined; evidences?: number | undefined; datasets?: number | undefined; analyses?: number | undefined; charts?: number | undefined } = {}): ProjectOverview {
  const counted = (value?: number) => value === undefined
    ? { status: 'unavailable' as const }
    : { status: 'counted' as const, value }
  return {
    projectId: 'project-1' as never,
    updatedAt: '2026-01-01T00:00:00.000Z',
    papers: counted(counts.papers),
    evidences: counted(counts.evidences),
    datasets: counted(counts.datasets),
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

describe('MedHomeView', () => {
  it('does not render outside a conversation session', () => {
    const remote = remoteWith({ projects: { sessionProject: async () => undefined, list: async () => [] } as never })
    render(createElement(MedHomeView, viewProps({ remote, useSession: () => undefined }) as never))
    expect(screen.queryByRole('heading', { name: en['home.heroTitle'] })).toBeNull()
  })

  it('shows the persisted counters of the bound project and links the declared views', async () => {
    const openView = vi.fn()
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '2026-01-01T00:00:00.000Z' }),
        list: async () => [project()],
        overview: async () => overview({ papers: 2, evidences: 1, datasets: 1, analyses: 2, charts: 1 }),
      } as never,
    })
    render(createElement(MedHomeView, viewProps({ remote, openView }) as never))

    expect(await screen.findByText(en['home.heroTitle'])).toBeDefined()
    await screen.findByText(en['home.count.papers'])
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    // Papers tile opens the library page; the Datasets/Analyses/Charts tiles
    // are disabled with the localized reason until S05 ships its lists.
    screen.getByRole('button', { name: new RegExp(en['home.count.papers']) }).click()
    expect(openView).toHaveBeenCalledWith('med-knowledge', '')
    const disabledTiles = screen.getAllByLabelText(new RegExp(en['home.listUnavailable']))
    expect(disabledTiles.length).toBe(3)
  })

  it('renders zero for an empty project instead of hiding the counters', async () => {
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '2026-01-01T00:00:00.000Z' }),
        list: async () => [project()],
        overview: async () => overview({ papers: 0, evidences: 0, datasets: 0, analyses: 0, charts: 0 }),
      } as never,
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))
    await screen.findByText(en['home.count.papers'])
    const tiles = screen.getAllByText('0')
    expect(tiles.length).toBe(5)
  })

  it('shows unknown plus retry for a failed domain without zeroing it', async () => {
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '2026-01-01T00:00:00.000Z' }),
        list: async () => [project()],
        overview: vi.fn()
          .mockResolvedValueOnce(overview({ papers: 2, evidences: undefined, datasets: 0, analyses: 0, charts: 0 }))
          .mockResolvedValueOnce(overview({ papers: 2, evidences: 1, datasets: 0, analyses: 0, charts: 0 })),
      } as never,
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))

    expect(await screen.findByText(en['home.count.unknown'])).toBeDefined()
    expect(screen.getAllByText(en['home.count.unknown']).length).toBe(1)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    screen.getByRole('button', { name: en['home.count.retry'] }).click()
    await screen.findByText('1')
    expect(screen.queryAllByText(en['home.count.unknown']).length).toBe(0)
  })

  it('creates a project through the Remote and selects it for the session', async () => {
    const create = vi.fn().mockResolvedValue(project())
    const selectProject = vi.fn().mockResolvedValue({ sessionId: 'session-1', projectId: 'project-1', updatedAt: '' })
    const remote = remoteWith({
      projects: {
        sessionProject: async () => undefined,
        list: async () => [],
        create,
        selectProject,
        overview: async () => overview(),
      } as never,
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))

    await screen.findByText(en['home.emptyProjects'])
    fireEvent.change(screen.getByLabelText(en['home.name']), { target: { value: 'Thoracic-B' } })
    fireEvent.change(screen.getAllByLabelText(en['home.question'])[0]!, { target: { value: 'lung cancer screening' } })
    fireEvent.submit(screen.getByRole('button', { name: en['home.create'] }).closest('form')!)
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({ name: 'Thoracic-B', researchQuestion: 'lung cancer screening' })
      expect(selectProject).toHaveBeenCalledWith('session-1', 'project-1')
    })
  })

  it('archives an active project and offers restore in the archive bin', async () => {
    const archive = vi.fn().mockResolvedValue(project({ status: 'archived' }))
    const restore = vi.fn().mockResolvedValue(project())
    const remote = remoteWith({
      projects: {
        sessionProject: async () => undefined,
        list: vi.fn()
          .mockResolvedValueOnce([project()])
          .mockResolvedValue([project({ status: 'archived' })]),
        archive,
        restore,
      } as never,
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))

    const row = await screen.findByText('PONV 研究')
    fireEvent.click(row.parentElement!.querySelector('.medArchiveLink')!)
    await waitFor(() => { expect(archive).toHaveBeenCalledWith('project-1') })
    await screen.findByText('PONV 研究')
    screen.getByRole('button', { name: new RegExp(en['home.restore']) }).click()
    await waitFor(() => { expect(restore).toHaveBeenCalledWith('project-1') })
  })

  it('filters the roster through the search field', async () => {
    const remote = remoteWith({
      projects: {
        sessionProject: async () => undefined,
        list: async () => [project(), project({ id: 'project-2', name: 'Thoracic-B' })],
      } as never,
    })
    render(createElement(MedHomeView, viewProps({ remote }) as never))
    expect(await screen.findByText('Thoracic-B')).toBeDefined()
    fireEvent.change(screen.getByLabelText(en['home.searchLabel']), { target: { value: 'thoracic' } })
    expect(screen.queryByText('PONV 研究')).toBeNull()
    expect(screen.getByText('Thoracic-B')).toBeDefined()
  })

  it('keeps the failure state with input and retry when the roster cannot load', async () => {
    const list = vi.fn().mockRejectedValue(new Error('gateway/internal'))
    const remote = remoteWith({ projects: { sessionProject: async () => undefined, list } as never })
    render(createElement(MedHomeView, viewProps({ remote }) as never))
    expect(await screen.findByRole('alert')).toBeDefined()
    // The create form stays rendered so the user keeps their input.
    expect(screen.getByLabelText(en['home.name'])).toBeDefined()
  })

  it('fills the primary input from the inspiration catalog without searching', async () => {
    const setDraft = vi.fn()
    const remote = remoteWith({ projects: { sessionProject: async () => undefined, list: async () => [] } as never })
    render(createElement(MedHomeView, viewProps({ remote, inputActions: { setDraft, submit: vi.fn() } }) as never))
    const chips = await screen.findAllByRole('button', { name: en['inspire.1'] })
    fireEvent.click(chips[0]!)
    expect(setDraft).toHaveBeenCalledWith(en['inspire.1'])
    expect(remote.literature).toBeUndefined()
  })

  it('opens Chat only when the resident composer reports an accepted message', async () => {
    const openView = vi.fn()
    const mountComposer = vi.fn(() => () => {})
    const remote = remoteWith({ projects: { sessionProject: async () => undefined, list: async () => [] } as never })
    render(createElement(MedHomeView, viewProps({
      remote,
      openView,
      mountComposer,
    }) as never))
    await screen.findByText(en['home.heroTitle'])
    expect(openView).not.toHaveBeenCalled()
    const [targetId, options] = mountComposer.mock.calls[0] as unknown as [string, { onMessageAccepted(): void }]
    expect(document.getElementById(targetId)?.closest('.medHero')).not.toBeNull()
    expect(document.querySelector('textarea')).toBeNull()
    options.onMessageAccepted()
    expect(openView).toHaveBeenCalledWith('chat', '')
  })

  it('releases the composer destination when the home leaves the screen', async () => {
    const release = vi.fn()
    const mountComposer = vi.fn(() => release)
    const remote = remoteWith({ projects: { sessionProject: async () => undefined, list: async () => [] } as never })
    const view = render(createElement(MedHomeView, viewProps({
      remote,
      mountComposer,
    }) as never))
    await screen.findByText(en['home.heroTitle'])
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

  it('hosts the Evidence section itself and sends a citation to the library', async () => {
    const openView = vi.fn()
    const remote = remoteWith({
      projects: {
        sessionProject: async () => ({ sessionId: 'session-1', projectId: 'project-1' as never, updatedAt: '' }),
        get: async () => project(),
      } as never,
      evidence: { listForClaim: async () => [evidence()] } as never,
    })
    render(createElement(ResearchView, viewProps({
      remote,
      openView,
      viewRequest: { view: 'med-research', focus: encodeClaimFocus('claim-1' as never) },
    }) as never))

    expect(await screen.findByText(en['evidence.FULLTEXT_FOUND'])).toBeDefined()
    screen.getByRole('button', { name: en['action.openSource'] }).click()
    expect(openView).toHaveBeenCalledWith('med-knowledge', 'paper-1|document-1|paragraph-1||')
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
  it('renders the focused paper and its documents', async () => {
    const remote = remoteWith({
      papers: {
        get: async () => paper(),
        document: async () => [{
          id: 'document-1', paperId: 'paper-1', sourceType: 'pmc_xml',
          contentHash: 'hash', parseStatus: 'READY', createdAt: '2026-01-01T00:00:00.000Z',
        }],
      } as never,
    })
    render(createElement(MedPaperReader, {
      remote,
      t,
      title: en['view.papers'],
      focus: decodePaperFocus(encodePaperFocus({ paperId: 'paper-1' as never })),
    } as never))

    expect(await screen.findByText('PONV and postoperative pain')).toBeDefined()
    expect(screen.getByText('A randomized trial.')).toBeDefined()
    expect(screen.getByText(/pmc_xml/)).toBeDefined()
  })

  it('locates the cited paragraph and highlights the evidence span', async () => {
    const remote = remoteWith({
      papers: {
        get: async () => paper(),
        document: async () => [],
        paragraph: async () => ({
          id: 'paragraph-1', sectionId: 'section-1', order: 0,
          text: 'The incidence of PONV was significantly lower.',
          rawText: 'The incidence of PONV was significantly lower.',
        }),
        sections: async () => [{ id: 'section-1', documentId: 'document-1', title: 'Results', type: 'results', order: 0 }],
      } as never,
    })
    render(createElement(MedPaperReader, {
      remote,
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
    expect(screen.getByText('Results')).toBeDefined()
  })
})

describe('MedEvidenceList', () => {
  it('labels each stored evidence with its display state and asks the page to open the cited paragraph', async () => {
    const onOpenSource = vi.fn()
    const remote = remoteWith({
      evidence: {
        listForClaim: async () => [
          evidence({ startOffset: 17, endOffset: 21 }),
          evidence({ id: 'evidence-2', locatorStatus: 'NOT_FOUND', supportStatus: 'REJECTED' }),
          evidence({ id: 'evidence-3', sourceType: 'secondary_citation' }),
        ],
      } as never,
    })
    render(createElement(MedEvidenceList, {
      remote,
      t,
      claimId: 'claim-1' as never,
      onOpenSource,
    } as never))

    expect(await screen.findByText(en['evidence.FULLTEXT_FOUND'])).toBeDefined()
    expect(screen.getByText(en['evidence.NOT_FOUND'])).toBeDefined()
    expect(screen.getByText(en['evidence.SECONDARY'])).toBeDefined()
    screen.getAllByRole('button', { name: en['action.openSource'] })[0]!.click()
    expect(onOpenSource).toHaveBeenCalledWith('paper-1|document-1|paragraph-1|17|21')
  })

  it('states the empty reason instead of listing nothing without a claim', () => {
    render(createElement(MedEvidenceList, {
      remote: remoteWith({ evidence: { listForClaim: async () => [] } as never }),
      t,
      claimId: undefined,
      onOpenSource: vi.fn(),
    } as never))
    expect(screen.getByText(en['empty.evidence'])).toBeDefined()
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
