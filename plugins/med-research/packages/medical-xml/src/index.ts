/**
 * Ordered XML element reader shared by the Med Research parsers (PubMed
 * EFetch, JATS full text). `preserveOrder` keeps document order, so inline
 * markup (`<i>`, `<sup>`, `<xref>`) never reorders extracted text; attributes
 * travel with their element instead of being dropped when children are read.
 * @module @medresearch/dsh-medical-xml
 */

import { XMLParser } from 'fast-xml-parser'

/** One node of the ordered XML tree produced by `preserveOrder`. */
export type XmlNode = Record<string, unknown>

/** One element with its tag, ordered children, and attributes. */
export interface XmlElement {
  tag: string
  nodes: XmlNode[]
  attrs: Record<string, unknown>
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: false,
})

/** Elements among `nodes`, in document order. */
export function elementsOf(nodes: XmlNode[]): XmlElement[] {
  const found: XmlElement[] = []
  for (const node of nodes) {
    const raw = node[':@']
    const attrs = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    for (const [key, value] of Object.entries(node)) {
      if (key === ':@' || key === '#text') continue
      if (Array.isArray(value)) found.push({ tag: key, nodes: value as XmlNode[], attrs })
    }
  }
  return found
}

/**
 * Parse a document into its root elements.
 * @param xml - Raw XML text.
 * @returns root elements in document order.
 * @throws Error when the text is not valid XML.
 */
export function parseOrderedXml(xml: string): XmlElement[] {
  return elementsOf(parser.parse(xml) as XmlNode[])
}

/** Direct children of `element`. */
export function childrenOf(element: XmlElement | undefined): XmlElement[] {
  return element === undefined ? [] : elementsOf(element.nodes)
}

/** Direct children of `element` carrying `tag`. */
export function children(element: XmlElement | undefined, tag: string): XmlElement[] {
  return childrenOf(element).filter(candidate => candidate.tag === tag)
}

/** First direct child of `element` carrying `tag`. */
export function child(element: XmlElement | undefined, tag: string): XmlElement | undefined {
  return children(element, tag)[0]
}

/** Attribute value on an element, or `undefined`. */
export function attrOf(element: XmlElement | undefined, name: string): string | undefined {
  const value = element?.attrs[`@_${name}`]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

/** Concatenate every text segment under `element`, preserving document order. */
export function textOf(element: XmlElement | undefined): string {
  if (element === undefined) return ''
  let out = ''
  for (const node of element.nodes) {
    for (const [key, value] of Object.entries(node)) {
      if (key === ':@') continue
      if (key === '#text') {
        if (typeof value === 'string' || typeof value === 'number') out += String(value)
      } else if (Array.isArray(value)) {
        out += textOf({ tag: key, nodes: value as XmlNode[], attrs: {} })
      }
    }
  }
  return out.trim()
}
