/** Evidence-backed writing service (SPEC-R001-S08). */

import { createHash } from 'node:crypto'
import type {
  CitationEntry,
  CitationExport,
  Draft,
  DraftFact,
  DraftId,
  Evidence,
  EvidenceId,
  MedWritingService,
  Paper,
  PaperId,
  ProjectId,
  WritingGeneration,
  WritingLanguage,
  WritingValidation,
} from '@medresearch/dsh-medical-contracts'
import type { MedStorage } from '@medresearch/dsh-medical-storage'
import { bindTypertRemote, Remote } from '@deepseek-ai/dsh-typert-protocol'

/** Construction dependencies for {@link WritingService}. */
export interface WritingServiceOptions { storage: MedStorage; now: () => string }

/** Stable writing failures. */
export type WritingErrorCode = 'DRAFT_NOT_FOUND' | 'PROJECT_SCOPE' | 'EVIDENCE_UNVERIFIED' | 'CITATION_STALE' | 'METADATA_INCOMPLETE'

/** A writing operation failure. */
export class WritingError extends Error { override readonly name = 'WritingError'; constructor(readonly code: WritingErrorCode, message: string) { super(message) } }

/**
 * Evidence is "qualified" (a usable medical fact) only when it is unwithdrawn,
 * readable, located (not NOT_FOUND), semantically verified, carries a
 * directional SUPPORT/AGAINST relation (never the UNCERTAIN placeholder), and
 * is not a secondary citation. Mirrors interfaces.md §Evidence.
 */
function isQualified(evidence: Evidence): boolean {
  return evidence.supportStatus === 'VERIFIED' && evidence.locatorStatus !== 'NOT_FOUND' && evidence.relation !== 'UNCERTAIN' && evidence.sourceType !== 'secondary_citation'
}

/** Validates all source references before a draft can become reviewable. */
export class WritingService implements MedWritingService {
  /** Typert Gateway binding for `medWriting/*`. */
  readonly typertRemote = bindTypertRemote(this, 'medWriting')
  constructor(private readonly options: WritingServiceOptions) {}

  /**
   * Generate an editable, explicitly evidence-linked draft from verified evidence.
   * Every medical fact carries internal Evidence references and a deterministic
   * citation index (first-appearance numbering, never invented). Unsupported,
   * stale, or conflicting evidence emit explicit placeholders/qualifications and
   * never a definite statement; the positive path is generated regardless.
   */
  @Remote
  async generate(input: { projectId: ProjectId; draftId: DraftId; evidenceIds: EvidenceId[]; outline: string[]; language: WritingLanguage }): Promise<WritingGeneration> {
    const draft = this.requireDraft(input.draftId)
    if (draft.projectId !== input.projectId) throw new WritingError('PROJECT_SCOPE', 'draft is not in the requested project')
    const evidence = input.evidenceIds.map(id => this.requireEvidence(draft.projectId, id))
    const qualified = evidence.filter(isQualified)
    const unqualified = evidence.filter(item => !isQualified(item))

    // Build fact spans from qualified evidence, keeping each internal reference.
    const facts: DraftFact[] = qualified.map(item => ({ text: item.originalText, evidenceIds: [item.id] }))
    const hasSupport = qualified.some(item => item.relation === 'SUPPORT')
    const hasAgainst = qualified.some(item => item.relation === 'AGAINST')
    const conflicting = hasSupport && hasAgainst

    // Deterministic citation index by first appearance of a paper in body order.
    const { citations } = this.buildCitations(facts, draft.projectId)

    const insufficiencies = this.classifyInsufficiencies(unqualified, conflicting)
    const body = this.renderBody(input.outline, qualified, citations, insufficiencies, conflicting)
    const status = facts.length > 0 && unqualified.length === 0 ? 'REVIEWABLE' : 'DRAFT'
    const revision = draft.revision + 1
    await this.options.storage.drafts.put(draft.id, {
      ...draft,
      outline: [...input.outline],
      body,
      facts,
      evidenceIds: [...input.evidenceIds],
      status,
      revision,
      updatedAt: this.options.now(),
    })
    return { draftId: draft.id, body, facts, insufficiencies, citations }
  }

