import { t } from '@/i18n'

export type WarrantyTone = 'ok' | 'soon' | 'ended'

/** Where a warranty stands today. `endsOn` is the bare date the API sends (2027-03-01), the last day it covers. */
export function warrantyStatus(endsOn: string, today: Date = new Date()): { days: number; tone: WarrantyTone; text: string } {
  const [year, month, day] = endsOn.split('-').map(Number)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((new Date(year, month - 1, day).getTime() - start.getTime()) / 86_400_000)
  if (days < 0) return { days, tone: 'ended', text: days === -1 ? t('assets.warranty.ended_yesterday') : t('assets.warranty.ended_days', { count: -days }) }
  const text = days === 0 ? t('assets.warranty.ends_today') : days === 1 ? t('assets.warranty.ends_tomorrow') : t('assets.warranty.ends_in', { count: days })
  return { days, tone: days <= 30 ? 'soon' : 'ok', text }
}
