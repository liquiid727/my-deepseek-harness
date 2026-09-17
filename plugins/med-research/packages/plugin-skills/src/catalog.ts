/**
 * The thirteen required built-in skill definitions (SPEC-R001-S07, builtin-skills.md).
 *
 * Every entry is a real catalog definition — not a name-only card: it carries a
 * unique `definition id`, semantic version, `publisher` set to the built-in
 * catalog, an input/output JSON Schema (2020-12), examples that validate
 * against those schemas, triggers, a knowledge file list, a model preference
 * that must resolve to a deployed available model, and the declared tool list.
 *
 * These are data, never executable code or raw credentials (SPEC §32,
 * builtin-skills.md). `model` values are resolved against the deployment's
 * available-model allowlist at seed time; a model that does not resolve fails
 * validation loudly instead of being silently substituted.
 * @module @medresearch/dsh-plugin-skills/src/catalog
 */

import type { Skill, SkillDefinition } from '@medresearch/dsh-medical-contracts'
import { skillIdSchema } from '@medresearch/dsh-medical-contracts'

/** Catalog category of one built-in skill, keyed by its `builtin-*` id. */
export const BUILTIN_CATEGORY: Readonly<Record<string, string>> = {
  'builtin-pubmed-deep-search': 'literature',
  'builtin-medical-translator': 'translation',
  'builtin-paper-summarizer': 'summarization',
  'builtin-evidence-extractor': 'evidence',
  'builtin-ponv-evidence-reviewer': 'evidence',
  'builtin-critical-appraisal': 'appraisal',
  'builtin-logistic-regression': 'statistics',
  'builtin-survival-analysis': 'statistics',
  'builtin-meta-analysis': 'statistics',
  'builtin-literature-review-writer': 'writing',
  'builtin-academic-translator': 'writing',
  'builtin-thoracic-paper-extractor': 'extraction',
  'builtin-clinical-guideline-reader': 'guideline',
}

/** Status enum every built-in ships as. */
const PUBLISHED = 'PUBLISHED' as const
const UPDATED_AT = '2026-09-13T00:00:00.000Z'

/** Build one built-in skill record from its definition fields. */
function builtin(slug: string, definition: SkillDefinition): Skill {
  return {
    id: skillIdSchema.parse(`builtin-${slug}`),
    source: 'builtin',
    publisher: 'builtin-catalog',
    currentVersion: definition.semanticVersion,
    currentRevision: 1,
    definition,
    status: PUBLISHED,
    updatedAt: UPDATED_AT,
  }
}

const pubmedDeepSearch: SkillDefinition = {
  name: 'PubMed Deep Search',
  description: 'Plan and execute confirmed PubMed retrieval for a research question.',
  semanticVersion: '1.0.0',
  instructions: 'Given the active project and a research question, build editable PICO/PECO, keyword and MeSH terms, then a primary and a broad query. After explicit user confirmation, return a real paper list with a rank reason. Never fabricate sources when retrieval is partial or insufficient.',
  triggers: ['explicit'],
  tools: ['literature_plan_query', 'literature_search_pubmed'],
  model: 'deepseek-chat',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { researchQuestion: { type: 'string', minLength: 1 }, projectId: { type: 'string' } },
    required: ['researchQuestion'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'partial', 'insufficient'] },
      queries: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: ['primary', 'broad'] }, query: { type: 'string' } }, required: ['kind', 'query'] } },
      papers: { type: 'array', items: { type: 'object' } },
      reason: { type: 'string' },
    },
    required: ['status'],
  },
  examples: [
    {
      input: { researchQuestion: 'Risk factors for postoperative nausea and vomiting' },
      output: { status: 'ok', queries: [{ kind: 'primary', query: 'PONV risk factors' }], papers: [], reason: 'Confirmed primary query executed.' },
    },
  ],
}

const medicalTranslator: SkillDefinition = {
  name: 'Medical Translator',
  description: 'Translate source passages while preserving numbers, units, and citation tokens.',
  semanticVersion: '1.0.0',
  instructions: 'Translate the selected anchors or an explicit document to the target language. Keep terminology in context, preserve numbers, units, and reference tokens. Report per-segment errors when the source is missing or alignment fails rather than guessing.',
  triggers: ['explicit'],
  tools: ['paper_translate'],
  model: 'deepseek-chat',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string', minLength: 1 }, targetLanguage: { type: 'string', enum: ['zh', 'en'] } },
    required: ['text', 'targetLanguage'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      segments: { type: 'array', items: { type: 'object', properties: { source: { type: 'string' }, target: { type: 'string' } }, required: ['source', 'target'] } },
    },
    required: ['status'],
  },
  examples: [
    { input: { text: 'The patient received ondansetron 4 mg.', targetLanguage: 'zh' }, output: { status: 'ok', segments: [{ source: 'The patient received ondansetron 4 mg.', target: '患者接受了昂丹司琼 4 mg。' }] } },
  ],
}

