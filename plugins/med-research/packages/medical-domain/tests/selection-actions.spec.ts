/**
 * Selection-action registry coverage (SPEC-R001-S03-004, SPEC-R001-S06-004).
 * The registry is the seam that lets a business package attach behaviour to the
 * Reader and the Draft editor without the host importing it, so its contract —
 * dispose, replacement, selection filtering, and the required-id diagnostic —
 * is pinned here.
 */

import { describe, expect, it, vi } from 'vitest'
import * as c from '@medresearch/dsh-medical-contracts'
import {
  REQUIRED_DRAFT_EDITOR_ACTIONS,
  REQUIRED_READER_ACTIONS,
  SelectionActionError,
  SelectionActionRegistry,
} from '@medresearch/dsh-medical-domain'

const PROJECT = c.projectIdSchema.parse('project-1')

function action(id: string, overrides: Partial<c.SelectionAction> = {}): c.SelectionAction {
  return {
    id,
    order: 10,
    labelKey: `action.${id}`,
    requiresSelection: false,
    invoke: async () => ({ status: 'SUCCEEDED' as const }),
    ...overrides,
  }
}

/** Minimal request; each test widens it as needed. */
function request(overrides: Partial<c.SelectionActionRequest> = {}): c.SelectionActionRequest {
  return { projectId: PROJECT, ...overrides }
}

describe('SelectionActionRegistry', () => {
  it('offers only the actions a request can use, in declared order', () => {
    const registry = new SelectionActionRegistry()
    registry.register(action('b', { order: 20 }))
    registry.register(action('a', { order: 10 }))
    registry.register(action('needs-selection', { order: 5, requiresSelection: true }))

    expect(registry.list(request()).map(item => item.id)).toEqual(['a', 'b'])
    expect(registry.list(request({ selectionText: 'PONV' })).map(item => item.id)).toEqual(['needs-selection', 'a', 'b'])
    // Whitespace is not a selection.
    expect(registry.list(request({ selectionText: '   ' })).map(item => item.id)).toEqual(['a', 'b'])
  })

  it('removes exactly the registration it created and restores the previous one', () => {
    const registry = new SelectionActionRegistry()
    const first = registry.register(action('a', { order: 1 }))
    const second = registry.register(action('a', { order: 9 }))
    expect(registry.list(request())[0]!.order).toBe(9)

    second()
    expect(registry.list(request())[0]!.order).toBe(1)
    first()
    expect(registry.ids()).toEqual([])
  })

  it('is idempotent when a disposer is called twice', () => {
    const registry = new SelectionActionRegistry()
    const dispose = registry.register(action('a'))
    dispose()
    dispose()
    expect(registry.ids()).toEqual([])
  })

  it('refuses an unknown action and an action that needs a selection', async () => {
    const registry = new SelectionActionRegistry()
    registry.register(action('needs-selection', { requiresSelection: true }))
    await expect(registry.invoke('missing', request())).rejects.toMatchObject({ code: 'ACTION_NOT_FOUND' })
    await expect(registry.invoke('needs-selection', request())).rejects.toMatchObject({ code: 'SELECTION_REQUIRED' })
  })

  it('returns the contribution result and propagates its failure reason', async () => {
    const registry = new SelectionActionRegistry()
    const invoke = vi.fn(async () => ({ status: 'FAILED' as const, message: 'boom' }))
    registry.register(action('a', { invoke }))
    await expect(registry.invoke('a', request())).resolves.toEqual({ status: 'FAILED', message: 'boom' })
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('reports the required ids a profile has not provided', () => {
    const registry = new SelectionActionRegistry()
    const unrequire = registry.require(REQUIRED_DRAFT_EDITOR_ACTIONS)
    expect(registry.missing()).toEqual([...REQUIRED_DRAFT_EDITOR_ACTIONS].sort())

    const disposers = REQUIRED_DRAFT_EDITOR_ACTIONS.map(id => registry.register(action(id)))
    expect(registry.missing()).toEqual([])

    for (const dispose of disposers) dispose()
    expect(registry.missing()).toEqual([...REQUIRED_DRAFT_EDITOR_ACTIONS].sort())
    unrequire()
    expect(registry.missing()).toEqual([])
  })

  it('names the reader actions a V1 profile must carry', () => {
    // interfaces.md: Evidence, source navigation, and Reference Chasing all
    // arrive through this registry, so the ids are part of the contract.
    expect([...REQUIRED_READER_ACTIONS]).toEqual([
      'reader.copy-citation',
      'reader.save-evidence',
      'reader.reference-chase',
      'reader.save-note',
      'reader.open-source',
      'reader.translate-selection',
    ])
  })

  it('exposes a stable error type callers can switch on', () => {
    expect(new SelectionActionError('ACTION_NOT_FOUND', 'x').code).toBe('ACTION_NOT_FOUND')
  })
})
