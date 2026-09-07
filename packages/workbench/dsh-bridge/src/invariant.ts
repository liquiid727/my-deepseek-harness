/** Package-owned invariant companion for the Workbench bridge. @module @deepseek-ai/dsh-workbench-bridge/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-workbench-bridge'
/** Cordis companion plugin name. */
export const name = 'workbench-bridge-invariant'
/** Service required before registration. */
export const inject = ['invariants']
/** No runtime invariant: DSH session ownership is validated by the session package. */
const install: InvariantInstaller = () => {}
/** Registers the empty companion; bridge relations are tested at the session owner. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