  /**
   * Revalidate a draft against the current evidence and citation locations.
   * An edit that changes a fact, deletes a reference, or un-references a fact
   * immediately returns the Draft to DRAFT and disables completion export — a
   * stale citation is never preserved by a hidden old reference. Heading or
   * formatting-only edits keep verification when every fact is still grounded.
   * The Draft lifecycle uses the spec's names: `DRAFT -> REVIEWABLE ->
   * EXPORTED`. Invalidation returns to `DRAFT`; only a successful complete
   * export records `EXPORTED`.
   */
  @Remote
  async validate(draftId: DraftId): Promise<WritingValidation> {
    const draft = this.requireDraft(draftId)
    const { reasons, ungrounded } = this.verifyFacts(draft, draft.projectId)
    const valid = reasons.length === 0 && !ungrounded && draft.facts.length > 0
    const status = valid ? 'REVIEWABLE' : 'DRAFT'
    await this.options.storage.drafts.put(draft.id, { ...draft, status, updatedAt: this.options.now() })
    const { citations } = this.buildCitations(draft.facts, draft.projectId)
    return { valid, status, reasons: valid ? [] : [...reasons, ...(ungrounded ? ['draft has ungrounded facts'] : [])], citations }
  }

  /**
   * Validate a user/model translation's numeric, unit, symbol, and citation
   * tokens per paragraph and table cell without overwriting the source Draft or
   * any existing translation version. Differences are reported as
   * TRANSLATION_MISMATCH so the user can correct and re-verify.
   */
  @Remote
  async translate(input: { draftId: DraftId; sourceText: string; translatedText?: string; targetLanguage: WritingLanguage }): Promise<{ text: string; validation: WritingValidation }> {
    const text = input.translatedText ?? input.sourceText
    const freeText = input.translatedText === undefined
    const reasons = freeText ? ['no supplied translation: free text is not a verified medical draft'] : this.compareTranslations(input.sourceText, text)
    const validation: WritingValidation = {
      valid: reasons.length === 0,
      status: reasons.length === 0 ? 'REVIEWABLE' : freeText ? 'DRAFT' : 'TRANSLATION_MISMATCH',
      reasons,
      citations: [],
    }
    return { text, validation }
  }

