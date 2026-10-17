import { apiClient } from './client'
import type { LocaleSettings } from '@/lib/localeFormat'
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
    list: () => apiClient.get<{ sessions: UserSession[] }>('/sessions'),
    revoke: (id: string) => apiClient.delete(`/sessions/${encodeURIComponent(id)}`),
    /** Ends every session but the one asking. */
    revokeAll: () => apiClient.delete<{ revoked: number }>('/sessions/all'),
  },

  notifications: {
    get: () => apiClient.get<{ preferences: NotificationPreferences }>('/notification_preferences'),
    update: (data: Partial<NotificationPreferences>) =>
      apiClient.patch<{ preferences: NotificationPreferences }>('/notification_preferences', { preferences: data }),
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
    get: () => apiClient.get<{ smtp: EmailStatus }>('/email_settings'),
    update: (data: SmtpSettings) => apiClient.patch<{ smtp: EmailStatus }>('/email_settings', { smtp: data }),
    /** Forget what was saved here, going back to the server's environment. */
    remove: () => apiClient.delete<{ smtp: EmailStatus }>('/email_settings'),
    /** Sends a message through these settings without saving them. */
    test: (data: SmtpSettings) => apiClient.post<{ success: boolean; message: string }>('/email_settings/test', { smtp: data }),
  },

  localization: {
    get: () => apiClient.get<{ localization: LocalizationSettings }>('/localization_settings'),
    update: (data: Partial<LocalizationSettings>) =>
      apiClient.patch('/localization_settings', { localization: data }),
  },
}

/** One place the signed-in person is signed in (a browser or phone). */
export interface UserSession {
  id: string
  /** "Chrome on macOS", worked out from the browser's own description. */
  device: string
  ip_address: string | null
  created_at: string
  last_active_at: string
  /** The session this request came from. */
  current: boolean
}

/** Which emails the signed-in person wants. Invitations and password reset links are not up to them. */
export interface NotificationPreferences {
  email_enabled: boolean
  rules: Record<string, { email: boolean }>
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
  /** What an hour of work costs when the person has no rate of their own. */
  labor_rate: number
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
  /** Whether the System Health page may ask GitHub for the latest release. */
  update_check: boolean
  /** Whether people with no account may send maintenance requests (the QR label's form). */
  public_requests_enabled: boolean
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
  /** Only ever sent to the server. The server says whether one is saved (password_set) but never returns it. */
  password: string
  from_address: string
  from_name: string
  encryption: 'none' | 'tls' | 'ssl'
}

/** What the server reports about the install's mail server. */
export interface EmailStatus extends Omit<SmtpSettings, 'password'> {
  password_set: boolean
  configured: boolean
  /** Where the working settings come from: saved here, the server's environment, or nowhere. */
  source: 'settings' | 'environment' | null
  environment_host: string | null
}

/** How dates, times, numbers and money are shown. Defined with the formatting code that uses it. */
export type LocalizationSettings = LocaleSettings
