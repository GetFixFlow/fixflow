import type { SavedReport } from '@/types/savedReports'

let next = 1

/** A saved report as the server sends it; say what differs. */
export function savedReport(extra: Partial<SavedReport> = {}): SavedReport {
  const id = next++
  return {
    id,
    name: `View ${id}`,
    report: 'work_orders',
    title: 'Work orders',
    period: 'last_30_days',
    filters: {},
    send_on: null,
    recipient_ids: [],
    recipients: [],
    owner: { id: 1, full_name: 'Demo Admin' },
    last_sent_on: null,
    last_sent_at: null,
    last_error: null,
    editable: true,
    created_at: '2026-11-01T00:00:00Z',
    ...extra,
  }
}

export const eligiblePeople = [
  { id: 1, full_name: 'Demo Admin', role: 'admin' },
  { id: 2, full_name: 'Mia Manager', role: 'manager' },
  { id: 3, full_name: 'Ana Silva', role: 'manager' },
]
