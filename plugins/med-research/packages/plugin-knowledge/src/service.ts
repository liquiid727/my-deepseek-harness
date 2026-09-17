/** Knowledge library and draft service (SPEC-R001-S06). */

import { createHash } from 'node:crypto'
import type {
  Draft,
  DraftFact,
  DraftId,
  DraftRevision,
  DraftRevisionId,
  KnowledgeSearchResult,
  MedKnowledgeService,
  Paper,
  ProjectId,
  ProjectRagAnswer,
  ProjectRagCandidate,
  SourceAnchor,
  Tag,
  TagId,
} from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/**
 * Deterministic lexical score: the number of distinct query terms the text
 * contains. V1 requires lexical full-text search and an explainable ranking,
 * so the score is a count a user can verify, not a hidden weight.
 * @param text - Corpus text to score.
 * @param terms - Lower-cased query terms.
 * @returns the count of distinct matching terms.
 */
function lexicalScore(text: string, terms: readonly string[]): number {
  if (terms.length === 0) return 0
  const haystack = text.toLowerCase()
  return terms.filter(term => haystack.includes(term)).length
}

/** Construction dependencies of {@link KnowledgeService}. */
export interface KnowledgeServiceOptions {
  storage: MedStorage
  now: () => string
  newTagId: () => TagId
  newDraftId: () => DraftId
  newDraftRevisionId: () => DraftRevisionId
}

/** Stable knowledge failures. */
export type KnowledgeErrorCode = 'PROJECT_NOT_FOUND' | 'TAG_EXISTS' | 'TAG_NOT_FOUND' | 'DRAFT_NOT_FOUND' | 'DRAFT_VERSION_CONFLICT'

/** A deterministic knowledge operation failure. */
export class KnowledgeError extends Error {
  override readonly name = 'KnowledgeError'
  constructor(readonly code: KnowledgeErrorCode, message: string) { super(message) }
}

/** Project library, search, tags, and Draft lifecycle. */
export class KnowledgeService implements MedKnowledgeService {
  /** Typert Gateway binding for `medKnowledge/*`. */
  readonly typertRemote = bindTypertRemote(this, 'medKnowledge')

  constructor(private readonly options: KnowledgeServiceOptions) {}

