/** "3 days 4 hours", "2 hours 5 minutes", "40 seconds": enough to tell a fresh start from a long run. */
export function formatUptime(seconds: number): string {
  const units: [string, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
  const parts: string[] = []
  let rest = Math.max(0, Math.floor(seconds))
  for (const [name, size] of units) {
    const count = Math.floor(rest / size)
    rest -= count * size
    if (count > 0 && parts.length < 2) parts.push(`${count} ${name}${count === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return `${rest} second${rest === 1 ? '' : 's'}`
  return parts.join(' ')
}
