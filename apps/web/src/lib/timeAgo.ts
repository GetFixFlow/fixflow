import { formatDistanceToNow } from 'date-fns'
import { currentLanguage } from '@/i18n'

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "about 2 hours ago", "hace 2 horas": how long ago a moment was, in the language of the screens. */
export function timeAgo(date: Date | string | number): string {
  const moment = new Date(date)
  const lang = currentLanguage()
  // date-fns words it in English; any other language uses the browser's own wording.
  if (lang.startsWith('en')) return formatDistanceToNow(moment, { addSuffix: true })

  const seconds = Math.round((moment.getTime() - Date.now()) / 1000)
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  }
  return format.format(Math.round(seconds / 60), 'minute')
}
