/** Package invariant companion. @module @deepseek-ai/dsh-workbench-contract/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-workbench-contract'
/** Cordis companion plugin name. */
export const name = 'workbench-contract-invariant'
/** Service required before registration. */
export const inject = ['invariants']
/** No runtime invariant: the contract is a pure type and parser surface. */
const install: InvariantInstaller = () => {}
/** Registers the empty companion; contract validation is pure and unit-tested. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
