import { isAxiosError } from 'axios'

/** What to tell the person when a request failed: the server's own words when it gave some, else `fallback`. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error) && error.response) {
    const { status, data } = error.response
    if (status === 403) return 'Only managers and administrators can do that.'
    if (status === 429) return 'Too many requests. Wait a moment and try again.'
    const message = (data as { error?: { message?: unknown } } | undefined)?.error?.message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}
