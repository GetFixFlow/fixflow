import type { KeyboardEvent } from 'react'

/** Enter or Space does what a click does: for a clickable element that is not a <button>. */
export const onActivate = (action: () => void) => (event: KeyboardEvent) => {
  if (event.target !== event.currentTarget) return // a key pressed in something inside it is not for it
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    action()
  }
}

/**
 * Props that make a clickable <div> work for the keyboard and a screen reader as a button. Prefer a real <button>; use this
 * where the element holds block content a <button> cannot (and holds no other button or link: that is not allowed).
 */
export const asButton = (action: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: action,
  onKeyDown: onActivate(action),
})
