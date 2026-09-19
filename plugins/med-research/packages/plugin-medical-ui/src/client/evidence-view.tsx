/**
 * The evidence and notes page (0917 图 4, UI-EVIDENCE).
 *
 * It is a page segment of the research View rather than a View of its own: the
 * roster is fixed at the five navigation entries, and the L2 tree reaches this
 * page through an opaque `page:evidence` focus (see `focus.ts`). Everything on
 * it comes from stored records — the claims come from `evidence.listClaims`,
 * each claim's evidence from `listForClaim`, the source metadata from the
 * project library, and the tab counts from the same overview counters the
 * project page shows.
 *
 * Filters narrow what is already loaded rather than re-querying: the page has
 * no server-side filter surface, so it must not pretend to search one.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/evidence-view
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Claim, Evidence, Note, Paper, ProjectId } from '@medresearch/dsh-medical-contracts'
import type { MedUiKey } from '../i18n/index.ts'
import type { MedRemote } from './remote.ts'
import { evidenceUiState } from '../state/evidence.ts'
import { EVIDENCE_STATE_KEY } from './locales.ts'
import { MedAsyncState, MedPageTabs, type MedPageTab } from './components.tsx'
import { encodePaperFocus } from './focus.ts'
import { MedEvidenceIcon, MedLibraryIcon, MedPaperIcon, MedSearchIcon } from './icons.tsx'
import { useMedLoad } from './views.tsx'

/** Segments of the page. */
type EvidenceTab = 'evidence' | 'notes'

/** How the evidence cards are laid out. */
type EvidenceLayout = 'cards' | 'list'

/** The prototype's relation badges, in the order the page lists them. */
const RELATIONS = ['SUPPORT', 'AGAINST', 'UNCERTAIN'] as const

/** One claim with the evidence bound to it. */
interface ClaimGroup {
  readonly claim: Claim
  readonly evidence: readonly Evidence[]
}

/** Props of the evidence page: it is a section, so the page passes what it owns. */
export interface MedEvidencePageProps {
  readonly remote: MedRemote
  readonly t: (key: MedUiKey) => string
  readonly projectId: ProjectId
  /** Switch back to the search segment, where evidence is extracted. */
  readonly onAddEvidence: () => void
  /** Open the cited passage in the library, addressed by its paper focus. */
  readonly onOpenSource: (focus: string) => void
}

/**
 * Render the evidence and notes page.
 * @param props - Remote client, locale reader, the bound project, and page navigation.
 * @returns the page body, without its own frame (the research View owns that).
 */
