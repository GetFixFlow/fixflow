import i18n, { type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * The languages of the screens. A language is a folder in src/locales named for its code (es/), holding the same files
 * as en/ (one for each part of the app); adding a folder is all it takes for it to be offered (see docs/translating.md).
 * English is the language everything is first written in, and shows for any text a language has not translated yet.
 */
const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>

export const DEFAULT_LANGUAGE = 'en'
const STORAGE_KEY = 'fixflow-language'

const resources: Resource = {}
for (const [path, texts] of Object.entries(files)) {
  const code = path.match(/\/([^/]+)\/[^/]+\.json$/)?.[1]
  if (!code) continue
  const translation = (resources[code] ??= { translation: {} }).translation as Record<string, unknown>
  Object.assign(translation, texts) // each file holds its own top-level keys
}

/** The codes of the languages that ship, English first. */
export const LANGUAGE_CODES = Object.keys(resources).sort((a, b) => (a === DEFAULT_LANGUAGE ? -1 : b === DEFAULT_LANGUAGE ? 1 : a.localeCompare(b)))

/** A language by its own name ("Español"), the way a person looking for it expects to read it. */
export const LANGUAGES = LANGUAGE_CODES.map((code) => ({ code, name: String((resources[code].translation as { language_name?: string }).language_name ?? code) }))

export const isLanguage = (code: unknown): code is string => typeof code === 'string' && LANGUAGE_CODES.includes(code)

/** What a visitor who has not chosen gets: the language they chose before on this device, else the browser's, else English. */
export function initialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // Storage blocked: fall through to the browser's language.
  }
  const preferred = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : []
  for (const tag of preferred) {
    const base = tag?.split('-')[0]?.toLowerCase()
    if (isLanguage(base)) return base
  }
  return DEFAULT_LANGUAGE
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React escapes what it draws
  returnNull: false,
})

/** Switches every screen to a language and remembers it on this device. */
export function setLanguage(code: string, remember = true) {
  if (!isLanguage(code)) return
  if (remember) {
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Storage blocked: the language applies until the page is closed.
    }
  }
  if (i18n.language !== code) void i18n.changeLanguage(code)
  if (typeof document !== 'undefined') document.documentElement.lang = code
}

/** The current language, for the code that formats dates (Intl wants it). */
export const currentLanguage = () => i18n.language || DEFAULT_LANGUAGE

/** "In Progress", "Critical", "Technician": the word for a status, priority, type or role, in the language of the screens. */
export function label(group: 'status' | 'priority' | 'type' | 'role', value: string | null | undefined): string {
  if (!value) return ''
  const words = value.replace(/_/g, ' ')
  return i18n.t(`common.${group}.${value}`, { defaultValue: words.charAt(0).toUpperCase() + words.slice(1) })
}

/** Translate outside a component (a message shown by a hook or a plain function). */
export const t = i18n.t.bind(i18n)

export default i18n
