/** Session-scoped Agent Mode restrictions for the Med Research tools. */

import { agentModeSchema, type AgentMode } from '@medresearch/dsh-medical-contracts'

/** Agent-shaped capability required by the mode controller. */
export interface ModeAgent {
  readonly id: string
  readonly ctx: {
    readonly tools: {
      restrict(filter: { readonly allow: readonly string[] }): () => void
    }
  }
}

/** Live-agent lookup needed to install a scoped tool restriction. */
export interface ModeAgentRegistry {
  get(id: string): ModeAgent | undefined
}

const COMMON_TOOLS = [
  'project_create',
  'project_get',
  'project_get_context',
] as const

/** Actual registered tools allowed in each mode. */
export const MODE_TOOL_ALLOWLIST: Record<AgentMode, readonly string[]> = {
  research: [
    ...COMMON_TOOLS,
    'project_save_paper',
    'literature_plan_query',
    'literature_search_pubmed',
    'literature_get_paper',
    'paper_get',
    'paper_get_document',
    'paper_resolve_fulltext',
    'evidence_retrieve',
    'evidence_verify',
  ],
  paper: [
    ...COMMON_TOOLS,
    'paper_get',
    'paper_get_document',
    'paper_resolve_fulltext',
    'paper_search_content',
    'evidence_retrieve',
    'evidence_save',
  ],
  statistics: [
    ...COMMON_TOOLS,
    'dataset_profile',
    'dataset_get_schema',
    'statistics_plan',
    'statistics_generate_code',
    'statistics_execute',
    'artifact_get',
    'artifact_export',
  ],
}

interface ModeState {
  readonly mode: AgentMode
  readonly release: (() => void) | undefined
}

/** Installs and replaces one scoped `tools.restrict()` layer per session. */
export class AgentModeController {
  private readonly states = new Map<string, ModeState>()

  /** @param agents - Optional live-agent registry; absent in storage-only compositions. */
  constructor(private readonly agents: ModeAgentRegistry | undefined) {}

  /** Read a live mode, defaulting to the Research tool set. */
  current(id: string): AgentMode {
    return this.states.get(id)?.mode ?? 'research'
  }

  /** Whether this controller has an explicitly installed mode for a session. */
  has(id: string): boolean {
    return this.states.has(id)
  }

  /** Apply a mode to a live agent, replacing its previous restriction. */
  apply(id: string, mode: AgentMode): void {
    const parsed = agentModeSchema.parse(mode)
    const agent = this.agents?.get(id)
    const release = agent === undefined
      ? undefined
      : agent.ctx.tools.restrict({ allow: MODE_TOOL_ALLOWLIST[parsed] })
    this.states.get(id)?.release?.()
    this.states.set(id, { mode: parsed, release })
  }

  /** Remove the scoped restriction when an agent leaves the registry. */
  release(id: string): void {
    this.states.get(id)?.release?.()
    this.states.delete(id)
  }
}
