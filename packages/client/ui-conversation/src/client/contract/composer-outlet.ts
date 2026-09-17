/** View-owned placement of the resident Session composer. */

/** Presentation and completion behavior supplied by a Conversation View. */
export interface ComposerOutletOptions {
  /** Localized message placeholder used while this outlet is active. */
  readonly placeholder: string
  /** Called after an ordinary message is accepted while the originating View is still active. */
  readonly onMessageAccepted: () => void
}

/** One active View's requested composer destination. */
export interface ComposerOutlet extends ComposerOutletOptions {
  /** DOM id of an empty destination inside the current Conversation scrollport. */
  readonly targetId: string
  /** View that owns the destination and completion callback. */
  readonly view: string
}

/**
 * Attach the resident composer to an empty element owned by this View.
 * @param targetId - Unique DOM id, already mounted inside the Conversation scrollport.
 * @param options - Localized presentation and accepted-message callback.
 * @returns release function; call before removing the destination or leaving the View.
 */
export type MountComposer = (targetId: string, options: ComposerOutletOptions) => () => void
