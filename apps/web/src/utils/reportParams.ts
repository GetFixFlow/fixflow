/** The Filters panel's choices without the period, for what is true now rather than over a period (the backlog). */
export function withoutPeriod(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'from' && key !== 'to'))
}
