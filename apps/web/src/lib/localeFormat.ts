import { format as formatWithPattern } from 'date-fns'
import { create } from 'zustand'

/**
 * How this company shows dates, times, numbers and money (Settings, Localization). The functions here
 * read the current settings each time they are called, so any screen can use them without hooks.
 * The settings are remembered on the device, so the first screen after opening the app already uses them.
 */
export interface LocaleSettings {
  timezone: string
  date_format: string
  time_format: '12h' | '24h'
  currency: string
  number_format: string
  first_day_of_week: 'monday' | 'sunday'
}

export const DEFAULT_LOCALE: LocaleSettings = {
  timezone: 'UTC',
  date_format: 'MMM D, YYYY',
  time_format: '12h',
  currency: 'USD',
  number_format: '1,234.56',
  first_day_of_week: 'sunday', // what the calendars and reports always used
}

/** The date patterns the settings offer, in date-fns terms. */
export const DATE_PATTERNS: Record<string, string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD MMM YYYY': 'dd MMM yyyy',
  'MMM D, YYYY': 'MMM d, yyyy',
}

/** Thousands and decimal separators for each number style the settings offer. */
export const NUMBER_STYLES: Record<string, { thousands: string; decimal: string }> = {
  '1,234.56': { thousands: ',', decimal: '.' },
  '1.234,56': { thousands: '.', decimal: ',' },
  '1 234.56': { thousands: ' ', decimal: '.' },
  '1 234,56': { thousands: ' ', decimal: ',' },
}

export const CURRENCIES: Record<string, { symbol: string; decimals: number; name: string }> = {
  USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CAD: { symbol: 'CA$', decimals: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  CHF: { symbol: 'Fr ', decimals: 2, name: 'Swiss Franc' },
  INR: { symbol: '₹', decimals: 2, name: 'Indian Rupee' },
  LKR: { symbol: 'Rs ', decimals: 2, name: 'Sri Lankan Rupee' },
  SGD: { symbol: 'S$', decimals: 2, name: 'Singapore Dollar' },
}

const STORAGE_KEY = 'fixflow-locale'

function remembered(): LocaleSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return saved ? { ...DEFAULT_LOCALE, ...saved } : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

interface LocaleState {
  locale: LocaleSettings
  setLocale: (locale: Partial<LocaleSettings>) => void
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: remembered(),
  setLocale: (changes) => {
    const next = { ...get().locale, ...changes }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage blocked: the settings are simply fetched again next time.
    }
    set({ locale: next })
  },
}))

const current = () => useLocaleStore.getState().locale

type DateInput = Date | string | number | null | undefined

function toDate(value: DateInput): Date | null {
  if (value == null || value === '') return null
  // A bare date (2026-10-13) is a calendar day, not a moment: reading it as UTC would show the day before west of Greenwich.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The formatters for a given set of settings. The app uses the ones for the company's settings
 * (below); the Localization screen uses these with the form's values for its live preview.
 */
export function formattersFor(locale: LocaleSettings) {
  const dateFormat = (value: DateInput) => {
    const date = toDate(value)
    return date ? formatWithPattern(date, DATE_PATTERNS[locale.date_format] ?? DATE_PATTERNS[DEFAULT_LOCALE.date_format]) : '—'
  }
  const timeFormat = (value: DateInput) => {
    const date = toDate(value)
    return date ? formatWithPattern(date, locale.time_format === '24h' ? 'HH:mm' : 'h:mm a') : '—'
  }
  const numberFormat = (value: number, decimals = 0) => {
    const style = NUMBER_STYLES[locale.number_format] ?? NUMBER_STYLES[DEFAULT_LOCALE.number_format]
    const [whole, fraction] = Math.abs(value).toFixed(decimals).split('.')
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, style.thousands)
    const negative = value < 0 && Number(Math.abs(value).toFixed(decimals)) !== 0
    return `${negative ? '-' : ''}${grouped}${fraction ? style.decimal + fraction : ''}`
  }
  const moneyFormat = (value: number | string | null | undefined, decimals?: number) => {
    if (value == null || value === '' || Number.isNaN(Number(value))) return '—'
    const currency = CURRENCIES[locale.currency] ?? CURRENCIES[DEFAULT_LOCALE.currency]
    const amount = Number(value)
    return `${amount < 0 ? '-' : ''}${currency.symbol}${numberFormat(Math.abs(amount), decimals ?? currency.decimals)}`
  }
  return {
    date: dateFormat,
    time: timeFormat,
    dateTime: (value: DateInput) => {
      const date = toDate(value)
      return date ? `${dateFormat(date)} ${timeFormat(date)}` : '—'
    },
    number: numberFormat,
    money: moneyFormat,
    /** Compact amounts for chart axes: $1.2k, $950. */
    shortMoney: (value: number, decimals = 1) => {
      const currency = CURRENCIES[locale.currency] ?? CURRENCIES[DEFAULT_LOCALE.currency]
      const thousands = Math.abs(value) >= 1000
      const text = thousands ? `${numberFormat(Math.abs(value) / 1000, decimals)}k` : numberFormat(Math.abs(value), 0)
      return `${value < 0 ? '-' : ''}${currency.symbol}${text}`
    },
  }
}

/** 13 Oct 2026, 10/13/2026 and so on, as set. An em dash when there is no date. */
export const formatDate = (value: DateInput) => formattersFor(current()).date(value)
export const formatTime = (value: DateInput) => formattersFor(current()).time(value)
export const formatDateTime = (value: DateInput) => formattersFor(current()).dateTime(value)
/** A number with this company's separators. */
export const formatNumber = (value: number, decimals = 0) => formattersFor(current()).number(value, decimals)
/** Money in the company's currency. `decimals` overrides the currency's usual number of decimals (charts show whole amounts). */
export const formatMoney = (value: number | string | null | undefined, decimals?: number) => formattersFor(current()).money(value, decimals)

export const formatShortMoney = (value: number, decimals?: number) => formattersFor(current()).shortMoney(value, decimals)

/** 0 (Sunday) or 1 (Monday), the form date-fns wants for the first day of the week. */
export const weekStartsOn = (): 0 | 1 => (current().first_day_of_week === 'sunday' ? 0 : 1)

/** Short weekday names starting with the company's first day of the week, for calendar headers. */
export const weekdayLabels = (): string[] => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return weekStartsOn() === 0 ? days : [...days.slice(1), days[0]]
}
