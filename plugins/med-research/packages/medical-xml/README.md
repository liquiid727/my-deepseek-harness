# @medresearch/dsh-medical-xml

English | [中文](README.zh.md)

## Summary

Ordered XML element reader shared by the Med Research document parsers (PubMed EFetch, JATS full text). `preserveOrder` keeps document order, so inline markup never reorders extracted text, and attributes travel with their element instead of being dropped when children are read.

## Scope

`parseOrderedXml`, `elementsOf`, `childrenOf`, `children`, `child`, `attrOf`, `textOf`, and the `XmlElement` type. No domain knowledge, no IO.

## Model Experience

Nothing; this package is a parser utility and registers no model surface.

## Known Limitations and Deferred Work

- Mixed-content order is preserved, but the reader returns a plain element tree: there is no namespace resolution and no DTD/entity expansion beyond what `fast-xml-parser` performs.
- Repeated elements are returned as a list; callers decide how to flatten them.
