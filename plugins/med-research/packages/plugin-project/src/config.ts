/**
 * Project plugin configuration. `workspaceRoot` is the parent directory every
 * project workspace is created under; it has no universally correct value, so
 * it is required and fails loud when absent.
 * @module @medresearch/dsh-plugin-project/src/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin configuration. */
export interface Config {
  /** Absolute parent directory for project workspaces. */
  workspaceRoot: string
}

/** Schemastery validator for {@link Config}. */
export const Config: z<Config> = z.object({
  workspaceRoot: z.string().required(),
})
