const pad = (n: number) => String(n).padStart(2, '0')

/** A moment as a <input type="datetime-local"> wants it (2026-10-16T14:30, in the person's own time zone). */
export function toInputValue(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** What such an input holds, as a moment the server can read (ISO 8601, UTC). Empty stays empty. */
export function fromInputValue(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
