/**
 * S06 knowledge coverage (SPEC-R001-S06-001..004). Pins the behaviours the spec
 * makes normative: explicit library scopes with memberships, Project RAG over
 * the current Project corpus only, matched-field search, tag lifecycle, and the
 * rule that only writing validation may produce a qualified Draft status.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { KnowledgeError, KnowledgeService } from '../src/service.ts'

const PROJECT = c.projectIdSchema.parse('project-1')
const OTHER_PROJECT = c.projectIdSchema.parse('project-2')
const PAPER = c.paperIdSchema.parse('paper-1')
const OTHER_PAPER = c.paperIdSchema.parse('paper-2')
const DOCUMENT = c.documentIdSchema.parse('doc-1')
const SECTION = c.sectionIdSchema.parse('sec-1')
const PARAGRAPH = c.paragraphIdSchema.parse('par-1')
const NOTE = c.noteIdSchema.parse('note-1')
const PARAGRAPH_TEXT = 'PONV incidence fell after ondansetron prophylaxis in the treated arm.'

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => {
  for (const item of booted.splice(0)) await item.close()
})

interface App {
  storage: MedStorage
  service: KnowledgeService
}

async function boot(): Promise<App> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  booted.push({
    async close() {
      await storage.close()
      await facility.closeAll()
      await backend.close()
    },
  })

  for (const [id, name] of [[PROJECT, 'Current project'], [OTHER_PROJECT, 'Other project']] as const) {
    await storage.projects.put(id, {
      id, name, keywords: [], workspacePath: `/tmp/${id}`, status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    })
  }
  await storage.papers.put(PAPER, {
    id: PAPER, title: 'Ondansetron for PONV', authors: [{ name: 'Ada Lovelace' }], publicationTypes: [],
    meshTerms: [], keywords: [], pmid: '424242', abstract: 'A randomized comparison of ondansetron dosing.',
    source: 'pubmed', fulltextStatus: 'available',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.papers.put(OTHER_PAPER, {
    id: OTHER_PAPER, title: 'Dexamethasone and PONV', authors: [], publicationTypes: [], meshTerms: [], keywords: [],
    source: 'upload', fulltextStatus: 'available',
    createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
  })
  await storage.projectPapers.put(`${PROJECT}|${PAPER}`, { projectId: PROJECT, paperId: PAPER, savedAt: '2026-01-01T00:00:00.000Z' })
  await storage.projectPapers.put(`${OTHER_PROJECT}|${OTHER_PAPER}`, { projectId: OTHER_PROJECT, paperId: OTHER_PAPER, savedAt: '2026-01-02T00:00:00.000Z' })
  await storage.documents.put(DOCUMENT, {
    id: DOCUMENT, paperId: PAPER, sourceType: 'pmc_xml', contentHash: 'h', parseStatus: 'READY',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await storage.sections.put(SECTION, { id: SECTION, documentId: DOCUMENT, title: 'Results', type: 'results', order: 0 })
  await storage.paragraphs.put(PARAGRAPH, { id: PARAGRAPH, sectionId: SECTION, order: 0, text: PARAGRAPH_TEXT, rawText: PARAGRAPH_TEXT })

  let sequence = 0
  const service = new KnowledgeService({
    storage,
    now: () => '2026-01-01T00:00:00.000Z',
    newTagId: () => c.tagIdSchema.parse(`tag-${++sequence}`),
    newDraftId: () => c.draftIdSchema.parse(`draft-${++sequence}`),
    newDraftRevisionId: () => c.draftRevisionIdSchema.parse(`rev-${++sequence}`),
  })
  return { storage, service }
}

async function verifiedEvidence(app: App, quote = 'PONV incidence fell after ondansetron prophylaxis'): Promise<c.Evidence> {
  const evidence = await app.storage.evidences.put
  void evidence
  const record: c.Evidence = {
    id: c.evidenceIdSchema.parse('evidence-1'),
    projectId: PROJECT, paperId: PAPER, documentId: DOCUMENT, sourceType: 'fulltext', section: 'Results',
    paragraphId: PARAGRAPH, page: 3, originalText: quote, normalizedText: quote, offsetBase: 'normalized_paragraph',
    startOffset: 0, endOffset: quote.length, relation: 'SUPPORT', locatorStatus: 'FOUND', supportStatus: 'VERIFIED',
    extractorVersion: 'v1', extractorModel: 'model-x', promptVersion: 'p1', createdAt: '2026-01-01T00:00:00.000Z',
  }
  await app.storage.evidences.put(record.id, record)
  return record
}

describe('S06 library scopes (SPEC-R001-S06-001)', () => {
  it('keeps the default scope on the current project only', async () => {
    const app = await boot()
    const papers = await app.service.listPapers({ projectId: PROJECT })
    expect(papers.map(paper => paper.id)).toEqual([PAPER])
  })

  it('aggregates other projects only under the explicit myLibrary scope', async () => {
    const app = await boot()
    const aggregate = await app.service.listPapers({ projectId: PROJECT, scope: 'myLibrary' })
    expect(aggregate.map(paper => paper.id).sort()).toEqual([PAPER, OTHER_PAPER].sort())
    // Membership stays visible for each aggregate row.
    expect(await app.service.memberships(OTHER_PAPER)).toEqual([OTHER_PROJECT])
  })

  it('shows uploaded sources only under the uploaded scope', async () => {
    const app = await boot()
    const uploaded = await app.service.listPapers({ projectId: PROJECT, scope: 'uploaded' })
    expect(uploaded.map(paper => paper.id)).toEqual([OTHER_PAPER])
  })
})

describe('S06 search (SPEC-R001-S06-003)', () => {
  it('reports the field that produced each match', async () => {
    const app = await boot()
    const byAuthor = await app.service.search({ projectId: PROJECT, query: 'lovelace' })
    expect(byAuthor[0]).toMatchObject({ kind: 'paper', id: PAPER, matchedField: 'author' })
    const byPmid = await app.service.search({ projectId: PROJECT, query: '424242' })
    expect(byPmid[0]).toMatchObject({ kind: 'paper', matchedField: 'pmid' })
    const byAbstract = await app.service.search({ projectId: PROJECT, query: 'dosing' })
    expect(byAbstract[0]).toMatchObject({ kind: 'paper', matchedField: 'abstract' })
  })

  it('returns the scope listing for an empty query instead of scanning the corpus', async () => {
    const app = await boot()
    await verifiedEvidence(app)
    const results = await app.service.search({ projectId: PROJECT, query: '   ' })
    expect(results.map(result => result.kind)).toEqual(['paper'])
  })

  it('never returns another project content', async () => {
    const app = await boot()
    const results = await app.service.search({ projectId: PROJECT, query: 'dexamethasone' })
    expect(results).toEqual([])
  })

  it('surfaces objects a matching tag is attached to', async () => {
    const app = await boot()
    const tag = await app.service.createTag(PROJECT, 'anesthesia')
    // Nothing is tagged yet, so the tag name alone matches no object.
    expect(await app.service.search({ projectId: PROJECT, query: 'anesthesia' })).toEqual([])

    await app.service.tag('paper', PAPER, tag.id)
    const tagged = await app.service.search({ projectId: PROJECT, query: 'anesthesia' })
    expect(tagged[0]).toMatchObject({ kind: 'paper', id: PAPER, matchedField: 'tag' })
  })
})

describe('S06 Project RAG (SPEC-R001-S06-004)', () => {
  it('answers from the current project corpus with a version and citations', async () => {
    const app = await boot()
    const evidence = await verifiedEvidence(app)
    const answer = await app.service.rag({ projectId: PROJECT, query: 'ondansetron' })
    expect(answer.status).toBe('ANSWERED')
    expect(answer.corpusVersion).toMatch(/^[0-9a-f]{64}$/u)
    expect(answer.candidates.map(candidate => candidate.kind)).toContain('evidence')
    expect(answer.citations).toContain(`evidence:${evidence.id}`)
  })

  it('reports insufficiency instead of reaching for another project or model knowledge', async () => {
    const app = await boot()
    const answer = await app.service.rag({ projectId: PROJECT, query: 'dexamethasone' })
    expect(answer.status).toBe('INSUFFICIENT')
    expect(answer.candidates).toEqual([])
    expect(answer.citations).toEqual([])
    expect(answer.insufficientReason).toBeDefined()
  })

  it('changes the corpus version when the project corpus changes', async () => {
    const app = await boot()
    const before = await app.service.rag({ projectId: PROJECT, query: 'ondansetron' })
    await verifiedEvidence(app)
    const after = await app.service.rag({ projectId: PROJECT, query: 'ondansetron' })
    expect(after.corpusVersion).not.toBe(before.corpusVersion)
  })

  it('stops answering from a membership that was removed', async () => {
    const app = await boot()
    const evidence = await verifiedEvidence(app)
    expect((await app.service.rag({ projectId: PROJECT, query: 'ondansetron' })).status).toBe('ANSWERED')
    await app.storage.projectPapers.delete(`${PROJECT}|${PAPER}`)
    const answer = await app.service.rag({ projectId: PROJECT, query: 'ondansetron' })
    expect(answer.status).toBe('INSUFFICIENT')
    // The evidence record itself is kept; it is the corpus that changed.
    expect(app.storage.evidences.get(evidence.id)).toBeDefined()
  })

  it('leaves an unverified evidence out of the corpus', async () => {
    const app = await boot()
    const evidence = await verifiedEvidence(app)
    await app.storage.evidences.put(evidence.id, { ...evidence, supportStatus: 'PENDING' })
    const answer = await app.service.rag({ projectId: PROJECT, query: 'ondansetron' })
    expect(answer.candidates.every(candidate => candidate.kind !== 'evidence')).toBe(true)
  })
})

describe('S06 Draft and tag lifecycle (SPEC-R001-S06-002, -004)', () => {
  it('refuses to let a caller assert a qualified Draft status', async () => {
    const app = await boot()
    const draft = await app.service.createDraft({ projectId: PROJECT, title: 'Draft' })
    expect(draft.status).toBe('DRAFT')
    await expect(app.service.setDraftStatus(draft.id, 'REVIEWABLE' as 'DRAFT')).rejects.toBeInstanceOf(KnowledgeError)
    expect(app.storage.drafts.get(draft.id)?.status).toBe('DRAFT')
  })

  it('invalidates a Draft back to DRAFT', async () => {
    const app = await boot()
    const draft = await app.service.createDraft({ projectId: PROJECT, title: 'Draft' })
    await app.storage.drafts.put(draft.id, { ...draft, status: 'REVIEWABLE' })
    const updated = await app.service.setDraftStatus(draft.id, 'DRAFT')
    expect(updated.status).toBe('DRAFT')
  })

  it('rejects a stale draft revision instead of overwriting it', async () => {
    const app = await boot()
    const draft = await app.service.createDraft({ projectId: PROJECT, title: 'Draft' })
    await expect(app.service.saveDraftRevision({
      draftId: draft.id, outline: [], body: 'b', facts: [], claimIds: [], evidenceIds: [], expectedRevision: 99,
    })).rejects.toMatchObject({ code: 'DRAFT_VERSION_CONFLICT' })
  })

  it('renames a tag atomically and keeps tagged objects on delete', async () => {
    const app = await boot()
    const tag = await app.service.createTag(PROJECT, '  anesthesia ')
    expect(tag.name).toBe('anesthesia')
    await app.service.tag('paper', PAPER, tag.id)
    const renamed = await app.service.renameTag(tag.id, 'Anaesthesia')
    expect(renamed.id).toBe(tag.id)
    expect((await app.service.listTags(PROJECT)).map(item => item.name)).toEqual(['Anaesthesia'])

    await app.service.deleteTag(tag.id)
    expect(await app.service.listTags(PROJECT)).toEqual([])
    // The tagged paper is untouched.
    expect(app.storage.papers.get(PAPER)).toBeDefined()
  })

  it('rejects a duplicate tag name case-insensitively within one project', async () => {
    const app = await boot()
    await app.service.createTag(PROJECT, 'anesthesia')
    await expect(app.service.createTag(PROJECT, 'Anesthesia')).rejects.toMatchObject({ code: 'TAG_EXISTS' })
  })

  it('fails loudly for an unknown project', async () => {
    const app = await boot()
    await expect(app.service.listTags(c.projectIdSchema.parse('missing'))).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })
})
