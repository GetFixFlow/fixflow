import { apiClient } from './client'
import type { User } from '@/types'

/** What the sign-in screen offers, to anyone: a button for the company's account and a username field. */
export interface DirectoryOptions {
  oidc: { enabled: boolean; label: string }
  ldap: { enabled: boolean }
}

export type DirectoryRole = 'admin' | 'manager' | 'technician' | 'requester'

/** What an administrator sees. The two secrets are never sent back, only whether they are set. */
export interface DirectoryForm {
  oidc_enabled: boolean
  oidc_label: string
  oidc_issuer: string | null
  oidc_client_id: string | null
  oidc_scopes: string
  oidc_groups_claim: string
  oidc_trust_email: boolean
  ldap_enabled: boolean
  ldap_host: string | null
  ldap_port: number
  ldap_encryption: 'none' | 'starttls' | 'ssl'
  ldap_verify_certificate: boolean
  ldap_ca_certificate: string | null
  ldap_bind_dn: string | null
  ldap_user_base: string | null
  ldap_user_filter: string
  ldap_login_attributes: string
  ldap_email_attribute: string
  ldap_first_name_attribute: string
  ldap_last_name_attribute: string
  ldap_id_attribute: string
  ldap_groups_attribute: string
  ldap_group_base: string | null
  create_people: boolean
  sync_roles: boolean
  default_role: DirectoryRole | null
  /** The groups that give each role. */
  role_groups: Partial<Record<DirectoryRole, string[]>>
  oidc_secret_set: boolean
  ldap_password_set: boolean
  roles: DirectoryRole[]
}

/** What is sent to save: the form, with the secrets when one was typed (blank keeps the saved one) and each role's groups as text, one per line. */
export type DirectoryChanges = Partial<Omit<DirectoryForm, 'role_groups' | 'oidc_secret_set' | 'ldap_password_set' | 'roles'>> & {
  oidc_client_secret?: string
  ldap_bind_password?: string
  role_groups?: Partial<Record<DirectoryRole, string | string[]>>
}

export interface DirectorySettingsResponse {
  settings: DirectoryForm
  /** The address to register with the identity provider as the redirect address. */
  callback_url: string
}

export interface OidcCheck {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string | null
  keys: number
  redirect_uri: string
  pkce: boolean
}

export interface LdapCheck {
  host: string
  port: number
  encryption: string
  people_found: number
  more_than_listed: boolean
  person?: { found: false } | { found: true; email: string; first_name: string; last_name: string; groups: string[]; role: DirectoryRole | null }
}

const bearer = (header: unknown) => String(header ?? '').replace(/^Bearer /, '')

export const directoryApi = {
  /** Public: what the sign-in screen offers. */
  options: () => apiClient.get<DirectoryOptions>('/auth/directory').then((r) => r.data),

  /** The last step of signing in through the company account: the note the server handed the browser, for a session. */
  exchange: (code: string): Promise<{ user: User; token: string }> =>
    apiClient
      .post<{ message: string; user: User }>('/auth/directory', { code })
      .then((response) => ({ user: response.data.user, token: bearer(response.headers['authorization']) })),

  /** Where the browser goes to start signing in through the company account. */
  startUrl: () => `${apiClient.defaults.baseURL ?? '/api/v1'}/auth/oidc/start`,

  get: () => apiClient.get<DirectorySettingsResponse>('/directory_settings').then((r) => r.data),
  update: (settings: DirectoryChanges) => apiClient.patch<DirectorySettingsResponse>('/directory_settings', { settings }).then((r) => r.data),
  remove: () => apiClient.delete<DirectorySettingsResponse>('/directory_settings').then((r) => r.data),
  /** Tries the settings given (over the saved ones) without saving. For LDAP, a person's login and password show what the directory says about them. */
  test: (kind: 'oidc' | 'ldap', settings: DirectoryChanges, person?: { login: string; password: string }) =>
    apiClient.post<OidcCheck & LdapCheck>('/directory_settings/test', { kind, settings, ...person }).then((r) => r.data),
}
