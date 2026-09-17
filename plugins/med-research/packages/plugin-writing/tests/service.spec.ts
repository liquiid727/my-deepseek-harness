import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { Config as SqliteConfig, SqliteStorageBackend } from '@deepseek-ai/dsh-storage-sqlite'
import * as c from '@medresearch/dsh-medical-contracts'
import { openMedStorage, type MedStorage } from '@medresearch/dsh-medical-storage'
import { WritingError, WritingService } from '../src/service.ts'

const NOW = '2026-01-01T00:00:00.000Z'
const PROJECT = c.projectIdSchema.parse('project-1')
const DRAFT = c.draftIdSchema.parse('draft-1')

const booted: Array<{ close(): Promise<void> }> = []
afterEach(async () => { for (const item of booted.splice(0)) await item.close() })

interface App { storage: MedStorage; service: WritingService }
let seq = 0
async function boot(): Promise<App> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new SqliteStorageBackend(new SqliteConfig({ path: ':memory:' }))
  ctx.storage.backend.register('sqlite', backend)
  const facility = new DomainFacility(ctx, { backend: 'sqlite', routes: {} })
  ctx.storage.mount('domain', facility)
  const storage = await openMedStorage(facility)
  booted.push({ async close() { await storage.close(); await facility.closeAll(); await backend.close() } })
  await storage.projects.put(PROJECT, {
    id: PROJECT, name: 'P', keywords: [], workspacePath: '/tmp/p', status: 'active', createdAt: NOW, updatedAt: NOW,
  })
  return { storage, service: new WritingService({ storage, now: () => NOW }) }
}

function paperId(n: number): c.PaperId { return c.paperIdSchema.parse(`paper-${n}`) }
function evidenceId(n: number): c.EvidenceId { return c.evidenceIdSchema.parse(`evidence-${n}`) }

async function putPaper(app: App, id: c.PaperId, overrides: Partial<c.Paper> = {}): Promise<void> {
  await app.storage.papers.put(id, {
    id, title: `Paper ${id}`, authors: [{ name: 'A. Author' }], publicationTypes: [], meshTerms: [], keywords: [],
    source: 'pubmed', fulltextStatus: 'available', createdAt: NOW, updatedAt: NOW,
    ...overrides,
  })
}

async function putEvidence(app: App, id: c.EvidenceId, paper: c.PaperId, overrides: Partial<c.Evidence> = {}): Promise<void> {
  await app.storage.evidences.put(id, {
    id, projectId: PROJECT, paperId: paper, documentId: c.documentIdSchema.parse('doc-1'), sourceType: 'fulltext',
    originalText: `evidence text for ${id}`, normalizedText: `evidence text for ${id}`, offsetBase: 'normalized_paragraph',
    relation: 'SUPPORT', locatorStatus: 'FOUND', supportStatus: 'VERIFIED',
    extractorVersion: 'v1', extractorModel: 'm', promptVersion: 'p1', createdAt: NOW,
    ...overrides,
  })
}

async function putDraft(app: App, overrides: Partial<c.Draft> = {}): Promise<void> {
  await app.storage.drafts.put(DRAFT, {
    id: DRAFT, projectId: PROJECT, title: 'Draft', outline: [], body: '', facts: [], claimIds: [], evidenceIds: [],
    status: 'DRAFT', revision: 1, createdAt: NOW, updatedAt: NOW, ...overrides,
  })
}

