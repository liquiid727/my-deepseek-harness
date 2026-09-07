/** Package invariant companion. @module @deepseek-ai/dsh-pi-adapter/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-pi-adapter'
/** Cordis companion plugin name. */
export const name = 'pi-adapter-invariant'
/** Service required before registration. */
export const inject = ['invariants']
/** No runtime invariant: mapping persistence is proven by adapter round-trip tests. */
const install: InvariantInstaller = () => {}
/** Registers the empty companion; mapping durability is covered by adapter tests. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
