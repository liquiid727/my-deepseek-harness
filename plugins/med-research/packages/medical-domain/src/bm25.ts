/**
 * Okapi BM25 ranking over retrieval units (SPEC §24). V1 ranks chunks by
 * keyword overlap; vectors are P1. `k1` and `b` are the standard Okapi values
 * (external algorithm specification, not a deployment tunable).
 * @module @medresearch/dsh-medical-domain/src/bm25
 */

/** Okapi term-frequency saturation. */
const K1 = 1.2
/** Okapi length normalization. */
const B = 0.75

/** One retrievable unit. */
export interface Bm25Document {
  id: string
  text: string
}

/** One ranked unit. */
export interface Bm25Hit {
  id: string
  score: number
}

/** Tokenize text for scoring: lowercase alphanumeric runs of length >= 2. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/u).filter(token => token.length >= 2)
}

/**
 * Rank documents against a query.
 * @param query - Claim text plus concept terms.
 * @param documents - Candidate units, already scoped to the project.
 * @param limit - Maximum hits to return.
 * @returns hits with positive scores, highest first; ties keep input order.
 */
export function bm25Rank(query: string, documents: readonly Bm25Document[], limit: number): Bm25Hit[] {
  const terms = [...new Set(tokenize(query))]
  if (terms.length === 0 || documents.length === 0 || limit <= 0) return []
  const tokenized = documents.map(document => tokenize(document.text))
  const averageLength = tokenized.reduce((total, tokens) => total + tokens.length, 0) / tokenized.length
  const documentFrequency = new Map<string, number>()
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
  }

  const hits: Bm25Hit[] = []
  tokenized.forEach((tokens, index) => {
    const frequencies = new Map<string, number>()
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1)
    let score = 0
    for (const term of terms) {
      const frequency = frequencies.get(term)
      if (frequency === undefined) continue
      const frequencyInDocuments = documentFrequency.get(term) ?? 0
      const idf = Math.log(1 + (documents.length - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5))
      const denominator = frequency + K1 * (1 - B + (B * tokens.length) / (averageLength === 0 ? 1 : averageLength))
      score += idf * ((frequency * (K1 + 1)) / denominator)
    }
    if (score > 0) hits.push({ id: documents[index]!.id, score })
  })
  return hits
    .map((hit, index) => ({ hit, index }))
    .sort((left, right) => right.hit.score - left.hit.score || left.index - right.index)
    .slice(0, limit)
    .map(entry => entry.hit)
}
