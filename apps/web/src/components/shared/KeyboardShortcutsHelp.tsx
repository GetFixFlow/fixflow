import { Trans, useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { ALL_SHORTCUTS } from '@/hooks/useKeyboardShortcuts'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

/** What each shortcut does, by the key it is on (the names are in the translations). */
const SHORTCUT_NAMES: Record<string, string> = {
  N: 'new_work_order', '/': 'focus_search', Escape: 'close', S: 'start', C: 'complete', V: 'verify', E: 'edit', '?': 'help',
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation()
  const half = Math.ceil(ALL_SHORTCUTS.length / 2)
  const left = ALL_SHORTCUTS.slice(0, half)
  const right = ALL_SHORTCUTS.slice(half)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('shell.shortcuts.title')}
      className="max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[left, right].map((col, ci) => (
          <div key={ci} className="space-y-2">
            {col.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">{SHORTCUT_NAMES[s.key] ? t(`shell.shortcuts.${SHORTCUT_NAMES[s.key]}`) : s.description}</span>
                <kbd className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        <Trans i18nKey="shell.shortcuts.toggle" components={{ kbd: <kbd className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-700" /> }} />
      </p>
    </Modal>
  )
}
