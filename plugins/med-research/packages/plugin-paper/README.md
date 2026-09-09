# @medresearch/dsh-plugin-paper

English | [中文](README.zh.md)

## Summary

Paper reading and document parsing. Provides `ctx.medPapers` and registers `paper_get` / `paper_get_document` / `paper_resolve_fulltext` / `paper_search_content`. Parses JATS/PMC XML into sections and paragraphs, parses an abstract into an `ABSTRACT_ONLY` document on demand, and persists every paragraph with its normalized text as the offset base (SPEC §10, §22.3).

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `maxSearchResults` | `50` | Cap on paragraphs returned by `paper_search_content` |

## Model Experience

- `paper_get_document` returns documents with `parseStatus` `READY` / `PARTIAL` / `FAILED` / `ABSTRACT_ONLY`.
- `paper_search_content` returns matching paragraphs with ids, so an evidence span can reference a real paragraph.
- `paper_resolve_fulltext` returns the resolution; `status: unavailable` is a real outcome, not an error.

## Known Limitations and Deferred Work

- PDF text extraction uses `pdfjs-dist`; a page that fails to render marks the document `PARTIAL` instead of dropping text silently.
- `paper_search_content` is a linear substring scan, not FTS (SPEC §23 index is deferred).
- Only JATS/PMC XML and abstracts are parsed; tables, figures, and reference lists are not extracted.
