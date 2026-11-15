import { apiClient } from './client'

export interface Holiday {
  date: string
  name: string
  repeating?: boolean
}

/** A site's calendar: what it sets of its own (a key it leaves out follows the company), or what is in force. */
export interface SiteCalendar {
  timezone?: string
  work_hours?: { start: string; end: string }
  work_days?: number[]
  holidays?: Holiday[]
}

export interface SitePerson {
  id: number
  full_name: string
  role: string
}

/** A site: a top-level place of type site. */
export interface Site {
  id: number
  name: string
  /** What the site sets of its own. */
  settings: SiteCalendar
  /** What is in force at the site: its own over the company's. */
  effective: Required<SiteCalendar>
  assets: number
  open_work_orders: number
  /** How many places (buildings, rooms...) are inside it. */
  places: number
  /** Who works there (only managers and administrators are sent this). */
  people: SitePerson[]
}

export interface SitesResponse {
  /** Sites are off until an administrator switches them on. */
  enabled: boolean
  sites: Site[]
  /** The company's calendar, which a site follows where it sets nothing. */
  company: Required<SiteCalendar>
  /** The sites this person is assigned to (none for an administrator). */
  my_site_ids: number[]
}

export interface SiteInput {
  name?: string
  settings?: SiteCalendar
}

/** One line of the sites side by side. */
export interface SiteRow {
  id: number | null
  name: string | null
  assets: number
  open_work_orders: number
  overdue_work_orders: number
  completed_work_orders: number
  total_cost: number
  people: number | null
  availability: number
  downtime_hours: number
  failures: number
}

export interface SitesReport {
  period: { from: string; to: string }
  sites: SiteRow[]
  /** What is in no site: shared by every site. */
  shared: SiteRow
  total: Omit<SiteRow, 'id' | 'name' | 'people' | 'availability'>
}

export const sitesApi = {
  list: () => apiClient.get<SitesResponse>('/sites'),
  enable: (enabled: boolean) => apiClient.put<SitesResponse>('/sites/enabled', { enabled }),
  create: (site: SiteInput) => apiClient.post<{ data: Site }>('/sites', { site }),
  update: (id: number, site: SiteInput) => apiClient.patch<{ data: Site }>(`/sites/${id}`, { site }),
  setPeople: (id: number, userIds: number[]) => apiClient.put<{ data: Site }>(`/sites/${id}/people`, { user_ids: userIds }),
  report: (params: { from?: string; to?: string }) => apiClient.get<{ data: SitesReport }>('/reports/sites', { params }),
}
