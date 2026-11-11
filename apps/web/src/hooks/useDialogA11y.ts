import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * What a hand-made panel or overlay needs to behave as a dialog for the keyboard and a screen reader: when it opens, the
 * keyboard moves into it; Tab stays inside; Escape closes it; and when it closes the keyboard goes back to where it was.
 * (Dialogs built with the Modal and Drawer components get all of this from Radix.) Put the returned ref on the panel,
 * with role="dialog", aria-modal and a name.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const node = ref.current
    const before = document.activeElement as HTMLElement | null
    const inside = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])

    ;(inside()[0] ?? node)?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = inside()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [open])

  return ref
}
