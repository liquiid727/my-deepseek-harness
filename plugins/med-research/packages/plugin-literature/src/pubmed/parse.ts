/**
 * PubMed payload parsing (SPEC §19–§20). ESearch JSON yields the PMID page;
 * EFetch XML yields normalized records. The XML parser keeps document order so
 * mixed inline markup (`<i>`, `<sup>`) does not reorder title or abstract text.
 * @module @medresearch/dsh-plugin-literature/src/pubmed/parse
 */

import type { Author, FulltextStatus, Paper } from '@medresearch/dsh-medical-contracts'
import { attrOf, child, children, parseOrderedXml, textOf, type XmlElement } from '@medresearch/dsh-medical-xml'
import { PubmedError } from './errors.ts'

/** A parsed paper before the connector assigns identity and timestamps. */
export type PubmedRecord = Omit<Paper, 'id' | 'createdAt' | 'updatedAt'>

/** One ESearch page (SPEC §19). */
export interface ESearchPage {
  /** Total matches reported by PubMed, not the page length. */
  count: number
  /** PMIDs in this page. */
  ids: string[]
  /** PubMed's own query translation, kept for debugging and audit. */
  queryTranslation?: string
  /** Non-fatal messages PubMed returned (ignored phrases, no-items, …). */
  warnings: string[]
}

const MONTHS: Readonly<Record<string, string>> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** Build an ISO-like date from a PubMed `PubDate` element. */
function publicationDate(pubDate: XmlElement | undefined): string | undefined {
  if (pubDate === undefined) return undefined
  const medline = textOf(child(pubDate, 'MedlineDate'))
  if (medline !== '') return medline
  const year = textOf(child(pubDate, 'Year'))
  if (year === '') return undefined
  const monthRaw = textOf(child(pubDate, 'Month'))
  const day = textOf(child(pubDate, 'Day'))
  const month = MONTHS[monthRaw.toLowerCase()] ?? (monthRaw === '' ? '' : monthRaw.padStart(2, '0'))
  if (month === '') return year
  if (day === '') return `${year}-${month}`
  return `${year}-${month}-${day.padStart(2, '0')}`
}

/** Map one `<Author>` element. */
function author(element: XmlElement): Author {
  const lastName = textOf(child(element, 'LastName'))
  const foreName = textOf(child(element, 'ForeName'))
  const initials = textOf(child(element, 'Initials'))
  const collectiveName = textOf(child(element, 'CollectiveName'))
  const display = collectiveName !== ''
    ? collectiveName
    : [foreName, lastName].filter(part => part !== '').join(' ')
      || [initials, lastName].filter(part => part !== '').join(' ')
  const affiliation = textOf(child(child(element, 'AffiliationInfo'), 'Affiliation'))
  const orcid = children(element, 'Identifier')
    .find(identifier => attrOf(identifier, 'Source') === 'ORCID')
  return {
    name: display === '' ? 'Unknown author' : display,
    ...affiliation === '' ? {} : { affiliation },
    ...orcid === undefined ? {} : { orcid: textOf(orcid) },
  }
}

/**
 * Parse an EFetch XML response into normalized records.
 * @param xml - Raw `PubmedArticleSet` document.
 * @returns one record per `PubmedArticle`, in document order.
 * @throws PubmedError `PUBMED_MALFORMED_RESPONSE` when the document has no root.
 */
