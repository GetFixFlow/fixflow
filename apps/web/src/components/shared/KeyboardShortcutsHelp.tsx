import { Modal } from '@/components/ui/Modal'
import { ALL_SHORTCUTS } from '@/hooks/useKeyboardShortcuts'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  const half = Math.ceil(ALL_SHORTCUTS.length / 2)
  const left = ALL_SHORTCUTS.slice(0, half)
  const right = ALL_SHORTCUTS.slice(half)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard Shortcuts"
      className="max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[left, right].map((col, ci) => (
          <div key={ci} className="space-y-2">
            {col.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">{s.description}</span>
                <kbd className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        Press <kbd className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-700">?</kbd> to toggle this panel
      </p>
    </Modal>
  )
}
