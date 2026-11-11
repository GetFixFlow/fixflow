import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

export function PWAUpdatePrompt() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShow(true)
      })
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 flex items-center gap-3">
      <RefreshCw className="h-5 w-5 text-brand-600 dark:text-brand-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t('shell.update.title')}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('shell.update.body')}</p>
      </div>
      <Button size="sm" onClick={() => window.location.reload()}>{t('shell.update.reload')}</Button>
    </div>
  )
}
