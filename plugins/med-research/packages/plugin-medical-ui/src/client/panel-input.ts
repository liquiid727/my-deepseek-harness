/**
 * Which page currently hands its message box to the assistant panel.
 *
 * The host docks its own composer at the foot of any View that does not claim a
 * composer outlet, and a plugin cannot stop it from rendering. 0917 has three
 * pages with no centre input (项目概览 / 证据与笔记 / 阅读器) and one panel that
 * carries the box instead; without a shared fact, the panel would show a second
 * input next to the host's.
 *
 * So the page that hands its input over says so here, and the panel draws its
 * box only while that claim stands. Exactly one input is on screen at a time,
 * which is the rule `ui-acceptance.md` states.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/panel-input
 */

import { useEffect, useSyncExternalStore } from 'react'

/** The page currently owning the panel's input, or `undefined`. */
let owner: string | undefined

const listeners = new Set<() => void>()

/**
 * Claim or release the panel's message box.
 * @param page - the page taking the box, or `undefined` to give it back.
 */
export function setPanelInputOwner(page: string | undefined): void {
  if (owner === page) return
  owner = page
  for (const listener of listeners) listener()
}

/** The page currently holding the box, for a plain read. */
export function panelInputOwner(): string | undefined {
  return owner
}

/**
 * Subscribe to ownership changes.
 * @param listener - called after every change.
 * @returns the unsubscribe function.
 */
export function subscribePanelInput(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Whether some page is handing its input to the panel right now. */
export function usePanelInputClaimed(): boolean {
  return useSyncExternalStore(subscribePanelInput, () => owner !== undefined, () => false)
}

/**
 * Hand this page's message box to the panel for as long as `active` holds.
 * @param page - stable identity of the page taking the box.
 * @param active - whether the page currently wants the panel to carry it.
 */
export function useHandOffInput(page: string, active: boolean): void {
  useEffect(() => {
    if (!active) {
      // Only release what this page still owns: two pages overlap for a frame
      // during a route change, and the incoming page's claim must survive.
      if (panelInputOwner() === page) setPanelInputOwner(undefined)
      return
    }
    setPanelInputOwner(page)
    return () => { if (panelInputOwner() === page) setPanelInputOwner(undefined) }
  }, [page, active])
}
