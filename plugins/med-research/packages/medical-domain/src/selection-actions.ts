/**
 * Additive selection-action registry (SPEC-R001-S03-004, SPEC-R001-S06-004,
 * interfaces.md §Reader, Note and Evidence).
 *
 * The Reader and the Draft editor each own one instance. Business packages
 * attach behaviour by id without the host importing them, every registration
 * returns its own disposer, and the required-id set lets a profile report a
 * missing contribution as a dependency diagnostic instead of rendering a
 * disabled button.
 * @module @medresearch/dsh-medical-domain/src/selection-actions
 */

import type {
  MedSelectionActionsService,
  SelectionAction,
  SelectionActionRequest,
  SelectionActionResult,
} from '@medresearch/dsh-medical-contracts'

/** Stable failure codes of the registry itself. */
export type SelectionActionErrorCode = 'ACTION_NOT_FOUND' | 'SELECTION_REQUIRED'

/** Thrown when a caller invokes an action the registry cannot serve. */
export class SelectionActionError extends Error {
  override readonly name = 'SelectionActionError'

  /**
   * @param code - Stable discriminant.
   * @param message - Diagnostic detail naming the action.
   */
  constructor(readonly code: SelectionActionErrorCode, message: string) {
    super(message)
  }
}

/**
 * One registry of selection-scoped contributions.
 *
 * Registrations are keyed by action id, so re-registering the same id replaces
 * the contribution instead of duplicating it, and the disposer only removes the
 * registration it created.
 */
export class SelectionActionRegistry implements MedSelectionActionsService {
  private readonly actions = new Map<string, SelectionAction>()
  private readonly required = new Set<string>()

  /**
   * Add or replace one contribution.
   * @param action - Contribution to register.
   * @returns the disposer that removes exactly this registration.
   */
  register(action: SelectionAction): () => void {
    const previous = this.actions.get(action.id)
    this.actions.set(action.id, action)
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (previous === undefined) this.actions.delete(action.id)
      else this.actions.set(action.id, previous)
    }
  }

  /**
   * List the contributions one request can use, lowest `order` first.
   *
   * An action that declares `requiresSelection` is only offered when the
   * request actually carries selected text.
   * @param request - Selection-scoped request.
   * @returns the applicable contributions in deterministic order.
   */
  list(request: SelectionActionRequest): SelectionAction[] {
    const hasSelection = (request.selectionText ?? '').trim() !== ''
    return [...this.actions.values()]
      .filter(action => !action.requiresSelection || hasSelection)
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  }

  /**
   * Invoke one contribution.
   * @param id - Action id.
   * @param request - Selection-scoped request.
   * @param signal - Cancellation for the in-flight action.
   * @returns the action result.
   * @throws SelectionActionError when the action is unknown or needs a selection.
   */
  async invoke(id: string, request: SelectionActionRequest, signal?: AbortSignal): Promise<SelectionActionResult> {
    const action = this.actions.get(id)
    if (action === undefined) throw new SelectionActionError('ACTION_NOT_FOUND', `no selection action '${id}'`)
    if (action.requiresSelection && (request.selectionText ?? '').trim() === '') {
      throw new SelectionActionError('SELECTION_REQUIRED', `selection action '${id}' requires selected text`)
    }
    return action.invoke(request, signal)
  }

  /**
   * Declare the ids a complete profile must provide.
   * @param ids - Required action ids.
   * @returns the disposer that withdraws the requirement.
   */
  require(ids: readonly string[]): () => void {
    const added = ids.filter(id => !this.required.has(id))
    for (const id of added) this.required.add(id)
    return () => { for (const id of added) this.required.delete(id) }
  }

  /** Required action ids that have no contribution yet. */
  missing(): string[] {
    return [...this.required].filter(id => !this.actions.has(id)).sort()
  }

  /** Every registered action id, for diagnostics and tests. */
  ids(): string[] {
    return [...this.actions.keys()].sort()
  }
}

/**
 * Reader action ids the V1 profile must provide (interfaces.md: the Reader
 * registry carries Evidence, source navigation, and Reference Chasing).
 */
export const REQUIRED_READER_ACTIONS = [
  'reader.copy-citation',
  'reader.save-evidence',
  'reader.reference-chase',
  'reader.save-note',
  'reader.open-source',
  'reader.translate-selection',
] as const

/**
 * Draft-editor action ids the V1 profile must provide (interfaces.md: S08
 * registers writing, translation, validation, and export on the Draft editor).
 */
export const REQUIRED_DRAFT_EDITOR_ACTIONS = [
  'draft.generate',
  'draft.translate',
  'draft.validate',
  'draft.export',
] as const
