import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { isLanguage, setLanguage } from '@/i18n'

/**
 * Switches the screens to the signed-in person's language (the one they chose, else their company's, as the server
 * works it out). Signed out, the language chosen on this device stays. Renders nothing.
 */
export function LanguageApplier() {
  const language = useAuthStore((s) => s.user?.language)

  useEffect(() => {
    // From the server: not remembered on the device, so signing out does not leave one person's language for the next.
    if (isLanguage(language)) setLanguage(language, false)
  }, [language])

  return null
}