const paperSummarizer: SkillDefinition = {
  name: 'Paper Summarizer',
  description: 'Summarize a parsed paper with missing-field markers and source anchors.',
  semanticVersion: '1.0.0',
  instructions: 'Summarize the given paper or document version, whole text or a section range, in the requested mode. Mark every unknown field as not reported, attach a source anchor to each factual claim, and keep limitations and project relevance traceable.',
  triggers: ['explicit'],
  tools: ['paper_summary'],
  model: 'deepseek-chat',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { paperId: { type: 'string', minLength: 1 }, mode: { type: 'string', enum: ['oneSentence', 'threeMinute', 'structured'] } },
    required: ['paperId', 'mode'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      summary: { type: 'string' },
      missingFields: { type: 'array', items: { type: 'string' } },
    },
    required: ['status'],
  },
  examples: [
    { input: { paperId: 'paper-1', mode: 'threeMinute' }, output: { status: 'ok', summary: 'A randomized trial of PONV prophylaxis.', missingFields: [] } },
  ],
}

const evidenceExtractor: SkillDefinition = {
  name: 'Evidence Extractor',
  description: 'Extract candidate quotes that are re-located before verification.',
  semanticVersion: '1.0.0',
  instructions: 'Given a claim or question and paper ids, propose candidate quotes with anchors, source type, and provenance. After a locator/verifier pass, output the three relation classes. Unverified candidates must never become supported conclusions.',
  triggers: ['explicit'],
  tools: ['evidence_retrieve', 'evidence_save'],
  model: 'deepseek-reasoner',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { claimText: { type: 'string', minLength: 1 }, paperIds: { type: 'array', items: { type: 'string' } } },
    required: ['claimText'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      candidates: { type: 'array', items: { type: 'object', properties: { relation: { type: 'string', enum: ['SUPPORT', 'AGAINST', 'UNCERTAIN'] } }, required: ['relation'] } },
    },
    required: ['status'],
  },
  examples: [
    { input: { claimText: 'Ondansetron reduces PONV.', paperIds: ['paper-1'] }, output: { status: 'ok', candidates: [{ relation: 'SUPPORT' }] } },
  ],
}

const ponvEvidenceReviewer: SkillDefinition = {
  name: 'PONV Evidence Reviewer',
  description: 'Review PONV evidence with risk, effect, quality, and limitations fields.',
  semanticVersion: '1.0.0',
  instructions: 'For a PONV proposition and the selected papers/evidence, report PICO, study design, risk factors/outcomes, effect values with confidence intervals, support/against/insufficient, quality limitations, and citations. Do not infer missing fields.',
  triggers: ['explicit'],
  tools: ['evidence_retrieve', 'evidence_save', 'evidence_verify'],
  model: 'deepseek-reasoner',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { proposition: { type: 'string', minLength: 1 } },
    required: ['proposition'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      pico: { type: 'object' },
      effect: { type: 'object', properties: { estimate: { type: 'number' }, ciLow: { type: 'number' }, ciHigh: { type: 'number' } } },
    },
    required: ['status'],
  },
  examples: [
    { input: { proposition: 'Dexamethasone reduces PONV incidence.' }, output: { status: 'ok', pico: {}, effect: { estimate: 0.6, ciLow: 0.5, ciHigh: 0.7 } } },
  ],
}

const criticalAppraisal: SkillDefinition = {
  name: 'Critical Appraisal',
  description: 'Return structured appraisal fields with paragraph anchors.',
  semanticVersion: '1.0.0',
  instructions: 'For the current paper and study design, judge methodological quality per domain (randomization, confounding, selection, measurement, missing, reporting bias) as low/high/unclear/not-applicable, with the original-text reason, applicability, and evidence limits. Never label an unreported domain as low risk.',
  triggers: ['explicit'],
  tools: ['paper_summary', 'evidence_retrieve'],
  model: 'deepseek-reasoner',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { paperId: { type: 'string', minLength: 1 }, studyDesign: { type: 'string' } },
    required: ['paperId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      domains: { type: 'array', items: { type: 'object', properties: { domain: { type: 'string' }, judgment: { type: 'string', enum: ['low', 'high', 'unclear', 'not-applicable'] } }, required: ['domain', 'judgment'] } },
    },
    required: ['status'],
  },
  examples: [
    { input: { paperId: 'paper-1', studyDesign: 'RCT' }, output: { status: 'ok', domains: [{ domain: 'randomization', judgment: 'low' }] } },
  ],
}