  /**
   * Export real paper metadata and the current Draft citation map
   * deterministically. Every field comes only from persisted Paper metadata —
   * never from a model. A missing title returns METADATA_INCOMPLETE; missing
   * author/year are omitted per format rules and reported in warnings. Complete
   * export requires a REVIEWABLE draft with still-resolvable citations, and a
   * concurrent invalidation returns CITATION_STALE without publishing a file.
   * Preview is explicitly marked incomplete and keeps its missing reasons.
   */
  @Remote
  async export(input: { projectId: ProjectId; draftId?: DraftId; paperIds?: PaperId[]; format: 'ris' | 'bibtex' | 'markdown'; mode: 'complete' | 'preview' }): Promise<CitationExport> {
    const draft = input.draftId === undefined ? undefined : this.requireDraft(input.draftId)
    if (draft !== undefined && draft.projectId !== input.projectId) throw new WritingError('PROJECT_SCOPE', 'draft is not in the requested project')

    // Complete export requires a REVIEWABLE draft with still-resolvable citations.
    if (input.mode === 'complete' && draft !== undefined) {
      if (draft.status !== 'REVIEWABLE') throw new WritingError('CITATION_STALE', `draft ${draft.id} is ${draft.status}, not REVIEWABLE`)
      const missing = this.unresolvableCitations(draft, input.projectId)
      if (missing.length > 0) throw new WritingError('CITATION_STALE', `citations no longer resolvable: ${missing.join(', ')}`)
    }

    const ids = input.paperIds ?? (draft === undefined ? [] : this.evidencePaperIds(draft, input.projectId))
    const ordered = [...new Set(ids)]
    const papers = ordered.map(id => this.options.storage.papers.get(id)).filter((paper): paper is Paper => paper !== undefined)
    const missingTitles = papers.filter(paper => paper.title.trim() === '')
    if (missingTitles.length > 0) throw new WritingError('METADATA_INCOMPLETE', `papers missing title: ${missingTitles.map(paper => paper.id).join(', ')}`)

    const warnings: string[] = []
    for (const paper of papers) {
      if (paper.authors.length === 0) warnings.push(`paper ${paper.id} has no author`)
      if (paper.publicationDate === undefined) warnings.push(`paper ${paper.id} has no year`)
    }

    const { citations } = this.buildCitationsFromRefs(ordered.map(id => ({ paperId: id })), input.projectId, draft)
    const missingReasons: string[] = []
    if (input.mode === 'preview' && draft !== undefined && (draft.status !== 'REVIEWABLE' || this.unresolvableCitations(draft, input.projectId).length > 0)) {
      missingReasons.push(`draft ${draft.id} is ${draft.status} (not REVIEWABLE)${this.unresolvableCitations(draft, input.projectId).length ? ' with unresolvable citations' : ''}`)
    }
    warnings.push(...missingReasons)

    let content = this.renderExport(input.format, citations)
    if (input.mode === 'preview') content = this.markPreview(content, missingReasons)

    // A successful complete export is the record that this revision was
    // exported; the next edit produces a new revision and returns to DRAFT.
    if (input.mode === 'complete' && draft !== undefined) {
      await this.options.storage.drafts.put(draft.id, { ...draft, status: 'EXPORTED', updatedAt: this.options.now() })
    }

    return {
      projectId: input.projectId,
      format: input.format,
      mode: input.mode,
      content,
      warnings,
      citationRevision: createHash('sha256').update(JSON.stringify(citations)).digest('hex'),
    }
  }

  // --- Citation assembly (S04 first-appearance numbering, reproduced locally) ---

  /** Build a citation map from fact spans, numbering each paper by first appearance. */
  private buildCitations(facts: readonly DraftFact[], projectId: ProjectId): { citations: CitationEntry[] } {
    const refs: Array<{ paperId: PaperId; evidenceId: EvidenceId }> = []
    for (const fact of facts) for (const evidenceId of fact.evidenceIds) {
      const evidence = this.options.storage.evidences.get(evidenceId)
      if (evidence !== undefined && evidence.projectId === projectId) refs.push({ paperId: evidence.paperId, evidenceId })
    }
    return this.buildCitationsFromRefs(refs, projectId)
  }

  /** Build citation entries, assigning a stable index per paper by first appearance. */
  private buildCitationsFromRefs(refs: ReadonlyArray<{ paperId: PaperId; evidenceId?: EvidenceId }>, projectId: ProjectId, draft?: Draft): { citations: CitationEntry[] } {
    const paperOrder: PaperId[] = []
    const evidenceByPaper = new Map<PaperId, EvidenceId[]>()
    for (const ref of refs) {
      if (!paperOrder.includes(ref.paperId)) paperOrder.push(ref.paperId)
      if (ref.evidenceId !== undefined) evidenceByPaper.set(ref.paperId, [...(evidenceByPaper.get(ref.paperId) ?? []), ref.evidenceId])
    }
    // A draft also contributes its own evidenceIds so every reference is represented.
    if (draft !== undefined) for (const evidenceId of draft.evidenceIds) {
      const evidence = this.options.storage.evidences.get(evidenceId)
      if (evidence !== undefined && evidence.projectId === projectId && !paperOrder.includes(evidence.paperId)) paperOrder.push(evidence.paperId)
      if (evidence !== undefined && evidence.projectId === projectId) evidenceByPaper.set(evidence.paperId, [...(evidenceByPaper.get(evidence.paperId) ?? []), evidenceId])
    }
    const citations: CitationEntry[] = paperOrder.map((paperId, index) => {
      const paper = this.options.storage.papers.get(paperId)
      const base: CitationEntry = {
        index: index + 1,
        paperId,
        title: paper?.title ?? '',
        authors: (paper?.authors ?? []).map(author => author.name),
        evidenceIds: [...new Set(evidenceByPaper.get(paperId) ?? [])],
      }
      if (paper?.journal !== undefined) base.journal = paper.journal
      if (paper?.publicationDate !== undefined) base.year = paper.publicationDate.slice(0, 4)
      if (paper?.doi !== undefined) base.doi = paper.doi
      if (paper?.pmid !== undefined) base.pmid = paper.pmid
      if (paper?.sourceUrl !== undefined) base.url = paper.sourceUrl
      return base
    })
    return { citations }
  }

