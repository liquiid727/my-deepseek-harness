/**
 * Paper service (SPEC §31). Owns parsed documents, their section/paragraph
 * structure, and content search. Paragraph `text` is always the normalized
 * text, so every stored offset is relative to a stable base (SPEC §10, §22.3).
 * @module @medresearch/dsh-plugin-paper/src/service
 */

import { createHash } from 'node:crypto'
import type {
  DocumentId,
  Annotation,
  AnnotationId,
  AnnotationCreateInput,
  Note,
  NoteCreateInput,
  NoteId,
  DocumentSourceType,
  EvidenceChunk,
  EvidenceChunkId,
  FulltextResolution,
  MedFulltextService,
  MedPapersService,
  Paper,
  PaperDocument,
  PaperId,
  PaperParagraph,
  PaperSection,
  ParagraphId,
  ProjectId,
  SourceAnchor,
  PaperSummary,
  PaperSummaryField,
  PaperSummaryFieldKey,
  TranslationCheck,
} from '@medresearch/dsh-medical-contracts'
import { annotationIdSchema, noteIdSchema, PAPER_SUMMARY_FIELD_KEYS } from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { ParsedDocument } from './document.ts'
import { parseJats } from './jats.ts'
import { assemblePdfDocument, type PdfExtraction } from './pdf.ts'

/**
 * The literal a summary field carries when the source does not report it. The
 * spec fixes this marker, so it is a spec constant rather than a tunable
 * default: an unreported field must be visibly unreported, never inferred.
 */
const UNREPORTED_FIELD_VALUE = '未报告'

/** Construction dependencies of {@link PapersService}. */
export interface PapersServiceOptions {
  storage: MedStorage
  /** Full-text resolution capability; the papers service delegates to it. */
  fulltext: MedFulltextService
  /** Fetch one machine-readable full-text URL; injected so tests stay offline. */
  fetchText: (url: string) => Promise<string>
  /** Extract page text from a PDF file reference; injected adapter. */
  extractPdf: (fileRef: string) => Promise<PdfExtraction>
  /** Cap on paragraphs returned by {@link PapersService.search}. */
  maxSearchResults: number
  /** Current time as an ISO string. */
  now: () => string
  newPaperId: () => PaperId
  newDocumentId: () => DocumentId
  newSectionId: () => SectionId
  newParagraphId: () => ParagraphId
  newEvidenceChunkId: () => EvidenceChunkId
  newNoteId?: () => NoteId
  newAnnotationId?: () => AnnotationId
}

type SectionId = PaperSection['id']

/** Paper reading, parsing, and content-search capabilities. */
export class PapersService implements MedPapersService {
  /** Typert Gateway binding: the Web client reaches these methods as `medPapers/*` (SPEC §30). */
  readonly typertRemote = bindTypertRemote(this, 'medPapers')

  private readonly options: PapersServiceOptions
  /** Audit trail for uploaded papers (SPEC §49). */
  private readonly audit: AuditWriter

  /**
   * @param options - Storage, full-text resolver, fetch/PDF adapters, identity.
   */
  constructor(options: PapersServiceOptions) {
    this.options = options
    this.audit = createAuditWriter({ storage: options.storage, now: options.now })
  }

  /**
   * Read one stored paper.
   * @param id - Paper id.
   * @returns the paper, or `undefined`.
   */
  @Remote
  async get(id: PaperId): Promise<Paper | undefined> {
    return this.options.storage.papers.get(id)
  }

  /**
   * List a paper's parsed documents. When none exist yet and the paper carries
   * an abstract, the abstract is parsed into an `ABSTRACT_ONLY` document.
   * @param id - Paper id.
   * @returns documents in creation order.
   */
  @Remote
  async document(id: PaperId): Promise<PaperDocument[]> {
    const existing = this.documentsOf(id)
    if (existing.length > 0) return existing
    const paper = this.options.storage.papers.get(id)
    if (paper?.abstract === undefined || paper.abstract.trim() === '') return []
    const document = await this.store(id, 'abstract', {
      status: 'ABSTRACT_ONLY',
      sections: [{ title: 'Abstract', type: 'abstract', paragraphs: [{ text: paper.abstract }] }],
      warnings: [],
    }, paper.abstract)
    return [document]
  }

