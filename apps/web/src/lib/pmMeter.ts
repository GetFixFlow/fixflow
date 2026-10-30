import type { PreventiveMaintenance } from '@/types'

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })

/** "At 4,370.5 hours (now 4,120.5, 250 to go)" for a schedule that follows a meter; null for any other. */
export function meterDueText(pm: Pick<PreventiveMaintenance, 'frequency_type' | 'meter' | 'next_due_reading'>): string | null {
  if (pm.frequency_type !== 'meter_based') return null
  if (!pm.meter || pm.next_due_reading == null) return 'Follows no meter yet'
  const left = pm.next_due_reading - pm.meter.reading
  const state = left <= 0 ? 'due now' : `${number(left)} to go`
  return `At ${number(pm.next_due_reading)} ${pm.meter.unit} (now ${number(pm.meter.reading)}, ${state})`
}
