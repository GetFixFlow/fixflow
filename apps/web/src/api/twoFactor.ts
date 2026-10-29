import { apiClient } from './client'

export interface TwoFactorStatus {
  enabled: boolean
  enabled_at: string | null
  recovery_codes_left: number
  /** The company requires everyone to sign in with an authenticator app. */
  required_by_company: boolean
}

/** What a new secret looks like to an authenticator app: scan the address as a QR code, or type the key. */
export interface TwoFactorSetup {
  secret: string
  otpauth_uri: string
}

export const twoFactorApi = {
  status: () => apiClient.get<{ two_factor: TwoFactorStatus }>('/profile/two_factor').then((r) => r.data.two_factor),

  start: () => apiClient.post<{ two_factor: TwoFactorStatus; setup: TwoFactorSetup }>('/profile/two_factor').then((r) => r.data.setup),

  confirm: (code: string) =>
    apiClient.post<{ two_factor: TwoFactorStatus; recovery_codes: string[] }>('/profile/two_factor/confirm', { code }).then((r) => r.data),

  disable: (password: string, code: string) =>
    apiClient.delete<{ two_factor: TwoFactorStatus }>('/profile/two_factor', { data: { password, code } }).then((r) => r.data),

  newRecoveryCodes: (password: string, code: string) =>
    apiClient
      .post<{ two_factor: TwoFactorStatus; recovery_codes: string[] }>('/profile/two_factor/recovery_codes', { password, code })
      .then((r) => r.data),
}