  /**
   * Parse and persist a JATS document for one paper.
   * @param id - Paper id.
   * @param xml - Raw JATS XML.
   * @param access - Optional license and access URL recorded with the document.
   * @returns the stored document.
   * @throws Error when the paper does not exist.
   */
  async ingestJats(id: PaperId, xml: string, access?: { license?: string; accessUrl?: string }): Promise<PaperDocument> {
    const paper = this.options.storage.papers.get(id)
    if (paper === undefined) throw new Error(`no paper ${id}`)
    const parsed = parseJats(xml)
    const document = await this.store(id, 'pmc_xml', parsed, xml, access)
    const updated: Paper = { ...paper, fulltextStatus: parsed.status === 'FAILED' ? paper.fulltextStatus : 'available', updatedAt: this.options.now() }
    await this.options.storage.papers.put(updated.id, updated)
    return document
  }

  /**
   * Sections of one document, ordered.
   * @param id - Document id.
   * @returns sections in document order.
   */
  @Remote
  async sections(id: DocumentId): Promise<PaperSection[]> {
    return [...this.options.storage.sections.entries()]
      .map(([, section]) => section)
      .filter(section => section.documentId === id)
      .sort((left, right) => left.order - right.order)
  }

  /**
   * Every paragraph of one document, in reading order. Sections order the
   * paragraphs: a paragraph's own `order` restarts inside its section, so
   * sorting on it alone would interleave the sections.
   * @param id - Document id.
   * @returns paragraphs in section order, then paragraph order.
   */
  @Remote
  async paragraphs(id: DocumentId): Promise<PaperParagraph[]> {
    const sectionOrder = new Map<string, number>()
    for (const [, section] of this.options.storage.sections.entries()) {
      if (section.documentId === id) sectionOrder.set(section.id, section.order)
    }
    return [...this.options.storage.paragraphs.entries()]
      .map(([, paragraph]) => paragraph)
      .filter(paragraph => sectionOrder.has(paragraph.sectionId))
      .sort((left, right) =>
        (sectionOrder.get(left.sectionId) ?? 0) - (sectionOrder.get(right.sectionId) ?? 0)
        || left.order - right.order)
  }

  /**
   * Read one paragraph.
   * @param paragraphId - Paragraph id.
   * @returns the paragraph, or `undefined`.
   */
  @Remote
  async paragraph(paragraphId: ParagraphId): Promise<PaperParagraph | undefined> {
    return this.options.storage.paragraphs.get(paragraphId)
  }

  /**
   * Resolve a paper's full text, and parse it when the resolution is
   * machine-readable and a URL is available.
   * @param id - Paper id.
   * @returns the resolution; parsing failures are recorded on the document.
   * @throws Error when the paper does not exist.
   */
  @Remote
  async resolveFulltext(id: PaperId): Promise<FulltextResolution> {
    const paper = this.options.storage.papers.get(id)
    if (paper === undefined) throw new Error(`no paper ${id}`)
    const resolution = await this.options.fulltext.resolve(paper)
    if (resolution.status === 'available' && resolution.machineReadable === true && resolution.url !== undefined) {
      const body = await this.options.fetchText(resolution.url)
      await this.ingestJats(id, body, {
        ...resolution.license === undefined ? {} : { license: resolution.license },
        accessUrl: resolution.url,
      })
    }
    return resolution
  }