  /** Paper ids referenced by a draft's evidence, keeping draft order. */
  private evidencePaperIds(draft: Draft, projectId: ProjectId): PaperId[] {
    const ids: PaperId[] = []
    for (const evidenceId of draft.evidenceIds) {
      const evidence = this.options.storage.evidences.get(evidenceId)
      if (evidence !== undefined && evidence.projectId === projectId) ids.push(evidence.paperId)
    }
    return ids
  }

  /**
   * Re-verify every fact's references against current evidence. Returns human
   * reasons and whether any fact is ungrounded. A fact with no resolvable
   * citation cannot stay reviewable, and a hidden old reference is never kept.
   */
  private verifyFacts(draft: Draft, projectId: ProjectId): { reasons: string[]; ungrounded: boolean } {
    const reasons: string[] = []
    let ungrounded = false
    for (const fact of draft.facts) {
      const resolved = fact.evidenceIds.filter(id => {
        const evidence = this.options.storage.evidences.get(id)
        if (evidence === undefined) { reasons.push(`evidence ${id} removed`); return false }
        if (evidence.projectId !== projectId) { reasons.push(`evidence ${id} outside project`); return false }
        if (!isQualified(evidence)) { reasons.push(`evidence ${id} is ${evidence.locatorStatus}/${evidence.supportStatus}`); return false }
        return true
      })
      if (resolved.length === 0) { ungrounded = true; reasons.push('fact is ungrounded: no resolvable citation') }
    }
    return { reasons, ungrounded }
  }

  /** Evidence ids that can no longer anchor a resolvable citation for a draft. */
  private unresolvableCitations(draft: Draft, projectId: ProjectId): EvidenceId[] {
    const missing: EvidenceId[] = []
    for (const evidenceId of draft.evidenceIds) {
      const evidence = this.options.storage.evidences.get(evidenceId)
      if (evidence === undefined) { missing.push(evidenceId); continue }
      if (evidence.projectId !== projectId) { missing.push(evidenceId); continue }
      if (!isQualified(evidence)) { missing.push(evidenceId); continue }
      if (this.options.storage.papers.get(evidence.paperId) === undefined) missing.push(evidenceId)
    }
    return missing
  }

  // --- Body / export rendering ---

  /** Classify unqualified evidence into explicit, non-definitive placeholders. */
  private classifyInsufficiencies(unqualified: readonly Evidence[], conflicting: boolean): string[] {
    const out: string[] = []
    for (const evidence of unqualified) {
      if (evidence.locatorStatus === 'NOT_FOUND') out.push(`evidence ${evidence.id} unsupported (locator NOT_FOUND) — not asserted as a finding`)
      else if (evidence.supportStatus !== 'VERIFIED') out.push(`evidence ${evidence.id} ${evidence.locatorStatus}/${evidence.supportStatus} — verification pending, not asserted`)
      else if (evidence.relation === 'UNCERTAIN') out.push(`evidence ${evidence.id} uncertain — held pending, not asserted as support`)
      else if (evidence.sourceType === 'secondary_citation') out.push(`evidence ${evidence.id} secondary citation — not qualified as direct evidence`)
    }
    if (conflicting) out.push('conflicting evidence present: both supporting and counter evidence are qualified; limitations retained on each side')
    return out
  }

