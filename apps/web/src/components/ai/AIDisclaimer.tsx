import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface AIDisclaimerProps {
  feature: string
  className?: string
}

function storageKey(feature: string) {
  return `ai_disclaimer_seen_${feature}`
}

export function AIDisclaimer({ feature, className }: AIDisclaimerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey(feature)) === 'true'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const handleDontShowAgain = (checked: boolean) => {
    if (!checked) return
    try {
      sessionStorage.setItem(storageKey(feature), 'true')
    } catch {
      // sessionStorage unavailable (private mode, etc.) — just dismiss for this render
    }
    setDismissed(true)
  }

  return (
    <div className={`flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300 ${className ?? ''}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        <p>AI responses may be inaccurate. Always verify safety-critical information.</p>
        <label className="mt-1 flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" onChange={(e) => handleDontShowAgain(e.target.checked)} />
          Don't show again
        </label>
      </div>
    </div>
  )
}