export function MedEvidencePage({ remote, t, projectId, onAddEvidence, onOpenSource }: MedEvidencePageProps): ReactElement {
  const [tab, setTab] = useState<EvidenceTab>('evidence')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [newestFirst, setNewestFirst] = useState(false)
  const [layout, setLayout] = useState<EvidenceLayout>('cards')

  const overview = useMedLoad(
    useCallback((signal: AbortSignal) => remote.projects.overview(projectId, signal), [remote, projectId]),
    [projectId],
  )
  const papers = useMedLoad(
    useCallback((signal: AbortSignal) => remote.knowledge.listPapers({ projectId }, signal), [remote, projectId]),
    [projectId],
  )
  const notes = useMedLoad(
    useCallback((signal: AbortSignal) => remote.papers.listNotes({ projectId }, signal), [remote, projectId]),
    [projectId],
  )
  // One read for the whole page: the claims first, then the evidence each one
  // binds, so the grouped list cannot render half-loaded.
  const groups = useMedLoad(
    useCallback(async (signal: AbortSignal): Promise<ClaimGroup[]> => {
      const claims = await remote.evidence.listClaims(projectId, signal)
      const bound = await Promise.all(claims.map(claim => remote.evidence.listForClaim(claim.id, signal)))
      return claims.map((claim, index) => ({ claim, evidence: bound[index] ?? [] }))
    }, [remote, projectId]),
    [projectId],
  )

  const paperById = useMemo(() => {
    const index = new Map<string, Paper>()
    for (const item of papers.value ?? []) index.set(item.id, item)
    return index
  }, [papers.value])

  /** Every publication type and year the loaded papers actually carry. */
  const facets = useMemo(() => {
    const types = new Set<string>()
    const years = new Set<string>()
    for (const item of papers.value ?? []) {
      for (const value of item.publicationTypes) types.add(value)
      const year_ = item.publicationDate?.slice(0, 4)
      if (year_ !== undefined && /^\d{4}$/u.test(year_)) years.add(year_)
    }
    return { types: [...types].sort(), years: [...years].sort().reverse() }
  }, [papers.value])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (evidence: Evidence, claim: Claim): boolean => {
      const paper = paperById.get(evidence.paperId)
      if (type !== '' && !(paper?.publicationTypes ?? []).includes(type)) return false
      if (year !== '' && (paper?.publicationDate ?? '').slice(0, 4) !== year) return false
      if (needle === '') return true
      return [claim.text, evidence.originalText, paper?.title ?? '']
        .some(value => value.toLowerCase().includes(needle))
    }
    return (groups.value ?? [])
      .map(group => ({
        claim: group.claim,
        evidence: [...group.evidence]
          .filter(evidence => matches(evidence, group.claim))
          .sort((left, right) => newestFirst
            ? right.createdAt.localeCompare(left.createdAt)
            : RELATIONS.indexOf(left.relation) - RELATIONS.indexOf(right.relation)),
      }))
      // A group whose evidence all filtered out is dropped, so the headings and
      // the counts describe what is on screen.
      .filter(group => group.evidence.length > 0 || query.trim() === '')
  }, [groups.value, paperById, query, type, year, newestFirst])

  const evidenceCount = visible.reduce((total, group) => total + group.evidence.length, 0)

  // The tab counts are the overview counters, so this page and the project card
  // can never disagree about how many records the project has.
  const segments = useMemo<readonly MedPageTab<EvidenceTab>[]>(() => {
    const evidenced = overview.value?.evidences.value
    const noted = overview.value?.notes.value
    return [
      { id: 'evidence', label: t('evidence.tab.evidence'), ...evidenced === undefined ? {} : { count: evidenced } },
      { id: 'notes', label: t('evidence.tab.notes'), ...noted === undefined ? {} : { count: noted } },
    ]
  }, [overview.value, t])

  return (
    <>
      <div className="medEvidenceHead">
        <MedPageTabs label={t('evidence.title')} onChange={setTab} tabs={segments} value={tab} />
        <Button onClick={onAddEvidence} size="sm" variant="primary">{t('evidence.add')}</Button>
      </div>

      {tab === 'evidence' ? (
        <>
          <div className="medEvidenceTools">
            <Input
              aria-label={t('evidence.search')}
              icon={<MedSearchIcon size={14} />}
              onChange={event => { setQuery(event.currentTarget.value) }}
              placeholder={t('evidence.searchPlaceholder')}
              size="md"
              value={query}
            />
            <span className="medEvidenceGroup">{t('evidence.groupByClaim')}</span>
            <span className="medEvidenceCount">{evidenceCount}</span>
            <Button
              aria-pressed={layout === 'cards'}
              onClick={() => { setLayout('cards') }}
              size="sm"
              variant={layout === 'cards' ? 'primary' : 'outline'}
            >
              {t('evidence.layoutCards')}
            </Button>
            <Button
              aria-pressed={layout === 'list'}
              onClick={() => { setLayout('list') }}
              size="sm"
              variant={layout === 'list' ? 'primary' : 'outline'}
            >
              {t('evidence.layoutList')}
            </Button>
          </div>
          <div className="medEvidenceFilters">
            <label className="medEvidenceFilter">
              <span>{t('evidence.filterType')}</span>
              <select aria-label={t('evidence.filterType')} onChange={event => { setType(event.currentTarget.value) }} value={type}>
                <option value="">{t('evidence.filterAll')}</option>
                {facets.types.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="medEvidenceFilter">
              <span>{t('evidence.filterYear')}</span>
              <select aria-label={t('evidence.filterYear')} onChange={event => { setYear(event.currentTarget.value) }} value={year}>
                <option value="">{t('evidence.filterAll')}</option>
                {facets.years.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="medEvidenceFilter">
              <span>{t('evidence.sort')}</span>
              <select aria-label={t('evidence.sort')} onChange={event => { setNewestFirst(event.currentTarget.value === 'newest') }} value={newestFirst ? 'newest' : 'relation'}>
                <option value="relation">{t('evidence.sortRelation')}</option>
                <option value="newest">{t('evidence.sortNewest')}</option>
              </select>
            </label>
          </div>

          {groups.error === undefined ? null : (
            <MedAsyncState message={groups.error} retryLabel={t('error.load')} onRetry={groups.reload} />
          )}
          {groups.loading ? <p className="state">{t('home.loading')}</p> : null}
          {(groups.value ?? []).length === 0 && !groups.loading ? <p className="state">{t('empty.evidence')}</p> : null}
          {evidenceCount === 0 && (groups.value ?? []).length > 0 ? <p className="state">{t('evidence.noMatch')}</p> : null}

          <div className="medEvidenceGroups" data-layout={layout}>
            {visible.map(group => (
              <section className="medEvidenceGroupBlock" key={group.claim.id}>
                <h3 className="medEvidenceGroupTitle">
                  <span>{group.claim.text}</span>
                  <span className="medEvidenceGroupCount">{group.evidence.length}</span>
                </h3>
                <ul className="medEvidenceCards">
                  {group.evidence.map(evidence => {
                    const paper = paperById.get(evidence.paperId)
                    return (
                      <li className="medEvidenceCard" key={evidence.id}>
                        <span className="medEvidenceBadges">
                          <span className="medRelation" data-relation={evidence.relation}>{t(`evidence.relation.${evidence.relation}` as MedUiKey)}</span>
                          {paper?.publicationTypes.slice(0, 1).map(value => (
                            <span className="medEvidenceType" key={value}>{value}</span>
                          ))}
                          <span className="medEvidenceSource">{t(EVIDENCE_STATE_KEY[evidenceUiState(evidence)])}</span>
                        </span>
                        <p className="medEvidenceQuote">{evidence.originalText}</p>
                        <span className="medEvidenceFooter">
                          <MedPaperIcon size={13} />
                          <span className="medEvidencePaper">{paper?.title ?? t('home.count.unknown')}</span>
                          <span className="medEvidenceMeta">
                            {[paper?.journal, paper?.publicationDate?.slice(0, 4), paper?.pmid === undefined ? undefined : `PMID ${paper.pmid}`]
                              .filter((value): value is string => value !== undefined && value !== '')
                              .join(' · ')}
                          </span>
                          <Button
                            onClick={() => {
                              onOpenSource(encodePaperFocus({
                                paperId: evidence.paperId,
                                documentId: evidence.documentId,
                                ...evidence.paragraphId === undefined ? {} : { paragraphId: evidence.paragraphId },
                                ...evidence.startOffset === undefined ? {} : { startOffset: evidence.startOffset },
                                ...evidence.endOffset === undefined ? {} : { endOffset: evidence.endOffset },
                              }))
                            }}
                            size="sm"
                            variant="outline"
                          >
                            {t('action.openSource')}
                          </Button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          {notes.error === undefined ? null : (
            <MedAsyncState message={notes.error} retryLabel={t('error.load')} onRetry={notes.reload} />
          )}
          {notes.loading ? <p className="state">{t('home.loading')}</p> : null}
          {(notes.value ?? []).length === 0 && !notes.loading ? <p className="state">{t('home.emptyNotes')}</p> : null}
          <ul className="medNoteList">
            {(notes.value ?? []).map((note: Note) => (
              <li className="medNoteRow" key={note.id}>
                <MedLibraryIcon size={14} />
                <span className="medNoteTitle">{note.title}</span>
                <span className="medNoteBody">{note.content}</span>
                <span className="medNoteMeta">
                  {note.paperId === undefined ? t('inspector.project') : paperById.get(note.paperId)?.title ?? t('view.papers')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'evidence' ? (
        <p className="medEvidenceHint">
          <MedEvidenceIcon size={13} /> {t('evidence.retractHint')}
        </p>
      ) : null}
    </>
  )
}