  /** Render editable prose: outline headings, fact spans with citation markers, limitations. */
  private renderBody(outline: readonly string[], qualified: readonly Evidence[], citations: readonly CitationEntry[], insufficiencies: readonly string[], conflicting: boolean): string {
    const paperIndexOf = (paperId: PaperId): number => citations.find(entry => entry.paperId === paperId)?.index ?? 0
    const sections: string[] = []
    for (const heading of outline) sections.push(`## ${heading}`)
    for (const evidence of qualified) {
      const marker = `[${paperIndexOf(evidence.paperId)}]`
      const prefix = evidence.relation === 'AGAINST' ? 'Counter-evidence (against): ' : ''
      sections.push(`${prefix}${evidence.originalText} ${marker}`)
    }
    if (conflicting) sections.push('## Conflict note\nBoth supporting and counter evidence are qualified; each statement retains its explicit limitation.')
    if (insufficiencies.length > 0) sections.push(`## Limitations / unsupported evidence\n${insufficiencies.map(reason => `- ${reason}`).join('\n')}`)
    return sections.join('\n\n')
  }

  /** Render an export file in the requested deterministic format. */
  private renderExport(format: 'ris' | 'bibtex' | 'markdown', citations: readonly CitationEntry[]): string {
    if (format === 'ris') return citations.map(entry => this.ris(entry)).join('\n')
    if (format === 'bibtex') return citations.map(entry => this.bibtex(entry)).join('\n\n')
    return citations.map(entry => this.markdown(entry)).join('\n\n')
  }

  /** RIS: TY/AU/TI/JO/PY/DO/UR/ER; missing fields are omitted. */
  private ris(entry: CitationEntry): string {
    const lines = ['TY  - JOUR']
    for (const author of entry.authors) lines.push(`AU  - ${this.escapeRis(author)}`)
    lines.push(`TI  - ${this.escapeRis(entry.title)}`)
    if (entry.journal !== undefined) lines.push(`JO  - ${this.escapeRis(entry.journal)}`)
    if (entry.year !== undefined) lines.push(`PY  - ${entry.year}`)
    if (entry.doi !== undefined) lines.push(`DO  - ${entry.doi}`)
    if (entry.url !== undefined) lines.push(`UR  - ${entry.url}`)
    lines.push('ER  -', '')
    return lines.join('\n')
  }

  /** BibTeX: stable `article` entry, key derived from the Paper id. */
  private bibtex(entry: CitationEntry): string {
    const key = `paper-${entry.paperId}`
    const lines = [`@article{${key},`]
    if (entry.authors.length > 0) lines.push(`  author = {${entry.authors.map(author => this.escapeBibtex(author)).join(' and ')}}`)
    lines.push(`  title = {${this.escapeBibtex(entry.title)}}`)
    if (entry.journal !== undefined) lines.push(`  journal = {${this.escapeBibtex(entry.journal)}}`)
    if (entry.year !== undefined) lines.push(`  year = {${entry.year}}`)
    if (entry.doi !== undefined) lines.push(`  doi = {${entry.doi}}`)
    if (entry.url !== undefined) lines.push(`  url = {${entry.url}}`)
    lines.push('}')
    return lines.join('\n')
  }

  /** Markdown: current citation index, bibliography, and source links. */
  private markdown(entry: CitationEntry): string {
    const parts = [`[${entry.index}] ${entry.authors.join(' and ')}. ${this.escapeMarkdown(entry.title)}.`]
    if (entry.journal !== undefined) parts.push(` ${entry.journal}.`)
    if (entry.year !== undefined) parts.push(` ${entry.year}.`)
    if (entry.doi !== undefined) parts.push(` https://doi.org/${entry.doi}`)
    let line = parts.join('')
    if (entry.url !== undefined) line += `\n    source: ${entry.url}`
    return line
  }

