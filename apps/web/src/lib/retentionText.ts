/** "1.4 GB", "820 KB", "0 B": sizes the way a person reads them (1024 steps, one decimal from MB up). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')} ${units[unit]}`
}

/** 365 → "1 year", 730 → "2 years", 90 → "90 days", 0 → "For ever" (when `zeroMeansForever`). */
export function describeDays(days: number, zeroMeansForever = false): string {
  if (days === 0 && zeroMeansForever) return 'For ever'
  if (days >= 365 && days % 365 === 0) return `${days / 365} ${days === 365 ? 'year' : 'years'}`
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export const SENSOR_CHOICES = [7, 14, 30, 90, 180, 365, 730, 1095, 1825, 3650]
export const AUDIT_CHOICES = [0, 365, 730, 1095, 1825, 2555]

/** The usual choices, plus the current value when it is not one of them (it was set through the API or the Organization page). */
export function withCurrent(choices: number[], current: number): number[] {
  return choices.includes(current) ? choices : [...choices, current].sort((a, b) => a - b)
}
