import { useTranslation } from 'react-i18next'
import { LANGUAGES, isLanguage, setLanguage } from '@/i18n'

const CLASS =
  'h-9 rounded-md border border-gray-300 bg-white pl-2 pr-8 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

/** Picks the language of the screens on this device: for the pages seen before signing in. */
export function LanguageSelect({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation()
  if (LANGUAGES.length < 2) return null

  return (
    <select
      aria-label={t('language.label')}
      value={isLanguage(i18n.language) ? i18n.language : 'en'}
      onChange={(e) => setLanguage(e.target.value)}
      className={`${CLASS} ${className}`}
    >
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>{language.name}</option>
      ))}
    </select>
  )
}