describe('S08 generate — evidence-linked editable draft', () => {
  it('carries internal evidence references and a deterministic citation index for supported evidence', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app)
    const result = await app.service.generate({ projectId: PROJECT, draftId: DRAFT, evidenceIds: [evidenceId(1)], outline: ['Summary'], language: 'en' })
    expect(result.facts).toHaveLength(1)
    expect(result.facts[0]!.evidenceIds).toEqual([evidenceId(1)])
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]!.index).toBe(1)
    expect(result.body).toContain('## Summary')
    expect(result.body).toContain(`[1]`)
    expect(result.body).toContain('evidence text for evidence-1')
    expect(result.insufficiencies).toHaveLength(0)
    expect((await app.storage.drafts.get(DRAFT))!.status).toBe('REVIEWABLE')
  })

  it('keeps the positive path while flagging conflicting evidence with explicit qualification (never a definite statement)', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putPaper(app, paperId(2))
    await putEvidence(app, evidenceId(1), paperId(1), { relation: 'SUPPORT', originalText: 'supports the claim' })
    await putEvidence(app, evidenceId(2), paperId(2), { relation: 'AGAINST', originalText: 'opposes the claim' })
    await putDraft(app)
    const result = await app.service.generate({ projectId: PROJECT, draftId: DRAFT, evidenceIds: [evidenceId(1), evidenceId(2)], outline: ['Body'], language: 'en' })
    expect(result.facts).toHaveLength(2)
    expect(result.citations).toHaveLength(2)
    expect(result.insufficiencies.some(reason => reason.includes('conflicting'))).toBe(true)
    expect(result.body).toContain('Counter-evidence (against): opposes the claim')
    expect(result.body).toContain('supports the claim')
    expect((await app.storage.drafts.get(DRAFT))!.status).toBe('REVIEWABLE')
  })

  it('emits an explicit placeholder for unsupported evidence and never asserts it as a finding', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1), { locatorStatus: 'NOT_FOUND', supportStatus: 'REJECTED', originalText: 'unsupported claim' })
    await putDraft(app)
    const result = await app.service.generate({ projectId: PROJECT, draftId: DRAFT, evidenceIds: [evidenceId(1)], outline: ['Summary'], language: 'en' })
    expect(result.facts).toHaveLength(0)
    expect(result.insufficiencies.some(reason => reason.includes('unsupported') && reason.includes('NOT_FOUND'))).toBe(true)
    expect(result.body).toContain('Limitations / unsupported evidence')
    expect(result.body).not.toContain('unsupported claim')
    expect((await app.storage.drafts.get(DRAFT))!.status).toBe('DRAFT')
  })

  it('preserves citation-index stability across revisions for the same body order', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putPaper(app, paperId(2))
    await putEvidence(app, evidenceId(1), paperId(1), { originalText: 'first' })
    await putEvidence(app, evidenceId(2), paperId(2), { originalText: 'second' })
    await putDraft(app)
    const first = await app.service.generate({ projectId: PROJECT, draftId: DRAFT, evidenceIds: [evidenceId(1), evidenceId(2)], outline: ['S'], language: 'en' })
    expect(first.citations.map(entry => entry.paperId)).toEqual([paperId(1), paperId(2)])
    // Same order, new generation (simulating a later revision): indices unchanged.
    const second = await app.service.generate({ projectId: PROJECT, draftId: DRAFT, evidenceIds: [evidenceId(1), evidenceId(2)], outline: ['S'], language: 'en' })
    expect(second.citations.map(entry => entry.index)).toEqual([1, 2])
  })
})

describe('S08 validate — re-verify after user edits', () => {
  it('returns an un-referenced fact to DRAFT and blocks REVIEWABLE', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app, { facts: [{ text: 'kept', evidenceIds: [evidenceId(1)] }], evidenceIds: [evidenceId(1)], status: 'REVIEWABLE' })
    // Simulate the user un-referencing one fact.
    await app.storage.drafts.put(DRAFT, { ...(await app.storage.drafts.get(DRAFT))!, facts: [{ text: 'orphan', evidenceIds: [] }], evidenceIds: [evidenceId(1)] })
    const result = await app.service.validate(DRAFT)
    expect(result.valid).toBe(false)
    expect(result.status).toBe('DRAFT')
    expect(result.reasons.some(reason => reason.includes('ungrounded'))).toBe(true)
    expect((await app.storage.drafts.get(DRAFT))!.status).toBe('DRAFT')
  })

  it('re-enters DRAFT when a source is invalidated (never keeps a hidden old citation)', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app, { facts: [{ text: 'supported', evidenceIds: [evidenceId(1)] }], evidenceIds: [evidenceId(1)], status: 'REVIEWABLE' })
    // Source invalidated after the user's edit kept the reference.
    await app.storage.evidences.put(evidenceId(1), { ...(await app.storage.evidences.get(evidenceId(1)))!, supportStatus: 'REJECTED', locatorStatus: 'NOT_FOUND' })
    await app.storage.drafts.put(DRAFT, { ...(await app.storage.drafts.get(DRAFT))!, status: 'REVIEWABLE' })
    const result = await app.service.validate(DRAFT)
    expect(result.valid).toBe(false)
    expect(result.status).toBe('DRAFT')
    expect((await app.storage.drafts.get(DRAFT))!.status).toBe('DRAFT')
  })

  it('keeps REVIEWABLE on a heading-only edit when every fact is still grounded', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app, { facts: [{ text: 'supported', evidenceIds: [evidenceId(1)] }], evidenceIds: [evidenceId(1)], outline: ['Old'], status: 'REVIEWABLE' })
    await app.storage.drafts.put(DRAFT, { ...(await app.storage.drafts.get(DRAFT))!, outline: ['New Heading'] })
    const result = await app.service.validate(DRAFT)
    expect(result.valid).toBe(true)
    expect(result.status).toBe('REVIEWABLE')
  })
})

