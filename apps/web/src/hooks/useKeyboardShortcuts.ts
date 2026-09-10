import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Shortcut {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  description: string
  action: () => void
  ignoreInInput?: boolean
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isInput = ['input', 'textarea', 'select'].includes(activeTag)

      for (const shortcut of shortcuts) {
        if (shortcut.ignoreInInput && isInput) continue

        const metaMatch = shortcut.meta ? e.metaKey || e.ctrlKey : true
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        const noModifier = !shortcut.meta && !shortcut.ctrl && !e.metaKey && !e.ctrlKey

        if (keyMatch && (shortcut.meta || shortcut.ctrl ? metaMatch && ctrlMatch : noModifier) && shiftMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

export function useWorkOrderShortcuts({
  onNew,
  onFocusSearch,
}: {
  onNew?: () => void
  onFocusSearch?: () => void
}) {
  const navigate = useNavigate()

  useKeyboardShortcuts([
    {
      key: 'n',
      description: 'New Work Order',
      action: () => onNew?.() ?? navigate('/work-orders/new'),
      ignoreInInput: true,
    },
    {
      key: '/',
      description: 'Focus search',
      action: () => onFocusSearch?.(),
      ignoreInInput: true,
    },
    {
      key: 'Escape',
      description: 'Go back',
      action: () => navigate(-1),
      ignoreInInput: false,
    },
  ])
}

export const ALL_SHORTCUTS: Omit<Shortcut, 'action'>[] = [
  { key: 'N', description: 'New Work Order', ignoreInInput: true },
  { key: '/', description: 'Focus search', ignoreInInput: true },
  { key: 'Escape', description: 'Close modal / go back' },
  { key: 'S', description: 'Start Work (if assigned to me)', ignoreInInput: true },
  { key: 'C', description: 'Complete (if in progress)', ignoreInInput: true },
  { key: 'V', description: 'Verify (if completed, manager)', ignoreInInput: true },
  { key: 'E', description: 'Edit WO (manager)', ignoreInInput: true },
  { key: '?', description: 'Show keyboard shortcuts', ignoreInInput: true },
]