  /**
   * List papers for one library scope.
   *
   * `currentProject` (the default) shows only this Project's saved papers;
   * `myLibrary` aggregates the papers saved to any Project the user has, and
   * `uploaded` shows locally uploaded sources. An explicit aggregate scope is
   * the only way another Project's paper becomes visible, so a caller cannot
   * widen the default scope by accident.
   */
  @Remote
  async listPapers(input: { projectId: ProjectId; scope?: 'currentProject' | 'myLibrary' | 'uploaded'; query?: string }): Promise<Paper[]> {
    this.assertProject(input.projectId)
    const scope = input.scope ?? 'currentProject'
    const memberships = [...this.options.storage.projectPapers.entries()].map(([, item]) => item)
    const projectIds = new Set([...this.options.storage.projects.entries()].map(([, project]) => project.id))
    const visible = scope === 'currentProject'
      ? new Set(memberships.filter(item => item.projectId === input.projectId).map(item => item.paperId))
      : new Set(memberships.filter(item => projectIds.has(item.projectId)).map(item => item.paperId))
    const needle = input.query?.trim().toLowerCase() ?? ''
    return [...this.options.storage.papers.entries()].map(([, paper]) => paper).filter(paper => {
      if (scope === 'uploaded') {
        if (paper.source !== 'upload') return false
      } else if (!visible.has(paper.id)) return false
      return needle === '' || `${paper.title} ${paper.pmid ?? ''} ${paper.doi ?? ''} ${paper.authors.map(author => author.name).join(' ')}`.toLowerCase().includes(needle)
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
  }

  /** Project ids that currently save one paper; the aggregate view shows these. */
  @Remote
  async memberships(paperId: import('@medresearch/dsh-medical-contracts').PaperId): Promise<string[]> {
    return [...this.options.storage.projectPapers.entries()]
      .map(([, membership]) => membership)
      .filter(membership => membership.paperId === paperId)
      .map(membership => membership.projectId)
      .sort()
  }

  /**
   * Search the project corpus.
   *
   * Matches are reported with the field that produced them (title, author,
   * PMID, abstract, note text, tag, or draft body), so the UI can explain a
   * result instead of showing an unexplained list. An empty query returns the
   * scope's paged listing rather than running a full-corpus scan, and a tag
   * match also surfaces the objects the tag is attached to.
   */
  @Remote
  async search(input: { projectId: ProjectId; query: string; kinds?: Array<'paper' | 'evidence' | 'note' | 'draft'> }): Promise<KnowledgeSearchResult[]> {
    this.assertProject(input.projectId)
    const kinds = new Set(input.kinds ?? ['paper', 'evidence', 'note', 'draft'])
    const terms = input.query.trim().toLowerCase().split(/\s+/u).filter(Boolean)
    if (terms.length === 0) return (await this.listPapers({ projectId: input.projectId })).map(paper => this.paperResult(paper, 0, input.projectId, 'title'))
    const matches: KnowledgeSearchResult[] = []
    const papers = await this.listPapers({ projectId: input.projectId })
    /** `entityType:entityId` → tag name, for objects matched only by their tag. */
    const taggedBy = new Map<string, string>()
    for (const [, tag] of this.options.storage.tags.entries()) {
      if (tag.projectId !== input.projectId || lexicalScore(tag.name, terms) === 0) continue
      for (const [, link] of this.options.storage.tagLinks.entries()) {
        if (link.tagId === tag.id) taggedBy.set(`${link.entityType}:${link.entityId}`, tag.name)
      }
    }
    if (kinds.has('paper')) for (const paper of papers) {
      const fields: Array<[NonNullable<KnowledgeSearchResult['matchedField']>, string]> = [
        ['title', paper.title],
        ['author', paper.authors.map(author => author.name).join(' ')],
        ['pmid', `${paper.pmid ?? ''} ${paper.doi ?? ''}`],
        ['abstract', paper.abstract ?? ''],
      ]
      const score = lexicalScore(fields.map(([, value]) => value).join(' '), terms)
      const byTag = taggedBy.has(`paper:${paper.id}`)
      if (score === 0 && !byTag) continue
      const hit = fields.find(([, value]) => terms.some(term => value.toLowerCase().includes(term)))
      matches.push(this.paperResult(paper, byTag && score === 0 ? 1 : score, input.projectId, byTag && score === 0 ? 'tag' : hit?.[0] ?? 'title'))
    }
    const paperIds = new Set(papers.map(paper => paper.id))
    if (kinds.has('evidence')) for (const [, evidence] of this.options.storage.evidences.entries()) {
      if (evidence.projectId !== input.projectId || !paperIds.has(evidence.paperId)) continue
      const score = lexicalScore(`${evidence.originalText} ${evidence.normalizedText}`, terms)
      const byTag = taggedBy.has(`evidence:${evidence.id}`)
      if (score === 0 && !byTag) continue
      matches.push({ kind: 'evidence', id: evidence.id, title: evidence.section ?? 'Evidence', excerpt: evidence.originalText, score: byTag && score === 0 ? 1 : score, projectId: input.projectId, matchedField: byTag && score === 0 ? 'tag' : 'note' })
    }
    if (kinds.has('note')) for (const [, note] of this.options.storage.notes.entries()) {
      if (note.projectId !== input.projectId || note.deletedAt !== undefined) continue
      const score = lexicalScore(`${note.title} ${note.content}`, terms)
      const byTag = taggedBy.has(`note:${note.id}`)
      if (score === 0 && !byTag) continue
      matches.push({ kind: 'note', id: note.id, title: note.title, excerpt: note.content.slice(0, 240), score: byTag && score === 0 ? 1 : score, projectId: input.projectId, matchedField: byTag && score === 0 ? 'tag' : 'note', ...note.anchor === undefined ? {} : { anchor: note.anchor } })
    }
    if (kinds.has('draft')) for (const [, draft] of this.options.storage.drafts.entries()) {
      if (draft.projectId !== input.projectId) continue
      const score = lexicalScore(`${draft.title} ${draft.body}`, terms)
      const byTag = taggedBy.has(`draft:${draft.id}`)
      if (score === 0 && !byTag) continue
      matches.push({ kind: 'draft', id: draft.id, title: draft.title, excerpt: draft.body.slice(0, 240), score: byTag && score === 0 ? 1 : score, projectId: input.projectId, matchedField: byTag && score === 0 ? 'tag' : 'draft' })
    }
    return matches.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
  }

  /** Create a project tag with case-folded uniqueness. */
  @Remote
  async createTag(projectId: ProjectId, name: string): Promise<Tag> {
    this.assertProject(projectId)
    const clean = name.trim()
    if (clean === '') throw new KnowledgeError('TAG_EXISTS', 'tag name must not be empty')
    if ([...this.options.storage.tags.entries()].some(([, tag]) => tag.projectId === projectId && tag.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new KnowledgeError('TAG_EXISTS', `tag '${clean}' already exists`)
    const now = this.options.now()
    const tag: Tag = { id: this.options.newTagId(), projectId, name: clean, createdAt: now, updatedAt: now }
    await this.options.storage.tags.put(tag.id, tag)
    return tag
  }

  /** Rename a tag without changing its identity. */
  @Remote
  async renameTag(id: TagId, name: string): Promise<Tag> {
    const current = this.options.storage.tags.get(id)
    if (current === undefined) throw new KnowledgeError('TAG_NOT_FOUND', `no tag ${id}`)
    const clean = name.trim()
    if ([...this.options.storage.tags.entries()].some(([otherId, tag]) => otherId !== id && tag.projectId === current.projectId && tag.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new KnowledgeError('TAG_EXISTS', `tag '${clean}' already exists`)
    const tag = { ...current, name: clean, updatedAt: this.options.now() }
    await this.options.storage.tags.put(id, tag)
    return tag
  }

  /** Remove a tag and all its links, retaining tagged entities. */
  @Remote
  async deleteTag(id: TagId): Promise<void> {
    if (this.options.storage.tags.get(id) === undefined) throw new KnowledgeError('TAG_NOT_FOUND', `no tag ${id}`)
    await this.options.storage.tags.delete(id)
    for (const [key, link] of this.options.storage.tagLinks.entries()) if (link.tagId === id) await this.options.storage.tagLinks.delete(key)
  }

  /** Link one entity to a project-local tag. */
  @Remote
  async tag(entityType: 'paper' | 'evidence' | 'note' | 'draft', entityId: string, tagId: TagId): Promise<void> {
    const tag = this.options.storage.tags.get(tagId)
    if (tag === undefined) throw new KnowledgeError('TAG_NOT_FOUND', `no tag ${tagId}`)
    const key = `${tagId}|${entityType}|${entityId}`
    await this.options.storage.tagLinks.put(key, { tagId, entityType, entityId, createdAt: this.options.now() })
  }

  /** List project tags. */
  @Remote
  async listTags(projectId: ProjectId): Promise<Tag[]> { this.assertProject(projectId); return [...this.options.storage.tags.entries()].map(([, tag]) => tag).filter(tag => tag.projectId === projectId).sort((left, right) => left.name.localeCompare(right.name)) }

  /** Create an empty Draft that can be edited and saved independently. */
  @Remote
  async createDraft(input: { projectId: ProjectId; title: string; outline?: string[]; body?: string }): Promise<Draft> {
    this.assertProject(input.projectId)
    const now = this.options.now()
    const draft: Draft = { id: this.options.newDraftId(), projectId: input.projectId, title: input.title, outline: input.outline ?? [], body: input.body ?? '', facts: [], claimIds: [], evidenceIds: [], status: 'DRAFT', revision: 1, createdAt: now, updatedAt: now }
    await this.options.storage.drafts.put(draft.id, draft)
    return draft
  }

  /** Read one Draft. */
  @Remote
  async getDraft(id: DraftId): Promise<Draft | undefined> { return this.options.storage.drafts.get(id) }

  /** List project Drafts newest first. */
  @Remote
  async listDrafts(projectId: ProjectId): Promise<Draft[]> { this.assertProject(projectId); return [...this.options.storage.drafts.entries()].map(([, draft]) => draft).filter(draft => draft.projectId === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) }

  /** Save a new immutable revision and update the Draft projection. */
  @Remote
  async saveDraftRevision(input: { draftId: DraftId; outline: string[]; body: string; facts: DraftFact[]; claimIds: string[]; evidenceIds: import('@medresearch/dsh-medical-contracts').EvidenceId[]; expectedRevision?: number }): Promise<DraftRevision> {
    const current = this.options.storage.drafts.get(input.draftId)
    if (current === undefined) throw new KnowledgeError('DRAFT_NOT_FOUND', `no draft ${input.draftId}`)
    if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) throw new KnowledgeError('DRAFT_VERSION_CONFLICT', `draft ${input.draftId} revision conflict`)
    const now = this.options.now()
    const revision = current.revision + 1
    const record: DraftRevision = { id: this.options.newDraftRevisionId(), draftId: current.id, revision, outline: [...input.outline], body: input.body, facts: input.facts, claimIds: [...input.claimIds], evidenceIds: [...input.evidenceIds], createdAt: now }
    await this.options.storage.draftRevisions.put(record.id, record)
    await this.options.storage.drafts.put(current.id, { ...current, outline: record.outline, body: record.body, facts: record.facts, claimIds: record.claimIds, evidenceIds: record.evidenceIds, status: 'DRAFT', revision, updatedAt: now })
    return record
  }

  /** Apply the status produced by evidence-backed writing validation. */
  @Remote
  async setDraftStatus(id: DraftId, status: 'DRAFT'): Promise<Draft> {
    const draft = this.options.storage.drafts.get(id)
    if (draft === undefined) throw new KnowledgeError('DRAFT_NOT_FOUND', `no draft ${id}`)
    // Only invalidation is a Knowledge operation. `REVIEWABLE` and `EXPORTED`
    // are produced by S08 validation/export after every fact is re-verified,
    // so accepting them here would let a caller assert support it never proved.
    if (status !== 'DRAFT') {
      throw new KnowledgeError('DRAFT_NOT_FOUND', `draft status '${status}' is owned by writing validation, not by the knowledge service`)
    }
    const updated: Draft = { ...draft, status: 'DRAFT', updatedAt: this.options.now() }
    await this.options.storage.drafts.put(id, updated)
    return updated
  }

  /**
   * Answer from the CURRENT Project corpus only (SPEC-R001-S06-004).
   *
   * The corpus is the Project's Paper paragraphs, verified Evidence, and
   * Notes. It is derived on every call from current storage rather than cached,
   * so a removed membership can never be answered from a stale index. When the
   * Project has no qualifying material the answer is an explicit
   * `INSUFFICIENT` with a reason — never another Project's content and never
   * model knowledge.
   * @param input - Project, query, and optional candidate cap.
   * @returns the answer with its corpus version, scored candidates, and citations.
   */
  @Remote
  async rag(input: { projectId: ProjectId; query: string; maxCandidates?: number }): Promise<ProjectRagAnswer> {
    this.assertProject(input.projectId)
    const paperIds = new Set((await this.listPapers({ projectId: input.projectId })).map(paper => paper.id))
    const corpus: Array<{ kind: ProjectRagCandidate['kind']; id: string; title: string; text: string; anchor?: SourceAnchor }> = []

    for (const [, paragraph] of this.options.storage.paragraphs.entries()) {
      const section = this.options.storage.sections.get(paragraph.sectionId)
      const document = section === undefined ? undefined : this.options.storage.documents.get(section.documentId)
      if (document === undefined || !paperIds.has(document.paperId)) continue
      corpus.push({
        kind: 'paper',
        id: paragraph.id,
        title: section?.title ?? 'Paragraph',
        text: paragraph.text,
        anchor: { projectId: input.projectId, paperId: document.paperId, documentId: document.id, paragraphId: paragraph.id },
      })
    }
    for (const [, evidence] of this.options.storage.evidences.entries()) {
      // Only verified, locatable, un-withdrawn evidence enters the corpus; a
      // pending or withdrawn record is not a usable source.
      if (evidence.projectId !== input.projectId || !paperIds.has(evidence.paperId)) continue
      if (evidence.supportStatus !== 'VERIFIED' || evidence.locatorStatus === 'NOT_FOUND' || evidence.withdrawnAt !== undefined) continue
      corpus.push({ kind: 'evidence', id: evidence.id, title: evidence.section ?? 'Evidence', text: evidence.originalText })
    }
    for (const [, note] of this.options.storage.notes.entries()) {
      if (note.projectId !== input.projectId || note.deletedAt !== undefined) continue
      corpus.push({ kind: 'note', id: note.id, title: note.title, text: note.content, ...note.anchor === undefined ? {} : { anchor: note.anchor } })
    }

    const corpusVersion = createHash('sha256')
      .update(corpus.map(entry => `${entry.kind}:${entry.id}`).sort().join('\n'))
      .digest('hex')
    const terms = input.query.trim().toLowerCase().split(/\s+/u).filter(Boolean)
    const limit = input.maxCandidates ?? 10
    const candidates = corpus
      .map(entry => ({ entry, score: lexicalScore(entry.text, terms) }))
      .filter(match => match.score > 0)
      .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
      .slice(0, limit)
      .map(({ entry, score }): ProjectRagCandidate => ({
        kind: entry.kind,
        id: entry.id,
        title: entry.title,
        excerpt: entry.text.slice(0, 400),
        score,
        ...entry.anchor === undefined ? {} : { anchor: entry.anchor },
      }))

    if (candidates.length === 0) {
      return {
        projectId: input.projectId,
        corpusVersion,
        query: input.query,
        status: 'INSUFFICIENT',
        candidates: [],
        citations: [],
        insufficientReason: corpus.length === 0
          ? 'the project corpus has no papers, verified evidence, or notes'
          : 'no corpus entry matches this question',
      }
    }
    return {
      projectId: input.projectId,
      corpusVersion,
      query: input.query,
      status: 'ANSWERED',
      candidates,
      // Notes find the source; they are never a citable fact on their own.
      citations: candidates.filter(candidate => candidate.kind !== 'note').map(candidate => `${candidate.kind}:${candidate.id}`),
    }
  }

  private assertProject(id: ProjectId): void { if (this.options.storage.projects.get(id) === undefined) throw new KnowledgeError('PROJECT_NOT_FOUND', `no project ${id}`) }
  private paperResult(paper: Paper, score: number, projectId: ProjectId, matchedField: NonNullable<KnowledgeSearchResult['matchedField']>): KnowledgeSearchResult { return { kind: 'paper', id: paper.id, title: paper.title, excerpt: paper.abstract?.slice(0, 240) ?? '', score, projectId, matchedField } }
}
