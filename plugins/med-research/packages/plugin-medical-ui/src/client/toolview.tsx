/**
 * Keyed Tool result card for every Med Research tool (SPEC §6, §42.2). The card
 * reads the settled block the turn already holds and never re-runs host work;
 * an unclaimed tool name falls back to the generic row.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/toolview
 */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { artifactExportUrl } from './artifact-download.ts'
import { NS } from './locales.ts'
import { MED_TOOL_NAMES } from './tool-names.ts'
import css from './components.module.css'

export { MED_TOOL_NAMES }

/** Full props of the Med Research Tool card. */
export type MedToolCardProps = ToolCallViewProps & PropsLocale<typeof NS>

/**
 * Read one tool call's arguments from the running or settled block.
 * @param block - running call or settled result node.
 * @returns the parsed arguments, or undefined when absent or malformed.
 */
function toolArguments(block: ToolCallViewProps['block']): Record<string, unknown> | undefined {
  const raw = 'kind' in block ? block.call?.argsRaw : block.argsRaw
  if (raw === undefined) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    // A partially streamed argument string is not yet JSON; the card shows the
    // name and status without the download action.
    return undefined
  }
}

/**
 * Render one Med Research tool call: its wire name plus the running, settled, or
 * failed lifecycle the turn reports, and a download link for an exported artifact.
 * @param props - Tool owner share, the declared locale seat, and the standard kit.
 * @returns the compact card.
 */
export function MedToolCard({ toolName, block, t }: MedToolCardProps) {
  const status = !('kind' in block)
    ? t('tool.running')
    : block.isError ? t('tool.failed') : t('tool.done')
  const args = toolArguments(block)
  const download = toolName === 'artifact_export'
    && !('kind' in block ? block.isError : false)
    && typeof args?.['artifactId'] === 'string'
    && typeof args?.['format'] === 'string'
    ? artifactExportUrl(args['artifactId'] as string, args['format'] as string)
    : undefined
  return (
    <div className={css.toolCard}>
      <code>{toolName}</code>
      <span className={css.toolStatus}>{status}</span>
      {download === undefined ? null : (
        <a href={download} download data-med-artifact-download="true">{t('action.download')}</a>
      )}
    </div>
  )
}