  /**
   * Persist a user-uploaded PDF as a new paper and parse its extracted pages.
   * @param projectId - Project the upload belongs to.
   * @param fileRef - Extractor file reference (absolute path).
   * @returns the created paper.
   */
  @Remote
  async upload(projectId: ProjectId, fileRef: string): Promise<Paper> {
    const extraction = await this.options.extractPdf(fileRef)
    const parsed = assemblePdfDocument(extraction)
    const timestamp = this.options.now()
    const name = fileRef.split(/[\\/]/u).pop() ?? fileRef
    const paper: Paper = {
      id: this.options.newPaperId(),
      title: name.replace(/\.pdf$/iu, ''),
      authors: [],
      publicationTypes: [],
      meshTerms: [],
      keywords: [],
      source: 'upload',
      fulltextStatus: 'user_upload',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.options.storage.papers.put(paper.id, paper)
    await this.store(paper.id, 'uploaded_pdf', parsed, JSON.stringify(extraction))
    await this.audit.append({
      action: 'paper.upload',
      projectId,
      detail: {
        paperId: paper.id,
        filename: name,
        paragraphs: parsed.sections.reduce((total, section) => total + section.paragraphs.length, 0),
      },
    })
    return paper
  }

  /**
   * Search one paper's parsed paragraphs by case-insensitive substring.
   * @param id - Paper id.
   * @param query - Search text.
   * @returns matching paragraphs in document order.
   */
  @Remote
  async search(id: PaperId, query: string): Promise<PaperParagraph[]> {
    const needle = query.trim().toLowerCase()
    if (needle === '') return []
    const documentIds = new Set(this.documentsOf(id).map(document => document.id))
    return [...this.options.storage.paragraphs.entries()]
      .map(([, paragraph]) => paragraph)
      .filter(paragraph => paragraph.text.toLowerCase().includes(needle))
      .filter((paragraph) => {
        const section = this.options.storage.sections.get(paragraph.sectionId)
        return section !== undefined && documentIds.has(section.documentId)
      })
      .sort((left, right) => left.order - right.order)
      .slice(0, this.options.maxSearchResults)
  }

  /**
   * Build a source-faithful summary from stored paragraphs. Missing sections
   * are reported explicitly instead of being filled with model knowledge.
   * @param input - Paper, optional document/section scope, and summary mode.
   * @returns ordered source paragraphs grouped for the requested mode.
   */
  @Remote
  async summary(input: { projectId: ProjectId; paperId: PaperId; documentId?: DocumentId; scope?: 'whole' | 'section'; mode: 'oneSentence' | 'threeMinute' | 'structured' }): Promise<PaperSummary> {
    const documents = this.documentsOf(input.paperId)
    const document = input.documentId === undefined ? documents[0] : documents.find(item => item.id === input.documentId)
    if (document === undefined) throw new Error(`no parsed document for paper ${input.paperId}`)
    const sections = (await this.sections(document.id)).map(section => {
      const paragraphs = [...this.options.storage.paragraphs.entries()]
        .map(([, paragraph]) => paragraph)
        .filter(paragraph => paragraph.sectionId === section.id)
        .sort((left, right) => left.order - right.order)
      return {
        title: section.title,
        text: paragraphs.map(paragraph => paragraph.text).join(' '),
        paragraphIds: paragraphs.map(paragraph => paragraph.id),
        paragraphs,
      }
    }).filter(section => input.scope !== 'section' || section.title.toLowerCase() === 'abstract')

    // Each field is filled from the section that reports it, and every value
    // keeps the paragraph it came from. A field the document does not report is
    // emitted as the placeholder with `reported: false`; it is never inferred.
    const fieldSources = this.summaryFieldSections(sections)
    const buildField = (key: PaperSummaryFieldKey, titleKey: string): PaperSummaryField => {
      const source = fieldSources.get(key)
      if (source === undefined || source.text.trim() === '') {
        return { key, titleKey, value: UNREPORTED_FIELD_VALUE, reported: false }
      }
      const paragraph = source.paragraphs[0]
      return {
        key,
        titleKey,
        value: source.text,
        reported: true,
        ...paragraph === undefined ? {} : {
          anchor: {
            projectId: input.projectId,
            paperId: input.paperId,
            documentId: document.id,
            paragraphId: paragraph.id,
            startOffset: 0,
            endOffset: paragraph.text.length,
          },
        },
      }
    }

    const keys = input.mode === 'structured'
      ? [...PAPER_SUMMARY_FIELD_KEYS]
      : input.mode === 'threeMinute'
        ? ['researchQuestion', 'studyDesign', 'population', 'keyResults', 'limitations', 'projectRelevance'] as PaperSummaryFieldKey[]
        : ['researchQuestion'] as PaperSummaryFieldKey[]
    const fields = keys.map(key => buildField(key, `summary.field.${key}`))
    const selected = input.mode === 'oneSentence'
      ? [{ title: 'Summary', text: sections.flatMap(section => section.text.split(/(?<=[.!?。！？])\s+/u)).find(Boolean) ?? UNREPORTED_FIELD_VALUE, paragraphIds: sections[0]?.paragraphIds ?? [] }]
      : sections.map(({ title, text, paragraphIds }) => ({ title, text, paragraphIds }))
    return {
      paperId: input.paperId,
      documentId: document.id,
      mode: input.mode,
      sections: selected,
      fields,
      missingFields: fields.filter(field => !field.reported).map(field => field.key),
    }
  }

  /**
   * Map each structured summary field to the section that reports it.
   *
   * Matching is a documented, deterministic title test: a field is reported
   * only when the document has a section whose title names it. This keeps the
   * summary honest — an unrecognized layout produces `未报告` rather than a
   * guess — and it is the seam a model-backed extractor replaces later without
   * changing the contract.
   */
  private summaryFieldSections(
    sections: ReadonlyArray<{ title: string; text: string; paragraphIds: ParagraphId[]; paragraphs: PaperParagraph[] }>,
  ): Map<PaperSummaryFieldKey, { text: string; paragraphs: PaperParagraph[] }> {
    const patterns: Record<PaperSummaryFieldKey, readonly string[]> = {
      researchQuestion: ['research question', 'objective', 'aim', 'background', 'purpose'],
      studyDesign: ['study design', 'design', 'methods', 'method'],
      population: ['population', 'participants', 'patients', 'cohort', 'setting'],
      sampleSize: ['sample size', 'participants', 'population'],
      interventionExposure: ['intervention', 'exposure', 'treatment'],
      comparator: ['comparator', 'comparison', 'control'],
      outcome: ['outcome', 'endpoint', 'results'],
      methods: ['methods', 'materials', 'procedure'],
      statistics: ['statistical', 'analysis', 'statistics'],
      keyResults: ['results', 'findings'],
      effectSize: ['results', 'findings', 'outcome'],
      conclusion: ['conclusion', 'interpretation'],
      limitations: ['limitation', 'weakness'],
      bias: ['bias', 'risk of bias'],
      projectRelevance: [],
      references: ['reference', 'bibliography'],
    }
    const found = new Map<PaperSummaryFieldKey, { text: string; paragraphs: PaperParagraph[] }>()
    for (const [key, titles] of Object.entries(patterns) as Array<[PaperSummaryFieldKey, readonly string[]]>) {
      const section = sections.find(candidate => titles.some(title => candidate.title.toLowerCase().includes(title)))
        // The abstract is the fallback the spec names for research-question and
        // key-result style fields when the document has no dedicated section.
        ?? (key === 'researchQuestion' || key === 'keyResults' ? sections.find(candidate => candidate.title.toLowerCase() === 'abstract') : undefined)
      if (section !== undefined) found.set(key, { text: section.text, paragraphs: section.paragraphs })
    }
    return found
  }

  /** Validate a translation's numeric and citation tokens without mutating source text. */
  @Remote
  async translate(input: { documentId: DocumentId; paragraphIds?: ParagraphId[]; translatedText: string; targetLanguage: 'zh' | 'en' }): Promise<TranslationCheck> {
    const document = this.options.storage.documents.get(input.documentId)
    if (document === undefined) throw new Error(`no document ${input.documentId}`)
    const paragraphs = [...this.options.storage.paragraphs.entries()]
      .map(([, paragraph]) => paragraph)
      .filter(paragraph => this.options.storage.sections.get(paragraph.sectionId)?.documentId === input.documentId)
      .filter(paragraph => input.paragraphIds === undefined || input.paragraphIds.includes(paragraph.id))
      .sort((left, right) => left.order - right.order)
    const originalText = paragraphs.map(paragraph => paragraph.text).join('\n')
    const tokens = (value: string) => value.match(/\d+(?:\.\d+)?%?|\[[0-9, -]+\]|\([^)]*\d[^)]*\)/gu) ?? []
    const originalTokens = tokens(originalText)
    const translatedTokens = tokens(input.translatedText)
    const mismatches = originalTokens.length !== translatedTokens.length
      ? [`numeric/citation token count ${originalTokens.length} != ${translatedTokens.length}`]
      : originalTokens.filter((token, index) => token !== translatedTokens[index]).map((token, index) => `token ${index + 1} changed from ${token} to ${translatedTokens[index] ?? 'missing'}`)
    return { originalText, translatedText: input.translatedText, targetLanguage: input.targetLanguage, status: mismatches.length === 0 ? 'VALID' : 'TRANSLATION_MISMATCH', mismatches }
  }

  /** Create a note, retaining the source anchor as independent data. */
  @Remote
  async createNote(input: NoteCreateInput): Promise<Note> {
    if (this.options.storage.projects.get(input.projectId) === undefined) throw new Error(`no project ${input.projectId}`)
    if (input.paperId !== undefined && this.options.storage.papers.get(input.paperId) === undefined) throw new Error(`no paper ${input.paperId}`)
    const now = this.options.now()
    const note: Note = { id: this.options.newNoteId?.() ?? noteIdSchema.parse(`note-${now}`), projectId: input.projectId, ...input.paperId === undefined ? {} : { paperId: input.paperId }, scope: input.scope, title: input.title.trim(), content: input.content, ...input.anchor === undefined ? {} : { anchor: input.anchor }, version: 1, createdAt: now, updatedAt: now }
    await this.options.storage.notes.put(note.id, note)
    return note
  }

  /** Update editable note fields using optimistic versioning. */
  @Remote
  async updateNote(id: NoteId, patch: { title?: string; content?: string }, expectedVersion?: number): Promise<Note> {
    const current = this.options.storage.notes.get(id)
    if (current === undefined || current.deletedAt !== undefined) throw new Error(`note ${id} not found`)
    if (expectedVersion !== undefined && expectedVersion !== current.version) throw new Error(`note ${id} version conflict`)
    const updated: Note = { ...current, ...patch.title === undefined ? {} : { title: patch.title.trim() }, ...patch.content === undefined ? {} : { content: patch.content }, version: current.version + 1, updatedAt: this.options.now() }
    await this.options.storage.notes.put(id, updated)
    return updated
  }

  /** Soft-delete a note so historical references remain resolvable. */
  @Remote
  async deleteNote(id: NoteId): Promise<void> {
    const current = this.options.storage.notes.get(id)
    if (current === undefined) throw new Error(`note ${id} not found`)
    await this.options.storage.notes.put(id, { ...current, deletedAt: this.options.now(), updatedAt: this.options.now(), version: current.version + 1 })
  }

  /** Read one live note. */
  @Remote
  async getNote(id: NoteId): Promise<Note | undefined> {
    const note = this.options.storage.notes.get(id)
    return note?.deletedAt === undefined ? note : undefined
  }

  /** List live notes in project scope. */
  @Remote
  async listNotes(input: { projectId: ProjectId; paperId?: PaperId }): Promise<Note[]> {
    return [...this.options.storage.notes.entries()].map(([, note]) => note).filter(note => note.projectId === input.projectId && note.deletedAt === undefined && (input.paperId === undefined || note.paperId === input.paperId)).sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
  }

  /** Create a reader highlight after checking its paragraph and offsets. */
  @Remote
  async createAnnotation(input: AnnotationCreateInput): Promise<Annotation> {
    const paragraph = this.options.storage.paragraphs.get(input.paragraphId)
    const section = paragraph === undefined ? undefined : this.options.storage.sections.get(paragraph.sectionId)
    if (paragraph === undefined || section?.documentId !== input.documentId || this.options.storage.documents.get(input.documentId)?.paperId !== input.paperId) throw new Error('annotation source is not a paragraph in the selected paper')
    if (input.startOffset >= input.endOffset || input.endOffset > paragraph.text.length) throw new Error('annotation offsets are outside the normalized paragraph')
    const annotation: Annotation = { id: this.options.newAnnotationId?.() ?? annotationIdSchema.parse(`annotation-${this.options.now()}`), ...input, createdAt: this.options.now() }
    await this.options.storage.annotations.put(annotation.id, annotation)
    return annotation
  }

  /** Delete one highlight. */
  @Remote
  async deleteAnnotation(id: AnnotationId): Promise<void> { await this.options.storage.annotations.delete(id) }

  /** List highlights for one project paper. */
  @Remote
  async listAnnotations(projectId: ProjectId, paperId: PaperId): Promise<Annotation[]> {
    return [...this.options.storage.annotations.entries()].map(([, annotation]) => annotation).filter(annotation => annotation.projectId === projectId && annotation.paperId === paperId)
  }

  /** Resolve an anchor and verify its requested range still fits the paragraph. */
  @Remote
  async focus(anchor: SourceAnchor): Promise<{ status: 'FOUND' | 'STALE_ANCHOR'; paragraph?: PaperParagraph }> {
    if (anchor.paragraphId === undefined) return { status: 'STALE_ANCHOR' }
    const paragraph = this.options.storage.paragraphs.get(anchor.paragraphId)
    const valid = paragraph !== undefined && this.options.storage.sections.get(paragraph.sectionId)?.documentId === anchor.documentId && (anchor.startOffset === undefined || anchor.endOffset === undefined || anchor.endOffset <= paragraph.text.length)
    return valid ? { status: 'FOUND', paragraph } : { status: 'STALE_ANCHOR' }
  }

  /** Documents already stored for one paper. */
  private documentsOf(id: PaperId): PaperDocument[] {
    return [...this.options.storage.documents.entries()]
      .map(([, document]) => document)
      .filter(document => document.paperId === id)
  }

  /** Persist one parsed document with its sections and paragraphs. */
  private async store(
    paperId: PaperId,
    sourceType: DocumentSourceType,
    parsed: ParsedDocument,
    raw: string,
    access?: { license?: string; accessUrl?: string },
  ): Promise<PaperDocument> {
    const timestamp = this.options.now()
    const document: PaperDocument = {
      id: this.options.newDocumentId(),
      paperId,
      sourceType,
      contentHash: createHash('sha256').update(raw).digest('hex'),
      parseStatus: parsed.status,
      ...access?.license === undefined ? {} : { license: access.license },
      ...access?.accessUrl === undefined ? {} : { accessUrl: access.accessUrl },
      createdAt: timestamp,
    }
    await this.options.storage.documents.put(document.id, document)

    let sectionOrder = 0
    let paragraphOrder = 0
    for (const section of parsed.sections) {
      const record: PaperSection = {
        id: this.options.newSectionId(),
        documentId: document.id,
        title: section.title,
        type: section.type,
        order: sectionOrder,
      }
      sectionOrder += 1
      await this.options.storage.sections.put(record.id, record)
      const paragraphIds: ParagraphId[] = []
      const texts: string[] = []
      for (const paragraph of section.paragraphs) {
        const stored: PaperParagraph = {
          id: this.options.newParagraphId(),
          sectionId: record.id,
          order: paragraphOrder,
          text: paragraph.text,
          rawText: paragraph.text,
          ...paragraph.page === undefined ? {} : { page: paragraph.page },
        }
        paragraphOrder += 1
        await this.options.storage.paragraphs.put(stored.id, stored)
        paragraphIds.push(stored.id)
        texts.push(stored.text)
      }
      if (paragraphIds.length > 0) {
        const chunk: EvidenceChunk = {
          id: this.options.newEvidenceChunkId(),
          paperId,
          documentId: document.id,
          sectionType: record.type,
          sectionTitle: record.title,
          paragraphIds,
          text: texts.join('\n'),
        }
        await this.options.storage.chunks.put(chunk.id, chunk)
      }
    }
    return document
  }
}
