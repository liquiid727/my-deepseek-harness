/**
 * Paper service (SPEC §31). Owns parsed documents, their section/paragraph
 * structure, and content search. Paragraph `text` is always the normalized
 * text, so every stored offset is relative to a stable base (SPEC §10, §22.3).
 * @module @medresearch/dsh-plugin-paper/src/service
 */

import { createHash } from 'node:crypto'
import type {
  DocumentId,
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
} from '@medresearch/dsh-medical-contracts'
import { createAuditWriter, type AuditWriter, type MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { ParsedDocument } from './document.ts'
import { parseJats } from './jats.ts'
import { assemblePdfDocument, type PdfExtraction } from './pdf.ts'

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
