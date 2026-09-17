/** Stable portal container for moving the shell composer without remounting its editor. */
import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const COMPOSER_EVENTS = [
  'click', 'dblclick', 'auxclick', 'contextmenu',
  'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
  'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'pointerover', 'pointerout',
  'keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'change',
  'compositionstart', 'compositionupdate', 'compositionend',
  'copy', 'cut', 'paste', 'dragstart', 'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop',
  'focusin', 'focusout', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel',
] as const

/**
 * Keep one composer tree while a View temporarily owns its DOM destination.
 * @param props - Host scrollport, optional destination id, and resident composer content.
 * @returns a portal whose container is released with the Conversation shell.
 */
export function ResidentComposer({ scrollerId, targetId, children }: {
  scrollerId: string
  targetId: string | undefined
  children: ReactNode
}) {
  const [container] = useState(() => {
    const element = document.createElement('div')
    element.dataset.composerContainer = ''
    element.style.display = 'contents'
    // The portal dispatches through its owning React tree. An enclosing View
    // can have another React root; native bubbling must not dispatch there too.
    for (const event of COMPOSER_EVENTS) {
      element.addEventListener(event, (event) => { event.stopPropagation() })
    }
    return element
  })

  useLayoutEffect(() => {
    const fallback = document.getElementById(scrollerId)
    if (fallback === null) throw new Error('composer requires a mounted Conversation scrollport')
    const target = targetId === undefined ? fallback : document.getElementById(targetId)
    if (target === null || !fallback.contains(target)) {
      throw new Error(`composer destination "${targetId}" is outside the Conversation scrollport`)
    }
    if (container.parentElement === target) return
    const focused = document.activeElement
    const restoreFocus = focused instanceof HTMLElement && container.contains(focused)
    const selection = restoreFocus ? window.getSelection() : null
    const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
    target.appendChild(container)
    if (restoreFocus) {
      focused.focus({ preventScroll: true })
      if (range !== null) {
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
  }, [container, scrollerId, targetId])

  useLayoutEffect(() => () => { container.remove() }, [container])
  return createPortal(children, container)
}
