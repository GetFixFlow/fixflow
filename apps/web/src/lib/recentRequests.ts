// The links to a person's own requests, kept on their device so they can find them again.
// A link is the only way to follow a request (there is no account), so losing it means losing the request.
// Storage can be missing or full (private windows): every call copes with that.
const KEY = 'fixflow_recent_requests'
const MAX = 5

export interface RecentRequest {
  token: string
  title: string
  created_at: string
}

export function loadRecentRequests(): RecentRequest[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is RecentRequest =>
        !!r && typeof r.token === 'string' && typeof r.title === 'string' && typeof r.created_at === 'string',
    )
  } catch {
    return []
  }
}

export function rememberRequest(request: RecentRequest) {
  try {
    const rest = loadRecentRequests().filter((r) => r.token !== request.token)
    localStorage.setItem(KEY, JSON.stringify([request, ...rest].slice(0, MAX)))
  } catch {
    // Nothing to do: the request itself is fine, only the reminder is lost.
  }
}