const logisticRegression: SkillDefinition = {
  name: 'Logistic Regression',
  description: 'Plan a binary-outcome logistic regression from an approved dataset.',
  semanticVersion: '1.0.0',
  instructions: 'From a dataset profile and a binary outcome with exposure/covariates, plan event encoding, reference level, missing handling, the model formula and assumptions, and code. After approval, report coefficients/OR/CI/p, sample size, convergence diagnostics, and Forest/ROC. Warn or fail on non-binary outcomes or complete separation; never report a fake estimate.',
  triggers: ['explicit'],
  tools: ['dataset_profile', 'statistics_plan', 'statistics_execute'],
  model: 'deepseek-coder',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { datasetId: { type: 'string', minLength: 1 }, outcome: { type: 'string', minLength: 1 } },
    required: ['datasetId', 'outcome'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient', 'failed'] },
      coefficients: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, oddsRatio: { type: 'number' }, ciLow: { type: 'number' }, ciHigh: { type: 'number' }, p: { type: 'number' } }, required: ['term', 'oddsRatio'] } },
    },
    required: ['status'],
  },
  examples: [
    { input: { datasetId: 'ds-1', outcome: 'ponv' }, output: { status: 'ok', coefficients: [{ term: 'dexamethasone', oddsRatio: 0.6, ciLow: 0.5, ciHigh: 0.7, p: 0.01 }] } },
  ],
}

const survivalAnalysis: SkillDefinition = {
  name: 'Survival Analysis',
  description: 'Plan Kaplan-Meier, log-rank, or Cox analysis with declared assumptions.',
  semanticVersion: '1.0.0',
  instructions: 'From a dataset profile with time/event and groups/covariates, declare the time unit and event encoding, run KM/log-rank, and with covariates a Cox HR/CI/p with assumption diagnostics. Reject negative time or mis-coded events; never report an estimable effect when all subjects are censored.',
  triggers: ['explicit'],
  tools: ['dataset_profile', 'statistics_plan', 'statistics_execute'],
  model: 'deepseek-coder',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { datasetId: { type: 'string', minLength: 1 }, timeColumn: { type: 'string' }, eventColumn: { type: 'string' } },
    required: ['datasetId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient', 'failed'] },
      hr: { type: 'number' },
      ciLow: { type: 'number' },
      ciHigh: { type: 'number' },
      p: { type: 'number' },
    },
    required: ['status'],
  },
  examples: [
    { input: { datasetId: 'ds-1', timeColumn: 'days', eventColumn: 'death' }, output: { status: 'ok', hr: 1.2, ciLow: 1.0, ciHigh: 1.4, p: 0.04 } },
  ],
}

const metaAnalysis: SkillDefinition = {
  name: 'Meta Analysis',
  description: 'Plan inverse-variance meta-analysis without mixing effect scales.',
  semanticVersion: '1.0.0',
  instructions: 'From a user-curated dataset of study id, effect scale, estimate and SE or CI, run fixed- and random-effects inverse-variance pooling, heterogeneity Q/I²/tau², a forest plot, and include/exclude reasons. Request correction when scales are inconsistent or variance is unavailable; refuse to pool with fewer than two studies.',
  triggers: ['explicit'],
  tools: ['dataset_profile', 'statistics_plan', 'statistics_execute'],
  model: 'deepseek-coder',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { datasetId: { type: 'string', minLength: 1 } },
    required: ['datasetId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient', 'failed'] },
      pooledEffect: { type: 'number' },
      i2: { type: 'number' },
      studies: { type: 'integer' },
    },
    required: ['status'],
  },
  examples: [
    { input: { datasetId: 'ds-1' }, output: { status: 'ok', pooledEffect: 0.7, i2: 30, studies: 5 } },
  ],
}

const literatureReviewWriter: SkillDefinition = {
  name: 'Literature Review Writer',
  description: 'Draft an evidence-backed literature review from verified evidence.',
  semanticVersion: '1.0.0',
  instructions: 'From selected verified claims/evidence and a target section/language, produce a cited review structure and body, with conflicts and limitations. Show an insufficiency fragment when qualified evidence is missing; re-verify after editing.',
  triggers: ['explicit'],
  tools: ['knowledge_create_draft', 'writing_generate', 'writing_validate'],
  model: 'deepseek-chat',
  knowledge: ['verified_evidence'],
  inputSchema: {
    type: 'object',
    properties: { evidenceIds: { type: 'array', items: { type: 'string' } }, section: { type: 'string' }, language: { type: 'string', enum: ['zh', 'en'] } },
    required: ['evidenceIds'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      draftId: { type: 'string' },
      citations: { type: 'integer' },
    },
    required: ['status'],
  },
  examples: [
    { input: { evidenceIds: ['ev-1', 'ev-2'], section: 'Discussion', language: 'en' }, output: { status: 'ok', draftId: 'draft-1', citations: 2 } },
  ],
}

