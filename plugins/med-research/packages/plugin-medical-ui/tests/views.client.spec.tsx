// @vitest-environment jsdom
/**
 * View bodies of the Med Research client (SPEC §43–§45). The components are
 * rendered directly with the real dictionaries and a fake Remote client, so the
 * load, empty, failure, and citation-navigation paths are exercised without the
 * browser bundle (see the package README's Known Limitations).
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { Evidence, Paper, Project } from '@medresearch/dsh-medical-contracts'
import { en } from '../src/i18n/index.ts'
import { NS } from '../src/client/locales.ts'
import type { MedRemote } from '../src/client/remote.ts'
import { encodePaperFocus } from '../src/client/focus.ts'
import { EvidenceView, PapersView, ResearchView, StatisticsView } from '../src/client/views.tsx'

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

function viewProps(overrides: Record<string, unknown> = {}) {
  return {
    t,
    viewRequest: null,
    openView: vi.fn(),
    completeViewRequest: vi.fn(),
    useSession: () => ({}),
    sessionId: 'session-1',
    useProjection: () => undefined,
    ...overrides,
  } as never
}

function remoteWith(overrides: Partial<MedRemote>): MedRemote {
  return overrides as MedRemote
}

describe('ResearchView', () => {
  it('does not render outside a conversation session', () => {
    const remote = remoteWith({ projects: { list: vi.fn() } as never })
    render(createElement(ResearchView, viewProps({ remote, useSession: () => undefined }) as never))
    expect(screen.queryByRole('heading', { name: en['view.research'] })).toBeNull()
  })

  it('lists projects and opens the Papers view for the selected project', async () => {
    const openView = vi.fn()
    const remote = remoteWith({
      projects: {
        list: async () => [project()],
        overview: async () => ({
          projectId: 'project-1' as never,
          questions: 0, papers: 2, evidences: 3, datasets: 0, analyses: 0, charts: 0,
        }),
      } as never,
    })
    render(createElement(ResearchView, viewProps({ remote, openView }) as never))

    const button = await screen.findByRole('button', { name: 'PONV 研究' })
    button.click()
    await screen.findByText('2')
    expect(screen.getByRole('navigation', { name: en['home.capabilities'] })).toBeDefined()
    expect(screen.getByRole('button', { name: en['view.evidence'] })).toBeDefined()
    expect(screen.getByRole('button', { name: en['view.statistics'] })).toBeDefined()
    screen.getByRole('button', { name: en['view.papers'] }).click()
    expect(openView).toHaveBeenCalledWith('med-papers', '')
  })

  it('shows the empty state when the deployment has no projects', async () => {
    const remote = remoteWith({ projects: { list: async () => [] } as never })
    render(createElement(ResearchView, viewProps({ remote }) as never))
    expect(await screen.findByText(en['empty.projects'])).toBeDefined()
  })

  it('creates a project through the Remote form', async () => {
    const create = vi.fn().mockResolvedValue(project())
    const remote = remoteWith({
      projects: {
        list: async () => [],
        create,
        overview: async () => ({
          projectId: 'project-1' as never,
          questions: 0, papers: 0, evidences: 0, datasets: 0, analyses: 0, charts: 0,
        }),
      } as never,
    })
    render(createElement(ResearchView, viewProps({ remote }) as never))
    await screen.findByText(en['empty.projects'])
    fireEvent.change(screen.getByLabelText(en['home.name']), { target: { value: 'New project' } })
    fireEvent.submit(screen.getByRole('button', { name: en['home.create'] }).closest('form')!)
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({ name: 'New project' })
    })
  })

  it('shows the failure and reloads on demand', async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('gateway/internal'))
      .mockResolvedValueOnce([])
    const remote = remoteWith({ projects: { list } as never })
    render(createElement(ResearchView, viewProps({ remote }) as never))

    expect(await screen.findByRole('alert')).toBeDefined()
    screen.getAllByRole('button', { name: en['error.load'] })[0]!.click()
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull() })
    expect(list).toHaveBeenCalledTimes(2)
  })
})

describe('PapersView', () => {
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
    render(createElement(PapersView, viewProps({
      remote,
      viewRequest: { view: 'med-papers', focus: encodePaperFocus({ paperId: 'paper-1' as never }) },
    }) as never))

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
    render(createElement(PapersView, viewProps({
      remote,
      viewRequest: {
        view: 'med-papers',
        focus: encodePaperFocus({
          paperId: 'paper-1' as never,
          documentId: 'document-1' as never,
          paragraphId: 'paragraph-1' as never,
          startOffset: 17,
          endOffset: 21,
        }),
      },
    }) as never))

    const quote = await screen.findByText('PONV')
    expect(quote.tagName).toBe('MARK')
    expect(quote.getAttribute('data-med-quote')).toBe('true')
    expect(screen.getByText('Results')).toBeDefined()
  })
})

describe('EvidenceView', () => {
  it('labels each stored evidence with its display state and opens the cited paragraph', async () => {
    const openView = vi.fn()
    const remote = remoteWith({
      evidence: {
        listForClaim: async () => [
          evidence({ startOffset: 17, endOffset: 21 }),
          evidence({ id: 'evidence-2', locatorStatus: 'NOT_FOUND', supportStatus: 'REJECTED' }),
          evidence({ id: 'evidence-3', sourceType: 'secondary_citation' }),
        ],
      } as never,
    })
    render(createElement(EvidenceView, viewProps({
      remote,
      openView,
      viewRequest: { view: 'med-evidence', focus: 'claim-1' },
    }) as never))

    expect(await screen.findByText(en['evidence.FULLTEXT_FOUND'])).toBeDefined()
    expect(screen.getByText(en['evidence.NOT_FOUND'])).toBeDefined()
    expect(screen.getByText(en['evidence.SECONDARY'])).toBeDefined()
    screen.getAllByRole('button', { name: en['action.openSource'] })[0]!.click()
    expect(openView).toHaveBeenCalledWith('med-papers', 'paper-1|document-1|paragraph-1|17|21')
  })
})

describe('StatisticsView', () => {
  it('renders the focused dataset profile', async () => {
    const remote = remoteWith({
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
