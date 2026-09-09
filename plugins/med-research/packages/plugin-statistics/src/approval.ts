/**
 * Approval policy for statistics execution (SPEC §40, AGENTS.md §2.5). The
 * decision lives here, not in the tool body, and is wired as a
 * `tools/pre-execute` listener; a missing approval answerer turns `ask` into a
 * denial, so execution fails closed.
 * @module @medresearch/dsh-plugin-statistics/src/approval
 */

import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

/** Tools that must be approved before they run. */
export const APPROVAL_REQUIRED_TOOLS: readonly string[] = ['statistics_execute']

/**
 * Decide the pre-execute verdict for one tool call.
 * @param toolName - Tool being dispatched.
 * @returns `ask` for approved-only tools, `allow` otherwise.
 */
export function approvalDecision(toolName: string): PreToolDecision {
  if (!APPROVAL_REQUIRED_TOOLS.includes(toolName)) return { kind: 'allow' }
  return {
    kind: 'ask',
    reason: 'statistics_execute runs generated code against the dataset; approve this single execution',
  }
}
