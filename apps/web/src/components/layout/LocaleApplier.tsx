import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useLocalization } from '@/hooks/useSettings'
import { useLocaleStore } from '@/lib/localeFormat'

/** Hands the company's regional settings to the formatting code. Renders nothing. */
export function LocaleApplier() {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const { data } = useLocalization(signedIn)

  useEffect(() => {
    if (data) useLocaleStore.getState().setLocale(data)
  }, [data])

  return null
}