export function parseEFetch(xml: string): PubmedRecord[] {
  let document: XmlElement[]
  try {
    document = parseOrderedXml(xml)
  } catch (cause) {
    throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'EFetch response is not valid XML', false, { cause })
  }
  const root = document.find(element => element.tag === 'PubmedArticleSet')
  if (root === undefined) {
    throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'EFetch response has no PubmedArticleSet root', false)
  }

  return children(root, 'PubmedArticle').map((article) => {
    const citation = child(article, 'MedlineCitation')
    const articleNode = child(citation, 'Article')
    const journal = child(articleNode, 'Journal')
    const issue = child(journal, 'JournalIssue')
    const idList = child(child(article, 'PubmedData'), 'ArticleIdList')
    const ids = new Map<string, string>()
    for (const id of children(idList, 'ArticleId')) {
      const type = attrOf(id, 'IdType')
      const value = textOf(id)
      if (type !== undefined && value !== '') ids.set(type, value)
    }
    for (const location of children(articleNode, 'ELocationID')) {
      const value = textOf(location)
      if (attrOf(location, 'EIdType') === 'doi' && !ids.has('doi') && value !== '') ids.set('doi', value)
    }
    const pmid = ids.get('pubmed') ?? textOf(child(citation, 'PMID'))
    if (pmid === '') {
      throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'EFetch article has no PMID', false)
    }

    const abstract = children(child(articleNode, 'Abstract'), 'AbstractText')
      .map((part) => {
        const label = attrOf(part, 'Label')
        const value = textOf(part)
        return label === undefined || value === '' ? value : `${label}: ${value}`
      })
      .filter(part => part !== '')
      .join('\n')
    const authors = children(child(articleNode, 'AuthorList'), 'Author').map(author)
    const publicationTypes = children(child(articleNode, 'PublicationTypeList'), 'PublicationType')
      .map(textOf)
      .filter(value => value !== '')
    const meshTerms = children(child(citation, 'MeshHeadingList'), 'MeshHeading')
      .map(heading => textOf(child(heading, 'DescriptorName')))
      .filter(value => value !== '')
    const keywords = children(citation, 'KeywordList')
      .flatMap(list => children(list, 'Keyword').map(textOf))
      .filter(value => value !== '')
    const date = publicationDate(child(issue, 'PubDate'))
    const doi = ids.get('doi')
    const pmcid = ids.get('pmcid')
    const journalTitle = textOf(child(journal, 'Title'))

    return {
      pmid,
      ...pmcid === undefined ? {} : { pmcid },
      ...doi === undefined ? {} : { doi },
      title: textOf(child(articleNode, 'ArticleTitle')),
      ...abstract === '' ? {} : { abstract },
      authors,
      ...journalTitle === '' ? {} : { journal: journalTitle },
      ...date === undefined ? {} : { publicationDate: date },
      publicationTypes,
      meshTerms,
      keywords,
      source: 'pubmed',
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      fulltextStatus: (abstract === '' ? 'unavailable' : 'abstract_only') satisfies FulltextStatus,
    } satisfies PubmedRecord
  })
}

/**
 * Parse an ESearch JSON response.
 * @param json - Raw ESearch body.
 * @returns the page, its total count, and PubMed's warnings.
 * @throws PubmedError on a malformed body, an API error, or a rate-limit notice.
 */
export function parseESearch(json: string): ESearchPage {
  let body: unknown
  try {
    body = JSON.parse(json)
  } catch (cause) {
    throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'ESearch response is not JSON', false, { cause })
  }
  if (typeof body !== 'object' || body === null) {
    throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'ESearch response is not an object', false)
  }
  const envelope = body as Record<string, unknown>
  const error = envelope.error
  if (typeof error === 'string' && error !== '') {
    if (/rate limit/iu.test(error)) {
      throw new PubmedError('PUBMED_RATE_LIMIT', error, true)
    }
    throw new PubmedError('PUBMED_HTTP_ERROR', error, false)
  }
  const result = envelope.esearchresult
  if (typeof result !== 'object' || result === null) {
    throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'ESearch response has no esearchresult', false)
  }
  const fields = result as Record<string, unknown>
  const count = Number(fields.count)
  if (!Number.isFinite(count) || count < 0) {
    throw new PubmedError('PUBMED_MALFORMED_RESPONSE', 'ESearch count is not a number', false)
  }
  const ids = Array.isArray(fields.idlist) ? fields.idlist.map(id => String(id)) : []
  const warnings: string[] = []
  const warningList = fields.warninglist
  if (typeof warningList === 'object' && warningList !== null) {
    for (const value of Object.values(warningList as Record<string, unknown>)) {
      if (Array.isArray(value)) warnings.push(...value.map(item => String(item)))
    }
  }
  const translation = fields.querytranslation
  return {
    count,
    ids,
    ...typeof translation === 'string' && translation !== '' ? { queryTranslation: translation } : {},
    warnings,
  }
}
