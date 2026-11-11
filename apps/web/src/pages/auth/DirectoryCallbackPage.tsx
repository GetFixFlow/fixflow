import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useDirectoryExchange } from '@/hooks/useAuth'

/**
 * Where the browser lands after the company account has said yes (/login/directory?code=...). The code is a one-use
 * note: it is read once, taken out of the address bar, and swapped for a session.
 */
export function DirectoryCallbackPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  // Read on the first render only: the address is cleaned below, and a second run must not send the note again.
  const [code] = useState(() => params.get('code'))
  const sent = useRef(false)
  const { mutate: exchange, isError } = useDirectoryExchange()

  useEffect(() => {
    if (!code || sent.current) return
    sent.current = true
    window.history.replaceState(window.history.state, '', window.location.pathname)
    exchange(code)
  }, [code, exchange])

  if (!code) return <Navigate to="/login" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {isError ? (
          <>
            <h1 className="sr-only">{t('auth.directory.callback.back')}</h1>
            <p role="alert" className="text-sm text-gray-700 dark:text-gray-300">{t('auth.directory.callback.failed')}</p>
            <Link to="/login?directory_error=failed" className="mt-4 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              {t('auth.directory.callback.back')}
            </Link>
          </>
        ) : (
          <>
            <Loader2 aria-hidden="true" className="mx-auto mb-3 h-6 w-6 animate-spin text-brand-600" />
            <h1 className="text-sm text-gray-700 dark:text-gray-300">{t('auth.directory.callback.signing_in')}</h1>
          </>
        )}
      </div>
    </main>
  )
}