describe('S08 translate — deterministic bilingual integrity', () => {
  it('preserves numbers, units, symbols and citation tokens', async () => {
    const app = await boot()
    await putDraft(app)
    const source = 'Dose was 12 mg (95% CI, p ≤ 0.01) [1].'
    const translated = '剂量为 12 mg（95% CI，p ≤ 0.01）[1]。'
    const result = await app.service.translate({ draftId: DRAFT, sourceText: source, translatedText: translated, targetLanguage: 'zh' })
    expect(result.validation.valid).toBe(true)
    expect(result.validation.status).toBe('REVIEWABLE')
    expect(result.validation.reasons).toHaveLength(0)
  })

  it('flags a translation that drops or changes a number/unit/symbol/citation as TRANSLATION_MISMATCH', async () => {
    const app = await boot()
    await putDraft(app)
    const source = 'Dose was 12 mg (95% CI, p ≤ 0.01) [1].'
    const translated = '剂量为 15 mg（95% CI，p 0.01）[2]。'
    const result = await app.service.translate({ draftId: DRAFT, sourceText: source, translatedText: translated, targetLanguage: 'zh' })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.status).toBe('TRANSLATION_MISMATCH')
    expect(result.validation.reasons.some(reason => reason.includes('tokens differ'))).toBe(true)
    // The source draft is never overwritten.
    expect((await app.storage.drafts.get(DRAFT))!.body).toBe('')
  })

  it('does not claim a free-text translation as a verified medical draft', async () => {
    const app = await boot()
    await putDraft(app)
    const result = await app.service.translate({ draftId: DRAFT, sourceText: 'any text', targetLanguage: 'zh' })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.status).toBe('DRAFT')
  })
})

