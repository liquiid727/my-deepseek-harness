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
  'paper_get', 'paper_get_document', 'paper_resolve_fulltext', 'paper_search_content', 'paper_summary', 'paper_translate', 'paper_note_create', 'paper_note_list',
  'evidence_retrieve', 'evidence_verify', 'evidence_save', 'evidence_list_for_claim', 'evidence_claim_gate', 'evidence_citation_map', 'evidence_compare', 'evidence_withdraw', 'evidence_chase',
  'dataset_profile', 'dataset_get_schema', 'dataset_preview', 'dataset_list',
  'statistics_plan', 'statistics_generate_code', 'statistics_execute', 'statistics_approve_code', 'statistics_list_runs',
  'knowledge_list_papers', 'knowledge_search', 'knowledge_create_tag', 'knowledge_create_draft', 'knowledge_get_draft', 'knowledge_rag', 'knowledge_draft_invalidate',
  'skill_catalog', 'skill_get', 'skill_test', 'skill_install',
  'writing_generate', 'writing_validate', 'writing_translate', 'writing_export',
  'artifact_get', 'artifact_export',
] as const
