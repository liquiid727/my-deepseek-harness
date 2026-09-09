/**
 * Tool names the Med Research client contributes a card for (SPEC §6). Kept in
 * a JSX-free module so the host program can cross-check it against the tools
 * the composed plugins actually register.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/tool-names
 */

/** Every model-callable Med Research tool (SPEC §6). */
export const MED_TOOL_NAMES = [
  'project_create', 'project_get', 'project_get_context', 'project_save_paper',
  'literature_plan_query', 'literature_search_pubmed', 'literature_get_paper',
  'paper_get', 'paper_get_document', 'paper_resolve_fulltext', 'paper_search_content',
  'evidence_retrieve', 'evidence_verify', 'evidence_save', 'evidence_list_for_claim',
  'dataset_profile', 'dataset_get_schema',
  'statistics_plan', 'statistics_generate_code', 'statistics_execute',
  'artifact_get', 'artifact_export',
] as const