describe('S08 export — deterministic citation files', () => {
  it('emits RIS with TY/AU/TI/JO/PY/DO/UR/ER', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: 'T', authors: [{ name: 'A. One' }, { name: 'B. Two' }], journal: 'J', publicationDate: '2020-01-01', doi: '10.1/x', sourceUrl: 'https://ex.org/p' })
    const result = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'ris', mode: 'complete' })
    expect(result.content).toContain('TY  - JOUR')
    expect(result.content).toContain('AU  - A. One')
    expect(result.content).toContain('TI  - T')
    expect(result.content).toContain('JO  - J')
    expect(result.content).toContain('PY  - 2020')
    expect(result.content).toContain('DO  - 10.1/x')
    expect(result.content).toContain('UR  - https://ex.org/p')
    expect(result.content).toContain('ER  -')
  })

  it('emits a BibTeX article entry with a stable key derived from the Paper id', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: 'T', authors: [{ name: 'A. One' }], journal: 'J', publicationDate: '2020-01-01', doi: '10.1/x', sourceUrl: 'https://ex.org/p' })
    const result = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'bibtex', mode: 'complete' })
    expect(result.content).toContain('@article{paper-paper-1,')
    expect(result.content).toContain('author = {A. One}')
    expect(result.content).toContain('title = {T}')
    expect(result.content).toContain('journal = {J}')
    expect(result.content).toContain('year = {2020}')
    expect(result.content).toContain('doi = {10.1/x}')
  })

  it('emits Markdown with the current citation index, bibliography, and source links', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: 'T', authors: [{ name: 'A. One' }], journal: 'J', publicationDate: '2020-01-01', doi: '10.1/x', sourceUrl: 'https://ex.org/p' })
    const result = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'markdown', mode: 'complete' })
    expect(result.content).toContain('[1] A. One. T.')
    expect(result.content).toContain('source: https://ex.org/p')
  })

  it('returns METADATA_INCOMPLETE when a selected paper has no title', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: '' })
    await expect(app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'ris', mode: 'complete' })).rejects.toMatchObject({ code: 'METADATA_INCOMPLETE' })
  })

  it('omits missing author/year and reports them in warnings', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: 'T', authors: [], journal: 'J' })
    const result = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'bibtex', mode: 'complete' })
    expect(result.warnings.some(w => w.includes('no author'))).toBe(true)
    expect(result.warnings.some(w => w.includes('no year'))).toBe(true)
    expect(result.content).not.toContain('author = {')
    expect(result.content).not.toContain('year = {')
  })

  it('escapes newlines, braces, and Markdown characters', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: 'Title\nwith *star* and {brace}', authors: [{ name: 'A. One' }], journal: 'J', publicationDate: '2020-01-01' })
    const bibtex = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'bibtex', mode: 'complete' })
    expect(bibtex.content).toContain('title = {Title with \\*star\\* and \\{brace\\}}')
    const ris = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'ris', mode: 'complete' })
    expect(ris.content).toContain('TI  - Title with *star* and {brace}')
    const md = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1)], format: 'markdown', mode: 'complete' })
    expect(md.content).toContain('[1]')
    expect(md.content).toContain('Title with \\*star\\* and \\{brace\\}')
  })

  it('dedupes papers in selected order', async () => {
    const app = await boot()
    await putPaper(app, paperId(1), { title: 'One' })
    await putPaper(app, paperId(2), { title: 'Two' })
    const result = await app.service.export({ projectId: PROJECT, paperIds: [paperId(1), paperId(2), paperId(1)], format: 'markdown', mode: 'complete' })
    const indexes = [...result.content.matchAll(/\[(\d+)\]/g)].map(m => m[1])
    expect(indexes).toEqual(['1', '2'])
    expect(result.content).toContain('One')
    expect(result.content).toContain('Two')
  })

  it('returns CITATION_STALE on a complete export of a non-reviewable draft', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app, { facts: [{ text: 'x', evidenceIds: [evidenceId(1)] }], evidenceIds: [evidenceId(1)], status: 'DRAFT' })
    await expect(app.service.export({ projectId: PROJECT, draftId: DRAFT, format: 'ris', mode: 'complete' })).rejects.toMatchObject({ code: 'CITATION_STALE' })
  })

  it('returns CITATION_STALE on complete export when a citation becomes unresolvable', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app, { facts: [{ text: 'x', evidenceIds: [evidenceId(1)] }], evidenceIds: [evidenceId(1)], status: 'REVIEWABLE' })
    await app.storage.evidences.put(evidenceId(1), { ...(await app.storage.evidences.get(evidenceId(1)))!, supportStatus: 'REJECTED' })
    await expect(app.service.export({ projectId: PROJECT, draftId: DRAFT, format: 'ris', mode: 'complete' })).rejects.toMatchObject({ code: 'CITATION_STALE' })
  })

  it('marks a preview export incomplete and keeps its missing reasons', async () => {
    const app = await boot()
    await putPaper(app, paperId(1))
    await putEvidence(app, evidenceId(1), paperId(1))
    await putDraft(app, { facts: [{ text: 'x', evidenceIds: [evidenceId(1)] }], evidenceIds: [evidenceId(1)], status: 'DRAFT' })
    const result = await app.service.export({ projectId: PROJECT, draftId: DRAFT, paperIds: [paperId(1)], format: 'markdown', mode: 'preview' })
    expect(result.content.startsWith('> ⚠ Incomplete preview')).toBe(true)
    expect(result.warnings.some(w => w.includes('not REVIEWABLE'))).toBe(true)
  })
})