const academicTranslator: SkillDefinition = {
  name: 'Academic Translator',
  description: 'Translate academic text with deterministic integrity checks.',
  semanticVersion: '1.0.0',
  instructions: 'Translate a draft revision or user text between zh/en, preserving title/paragraph/table structure, numeric and statistical symbols, and citation identity. Keep the old version and flag alignment errors instead of overwriting silently.',
  triggers: ['explicit'],
  tools: ['writing_translate', 'writing_validate'],
  model: 'deepseek-chat',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string', minLength: 1 }, direction: { type: 'string', enum: ['zhToEn', 'enToZh'] } },
    required: ['text', 'direction'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      translated: { type: 'string' },
      mismatches: { type: 'array', items: { type: 'string' } },
    },
    required: ['status'],
  },
  examples: [
    { input: { text: '术后恶心呕吐发生率', direction: 'zhToEn' }, output: { status: 'ok', translated: 'Postoperative nausea and vomiting incidence', mismatches: [] } },
  ],
}

const thoracicPaperExtractor: SkillDefinition = {
  name: 'Thoracic Paper Extractor',
  description: 'Extract thoracic-study fields and their source anchors.',
  semanticVersion: '1.0.0',
  instructions: 'For a thoracic surgery paper, extract a field table of study design, procedure/disease, inclusion/exclusion, population, sample size, intervention/comparison, perioperative outcomes and follow-up, with effect and limitations. Every value carries an anchor; explicitly mark unreported fields as missing.',
  triggers: ['explicit'],
  tools: ['paper_summary', 'evidence_save'],
  model: 'deepseek-reasoner',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { paperId: { type: 'string', minLength: 1 } },
    required: ['paperId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      fields: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' }, reported: { type: 'boolean' } }, required: ['name', 'reported'] } },
    },
    required: ['status'],
  },
  examples: [
    { input: { paperId: 'paper-1' }, output: { status: 'ok', fields: [{ name: 'sampleSize', value: '120', reported: true }] } },
  ],
}

const clinicalGuidelineReader: SkillDefinition = {
  name: 'Clinical Guideline Reader',
  description: 'Read guideline recommendations with explicit source and evidence grades.',
  semanticVersion: '1.0.0',
  instructions: 'For a user-authorized guideline document and research question, report the publishing body/date/version, applicable population, the recommendation text, the original guideline strength/evidence level, limits, and update statements. When the original grade is absent, write not reported; never invent a grade or individual advice.',
  triggers: ['explicit'],
  tools: ['paper_summary', 'evidence_save'],
  model: 'deepseek-reasoner',
  knowledge: [],
  inputSchema: {
    type: 'object',
    properties: { documentId: { type: 'string', minLength: 1 }, question: { type: 'string' } },
    required: ['documentId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'insufficient'] },
      body: { type: 'string' },
      grade: { type: 'string' },
    },
    required: ['status'],
  },
  examples: [
    { input: { documentId: 'doc-1', question: 'PONV prophylaxis in adults?' }, output: { status: 'ok', body: 'Recommend multimodal prophylaxis.', grade: 'strong' } },
  ],
}

/** Stable catalog entries; they are data, not executable code. */
export const BUILTIN_SKILLS: readonly Skill[] = [
  builtin('pubmed-deep-search', pubmedDeepSearch),
  builtin('medical-translator', medicalTranslator),
  builtin('paper-summarizer', paperSummarizer),
  builtin('evidence-extractor', evidenceExtractor),
  builtin('ponv-evidence-reviewer', ponvEvidenceReviewer),
  builtin('critical-appraisal', criticalAppraisal),
  builtin('logistic-regression', logisticRegression),
  builtin('survival-analysis', survivalAnalysis),
  builtin('meta-analysis', metaAnalysis),
  builtin('literature-review-writer', literatureReviewWriter),
  builtin('academic-translator', academicTranslator),
  builtin('thoracic-paper-extractor', thoracicPaperExtractor),
  builtin('clinical-guideline-reader', clinicalGuidelineReader),
]