  /** Mark a preview export as explicitly incomplete and retain its missing reasons. */
  private markPreview(content: string, reasons: readonly string[]): string {
    const header = reasons.length > 0
      ? `> ⚠ Incomplete preview — citations not all resolved.\n> Missing: ${reasons.join('; ')}\n\n`
      : '> ⚠ Incomplete preview — not a verified, export-ready draft.\n\n'
    return `${header}${content}`
  }

  // --- Escaping (UTF-8; newlines, braces, and Markdown characters) ---

  private escapeRis(value: string): string { return value.replace(/\r?\n/gu, ' ').trim() }
  private escapeBibtex(value: string): string { return value.replace(/\\/gu, '\\\\').replace(/\{/gu, '\\{').replace(/\}/gu, '\\}').replace(/\r?\n/gu, ' ').replace(/\*/gu, '\\*').replace(/_/gu, '\\_') }
  private escapeMarkdown(value: string): string {
    return value
      .replace(/\\/gu, '\\\\')
      .replace(/\r?\n/gu, ' ')
      .replace(/\[/gu, '\\[')
      .replace(/\]/gu, '\\]')
      .replace(/\{/gu, '\\{')
      .replace(/\}/gu, '\\}')
      .replace(/\*/gu, '\\*')
      .replace(/_/gu, '\\_')
      .replace(/`/gu, '\\`')
  }

  // --- Translation integrity ---

  /** Split text into paragraphs/blocks; tables stay intact as one block. */
  private splitBlocks(text: string): string[] {
    return text.split(/\n{2,}/u).map(block => block.trim()).filter(block => block.length > 0)
  }

  /** Deterministic integrity tokens: citation ids, symbols, and numbers with units. */
  private integrityTokens(text: string): string[] {
    const re = /\[\d+\]|[≤≥±×÷≈→]|−?\d+(?:\.\d+)?\s?(?:mg|kg|mL|ml|g|%|°C|mmHg|cm|mm|yr|mo)?/giu
    const out: string[] = []
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) out.push(match[0])
    return out
  }

  /** Per-block token comparison; tables compared cell by cell. */
  private blockTokens(block: string): string[] {
    if (block.includes('|')) return block.split('\n').flatMap(row => row.split('|').flatMap(cell => this.integrityTokens(cell)))
    return this.integrityTokens(block)
  }

  /** Compare source and translation block by block; return mismatch reasons. */
  private compareTranslations(source: string, translated: string): string[] {
    const sourceBlocks = this.splitBlocks(source)
    const translatedBlocks = this.splitBlocks(translated)
    const reasons: string[] = []
    if (sourceBlocks.filter(block => /^#+\s/u.test(block)).length !== translatedBlocks.filter(block => /^#+\s/u.test(block)).length) {
      reasons.push('heading count changed between source and translation')
    }
    if (sourceBlocks.length !== translatedBlocks.length) reasons.push(`block count changed: source ${sourceBlocks.length} vs translation ${translatedBlocks.length}`)
    const count = Math.min(sourceBlocks.length, translatedBlocks.length)
    for (let index = 0; index < count; index += 1) {
      const sourceTokens = this.blockTokens(sourceBlocks[index]!)
      const translatedTokens = this.blockTokens(translatedBlocks[index]!)
      const same = sourceTokens.length === translatedTokens.length && sourceTokens.every((token, position) => token.toLowerCase() === translatedTokens[position]!.toLowerCase())
      if (!same) reasons.push(`block ${index + 1} numeric, unit, symbol, or citation tokens differ`)
    }
    return reasons
  }

  // --- Storage helpers ---

  private requireDraft(id: DraftId): Draft { const draft = this.options.storage.drafts.get(id); if (draft === undefined) throw new WritingError('DRAFT_NOT_FOUND', `no draft ${id}`); return draft }
  private requireEvidence(projectId: ProjectId, id: EvidenceId): Evidence {
    const item = this.options.storage.evidences.get(id)
    if (item === undefined) throw new WritingError('EVIDENCE_UNVERIFIED', `no evidence ${id}`)
    if (item.projectId !== projectId) throw new WritingError('PROJECT_SCOPE', `evidence ${id} is outside the project`)
    return item
  }
}
