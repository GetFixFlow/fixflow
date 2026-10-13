import { apiClient } from './client'
import type { User } from '@/types'

export const settingsApi = {
  profile: {
    get: () => apiClient.get<{ user: User }>('/profile'),
    update: (data: { full_name?: string; phone?: string; job_title?: string; department?: string }) =>
      apiClient.patch<{ user: User }>('/profile', { user: data }),
    changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
      apiClient.patch('/profile/password', { user: data }),
  },

  sessions: {
    list: () =>
      apiClient.get<{
        sessions: Array<{
          id: string
          device: string
          location: string
          last_active_at: string
          current: boolean
        }>
      }>('/sessions'),
    revoke: (id: string) => apiClient.delete(`/sessions/${id}`),
    revokeAll: () => apiClient.delete('/sessions/all'),
  },

  notifications: {
    get: () => apiClient.get<{ preferences: NotificationPreferences }>('/notification_preferences'),
    update: (data: Partial<NotificationPreferences>) =>
      apiClient.patch('/notification_preferences', { preferences: data }),
  },

  organization: {
    get: () => apiClient.get<{ organization: OrgSettings }>('/organization_settings'),
    update: (data: Partial<OrgSettings>) =>
      apiClient.patch('/organization_settings', { organization: data }),
  },

  branding: {
    // Public: the sign-in page needs it before anyone has signed in.
    get: () => apiClient.get<{ branding: BrandingSettings }>('/branding'),
    update: (data: BrandingUpdate) => {
      const fd = new FormData()
      fd.append('branding[primary_color]', data.primary_color)
      fd.append('branding[login_headline]', data.login_headline)
      fd.append('branding[login_subtitle]', data.login_subtitle)
      if (data.logo) fd.append('branding[logo]', data.logo)
      if (data.favicon) fd.append('branding[favicon]', data.favicon)
      if (data.remove_logo) fd.append('branding[remove_logo]', 'true')
      if (data.remove_favicon) fd.append('branding[remove_favicon]', 'true')
      // No Content-Type header: the browser adds multipart/form-data with the boundary the server needs.
      return apiClient.patch<{ branding: BrandingSettings }>('/branding', fd)
    },
  },

  email: {
    get: () => apiClient.get<{ smtp: SmtpSettings }>('/email_settings'),
    update: (data: Partial<SmtpSettings>) =>
      apiClient.patch('/email_settings', { smtp: data }),
    test: () => apiClient.post<{ success: boolean; message: string }>('/email_settings/test'),
  },

  localization: {
    get: () => apiClient.get<{ localization: LocalizationSettings }>('/localization_settings'),
    update: (data: Partial<LocalizationSettings>) =>
      apiClient.patch('/localization_settings', { localization: data }),
  },
}

export interface NotificationPreferences {
  email_enabled: boolean
  push_enabled: boolean
  sound_enabled: boolean
  rules: Record<string, { email: boolean; push: boolean; in_app: boolean }>
  daily_digest: { enabled: boolean; send_at: string; include: Record<string, boolean> }
  weekly_report: { enabled: boolean; send_on: string; include: Record<string, boolean> }
}

export interface OrgSettings {
  name: string
  slug: string
  industry?: string
  size?: string
  website?: string
  address?: string
  default_priority: string
  default_due_days: number
  require_completion_notes: boolean
  auto_close_days: number
  wo_number_prefix: string
  pm_compliance_target: number
  pm_reminder_days: number
  pm_pause_on_down: boolean
  iot_alert_cooldown: number
  iot_stale_threshold: number
  iot_data_retention_days: number
  iot_auto_wo_threshold: string
  work_hours: { start: string; end: string }
  work_days: number[]
  holidays: Holiday[]
  timezone: string
}

export interface Holiday {
  date: string
  name: string
  repeating: boolean
}

export interface BrandingSettings {
  /** The company name, shown where a logo is not set. */
  name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  login_headline: string
  login_subtitle: string
}

export interface BrandingUpdate {
  primary_color: string
  login_headline: string
  login_subtitle: string
  logo?: File | null
  favicon?: File | null
  remove_logo?: boolean
  remove_favicon?: boolean
}

export interface SmtpSettings {
  host: string
  port: number
  username: string
  password: string
  from_address: string
  from_name: string
  encryption: 'none' | 'tls' | 'ssl'
  configured: boolean
}

export interface LocalizationSettings {
  language: string
  date_format: string
  time_format: '12h' | '24h'
  timezone: string
  currency: string
  first_day_of_week: 'monday' | 'sunday'
  number_format: string
}
