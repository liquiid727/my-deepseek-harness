/**
 * JATS / PMC XML parser (SPEC §22.1). Preserves the section hierarchy and
 * paragraph order, and reports a parse status that the UI must expose:
 * `READY` when the body has paragraphs, `ABSTRACT_ONLY` when only the abstract
 * parsed, `PARTIAL` when structure exists without paragraphs, `FAILED` when
 * the document is not JATS.
 * @module @medresearch/dsh-plugin-paper/src/jats
 */

import { normalizeParagraph } from '@medresearch/dsh-medical-domain'
import { child, children, parseOrderedXml, textOf, type XmlElement } from '@medresearch/dsh-medical-xml'
import type { ParsedDocument, ParsedParagraph, ParsedSection } from './document.ts'
import { inferSectionType } from './sections.ts'

/** Collect direct `<p>` children as paragraphs. */
function paragraphsOf(element: XmlElement): ParsedParagraph[] {
  return children(element, 'p')
    .map(paragraph => normalizeParagraph(textOf(paragraph)))
    .filter(text => text !== '')
    .map(text => ({ text }))
}

/** Flatten `sec` elements in document order, including nested sections. */
function collectSections(element: XmlElement | undefined, into: ParsedSection[]): void {
  for (const section of children(element, 'sec')) {
    const title = textOf(child(section, 'title')) || 'Untitled'
    const paragraphs = paragraphsOf(section)
    if (title !== 'Untitled' || paragraphs.length > 0) {
      into.push({ title, type: inferSectionType(title), paragraphs })
    }
    collectSections(section, into)
  }
}

/**
 * Parse a JATS article.
 * @param xml - Raw JATS document.
 * @returns the parsed sections plus the parse status; invalid XML yields
 * `FAILED` with a warning instead of throwing.
 */
export function parseJats(xml: string): ParsedDocument {
  let roots
  try {
    roots = parseOrderedXml(xml)
  } catch (cause) {
    return { status: 'FAILED', sections: [], warnings: [`invalid XML: ${(cause as Error).message}`] }
  }
  const article = roots.find(element => element.tag === 'article') ?? roots[0]
  if (article === undefined || article.tag !== 'article') {
    return { status: 'FAILED', sections: [], warnings: ['document has no <article> root'] }
  }

  const sections: ParsedSection[] = []
  const abstract = child(child(child(article, 'front'), 'article-meta'), 'abstract')
  if (abstract !== undefined) {
    const paragraphs = paragraphsOf(abstract)
    if (paragraphs.length > 0) {
      sections.push({ title: 'Abstract', type: 'abstract', paragraphs })
    }
  }

  const body = child(article, 'body')
  collectSections(body, sections)

  const bodyParagraphs = sections
    .filter(section => section.type !== 'abstract')
    .reduce((total, section) => total + section.paragraphs.length, 0)
  const abstractParagraphs = sections
    .filter(section => section.type === 'abstract')
    .reduce((total, section) => total + section.paragraphs.length, 0)
  const warnings: string[] = []
  if (body === undefined) warnings.push('no <body> element')
  if (bodyParagraphs === 0 && abstractParagraphs > 0) warnings.push('only the abstract parsed')

  const status = bodyParagraphs > 0
    ? 'READY'
    : abstractParagraphs > 0
      ? 'ABSTRACT_ONLY'
      : sections.length > 0 ? 'PARTIAL' : 'FAILED'
  return { status, sections, warnings }
}
