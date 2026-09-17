/**
 * Model-facing `evidence_*` tools (SPEC §6, §24–§26). Saving computes the
 * locator status from the paragraph; verification applies the model's semantic
 * verdict under the hard rule, so a quote that cannot be located is never
 * reported as verified.
 * @module @medresearch/dsh-plugin-evidence/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  asToolJson,
  claimIdSchema,
  evidenceIdSchema,
  paperIdSchema,
  paragraphIdSchema,
  projectIdSchema,
  researchQueryIdSchema,
  renderToolEnvelope,
  supportStatusSchema,
  TOOL_ENVELOPE_SCHEMA,
  type DomainError,
  type EvidenceRelation,
} from '@medresearch/dsh-medical-contracts'
import { EvidenceError, type EvidenceService } from './service.ts'

/** Map a service failure to the shared {@link DomainError} shape. */
function toDomainError(error: EvidenceError): DomainError {
  return {
    code: error.code,
    message: error.message,
    retryable: false,
    partialDataAvailable: false,
    source: 'evidence',
  }
}

/**
 * Build the evidence tools bound to one service.
 * @param service - The evidence service implementation.
 * @returns tool definitions ready for `ctx.tools.register`.
 */
export function evidenceTools(service: EvidenceService): ToolDefinition[] {
  return [
    defineTool({
      name: 'evidence_retrieve',
      description:
        'Rank retrieval units (paragraph chunks) for a claim inside a project library. Returns '
        + 'chunk ids and text; propose quotes with evidence_save, which locates them deterministically.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project scope.' },
        claimText: { type: 'string', required: true, description: 'Candidate claim being researched.' },
        conceptTerms: {
          type: 'array',
          required: true,
          items: { type: 'string' },
          description: 'Concept terms and synonyms to match.',
        },
        paperIds: { type: 'array', items: { type: 'string' }, description: 'Restrict to these papers.' },
        maxResults: { type: 'integer', description: 'Maximum units to return.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        const chunks = await service.retrieve({
          projectId: projectIdSchema.parse(args.projectId),
          claimText: args.claimText,
          conceptTerms: args.conceptTerms,
          ...args.paperIds === undefined ? {} : { paperIds: args.paperIds.map(id => paperIdSchema.parse(id)) },
          maxResults: args.maxResults ?? 10,
        })
        return { ok: true, result: asToolJson(chunks) }
      },
    }),
    defineTool({
      name: 'evidence_save',
      description:
        'Save one evidence candidate. The backend locates the quote in the referenced paragraph and '
        + 'records locatorStatus FOUND / PARTIAL / NOT_FOUND; a NOT_FOUND quote is stored REJECTED. '
        + 'Provide the extraction provenance; it is required for reproducibility.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project the evidence belongs to.' },
        paragraphId: { type: 'string', required: true, description: 'Paragraph the quote comes from.' },
        quote: { type: 'string', required: true, description: 'Original sentence, copied verbatim.' },
        relation: {
          type: 'string',
          required: true,
          enum: ['SUPPORT', 'AGAINST', 'UNCERTAIN'],
          description: 'Relation of the quote to the claim.',
        },
        sourceType: {
          type: 'string',
          enum: ['fulltext', 'abstract', 'secondary_citation'],
          description: 'Provenance class; derived from the document when omitted.',
        },
        extractorVersion: { type: 'string', required: true, description: 'Extractor version.' },
        extractorModel: { type: 'string', required: true, description: 'Extractor model id.' },
        promptVersion: { type: 'string', required: true, description: 'Extraction prompt version.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const evidence = await service.save({
            projectId: projectIdSchema.parse(args.projectId),
            candidate: {
              paragraphId: paragraphIdSchema.parse(args.paragraphId),
              quote: args.quote,
              relation: args.relation as EvidenceRelation,
              reason: '',
            },
            provenance: {
              extractorVersion: args.extractorVersion,
              extractorModel: args.extractorModel,
              promptVersion: args.promptVersion,
            },
            ...args.sourceType === undefined ? {} : { sourceType: args.sourceType },
          })
          return { ok: true, result: asToolJson(evidence) }
        } catch (error) {
          if (error instanceof EvidenceError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'evidence_verify',
      description:
        'Apply a semantic verdict to one evidence. The hard rule wins: if the locator status is '
        + 'NOT_FOUND the stored support status becomes REJECTED regardless of the verdict. An '
        + 'UNCERTAIN relation keeps the support status at PENDING. The verdict, reason, and '
        + 'verifier version are recorded for reproducibility.',
      parameters: {
        evidenceId: { type: 'string', required: true, description: 'Evidence to verify.' },
        verdict: {
          type: 'string',
          required: true,
          enum: ['PENDING', 'VERIFIED', 'REJECTED'],
          description: 'Semantic verdict for this evidence.',
        },
        relation: {
          type: 'string',
          enum: ['SUPPORT', 'AGAINST', 'UNCERTAIN'],
          description: 'Re-bind the relation to the claim proposition; UNCERTAIN carries no support.',
        },
        reason: { type: 'string', description: 'Why this verdict was reached.' },
        verificationVersion: { type: 'string', description: 'Verifier version for reproducibility.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const options = {
            ...args.relation === undefined ? {} : { relation: args.relation as EvidenceRelation },
            ...args.reason === undefined ? {} : { reason: args.reason },
            ...args.verificationVersion === undefined ? {} : { verificationVersion: args.verificationVersion },
          }
          const evidence = await service.verify(
            evidenceIdSchema.parse(args.evidenceId),
            supportStatusSchema.parse(args.verdict),
            Object.keys(options).length === 0 ? undefined : options,
          )
          return { ok: true, result: asToolJson(evidence) }
        } catch (error) {
          if (error instanceof EvidenceError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'evidence_withdraw',
      description:
        'Withdraw one evidence. The record stops qualifying immediately, claims that bound it lose '
        + 'their support, and drafts that referenced it return to DRAFT.',
      parameters: {
        evidenceId: { type: 'string', required: true, description: 'Evidence to withdraw.' },
        reason: { type: 'string', description: 'Reason recorded on the record and the audit trail.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const evidence = await service.withdraw(
            evidenceIdSchema.parse(args.evidenceId),
            args.reason,
          )
          return { ok: true, result: asToolJson(evidence) }
        } catch (error) {
          if (error instanceof EvidenceError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'evidence_chase',
      description:
        'Chase a secondary citation to its original paper through the declared reference connector. '
        + 'Every hop is recorded with its source, status, and reason; a successful chase creates a new '
        + 'direct evidence and never modifies the original secondary record.',
      parameters: {
        evidenceId: { type: 'string', required: true, description: 'Secondary evidence being chased.' },
        pmid: { type: 'string', description: 'Reference PMID as printed in the source.' },
        doi: { type: 'string', description: 'Reference DOI as printed in the source.' },
        title: { type: 'string', description: 'Reference title as printed in the source.' },
        maxHops: { type: 'integer', description: 'Override the configured hop cap.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const result = await service.chase({
            evidenceId: evidenceIdSchema.parse(args.evidenceId),
            reference: {
              ...args.pmid === undefined ? {} : { pmid: args.pmid },
              ...args.doi === undefined ? {} : { doi: args.doi },
              ...args.title === undefined ? {} : { title: args.title },
            },
            ...args.maxHops === undefined ? {} : { maxHops: args.maxHops },
          })
          return { ok: true, result: asToolJson(result) }
        } catch (error) {
          if (error instanceof EvidenceError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'evidence_list_for_claim',
      description: 'List every evidence bound to one claim, including its locator and support status.',
      parameters: {
        claimId: { type: 'string', required: true, description: 'Claim to list evidence for.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        try {
          const evidence = await service.listForClaim(claimIdSchema.parse(args.claimId))
          return { ok: true, result: asToolJson(evidence) }
        } catch (error) {
          if (error instanceof EvidenceError) return { ok: false, error: asToolJson(toDomainError(error)) }
          throw error
        }
      },
    }),
    defineTool({
      name: 'evidence_claim_gate',
      description: 'Create and gate a Claim from project-scoped verified supporting and counter Evidence.',
      parameters: {
        projectId: { type: 'string', required: true, description: 'Project scope.' },
        researchQueryId: { type: 'string', required: true, description: 'Approved research query identity.' },
        text: { type: 'string', required: true, description: 'Claim text.' },
        evidenceIds: { type: 'array', required: true, items: { type: 'string' }, description: 'Supporting evidence ids.' },
        counterEvidenceIds: { type: 'array', items: { type: 'string' }, description: 'Counter evidence ids.' },
      },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) {
        return { ok: true, result: asToolJson(await service.gateClaim({ projectId: projectIdSchema.parse(args.projectId), researchQueryId: researchQueryIdSchema.parse(args.researchQueryId), text: args.text, evidenceIds: args.evidenceIds.map(id => evidenceIdSchema.parse(id)), ...args.counterEvidenceIds === undefined ? {} : { counterEvidenceIds: args.counterEvidenceIds.map(id => evidenceIdSchema.parse(id)) } })) }
      },
    }),
    defineTool({
      name: 'evidence_citation_map',
      description: 'Assign deterministic citation indices from a stored Claim to Evidence and source anchors.',
      parameters: { claimId: { type: 'string', required: true, description: 'Claim id.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) { return { ok: true, result: asToolJson(await service.serializeCitations(claimIdSchema.parse(args.claimId))) } },
    }),
    defineTool({
      name: 'evidence_compare',
      description: 'Compare selected project Evidence with persisted paper metadata and support status.',
      parameters: { projectId: { type: 'string', required: true, description: 'Project scope.' }, evidenceIds: { type: 'array', required: true, items: { type: 'string' }, description: 'Evidence ids to compare.' } },
      output: { schema: TOOL_ENVELOPE_SCHEMA, render: renderToolEnvelope },
      async execute(args) { return { ok: true, result: asToolJson(await service.compare(projectIdSchema.parse(args.projectId), args.evidenceIds.map(id => evidenceIdSchema.parse(id)))) } },
    }),
  ]
}
