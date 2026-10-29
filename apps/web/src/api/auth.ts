import { apiClient } from './client'
import type { InvitationDetails, LoginPayload, RegisterPayload, User } from '@/types'

export type SignInResult =
  | { twoFactor: true; challenge: string }
  | { twoFactor: false; user: User; token: string }

const bearer = (header: unknown) => String(header ?? '').replace(/^Bearer /, '')

export const authApi = {
  /** The password step. A person with two-factor sign-in on gets a challenge to send with the code, not a token. */
  login: (payload: LoginPayload): Promise<SignInResult> =>
    apiClient
      .post<{ message: string; user?: User; two_factor_required?: boolean; challenge?: string }>('/auth/sign_in', { user: payload })
      .then((response) =>
        response.data.two_factor_required && response.data.challenge
          ? { twoFactor: true as const, challenge: response.data.challenge }
          : { twoFactor: false as const, user: response.data.user as User, token: bearer(response.headers['authorization']) },
      ),

  /** The second step: the challenge from the password step, and a code from the app (or a recovery code). */
  verifyTwoFactor: (challenge: string, code: string): Promise<Extract<SignInResult, { twoFactor: false }>> =>
    apiClient
      .post<{ message: string; user: User }>('/auth/two_factor', { challenge, code })
      .then((response) => ({ twoFactor: false as const, user: response.data.user, token: bearer(response.headers['authorization']) })),

  setupStatus: () => apiClient.get<{ setup_required: boolean; email_configured?: boolean }>('/setup/status').then((r) => r.data),

  register: (payload: RegisterPayload) =>
    apiClient.post<{ message: string; user: User }>('/auth/sign_up', { user: payload }),

  invitation: (token: string) =>
    apiClient.get<InvitationDetails>(`/invitations/${encodeURIComponent(token)}`).then((r) => r.data),

  acceptInvitation: (token: string, payload: { password: string; password_confirmation: string }) =>
    apiClient.post(`/invitations/${encodeURIComponent(token)}/accept`, { user: payload }),

  forgotPassword: (email: string) =>
    apiClient.post<{ message: string }>('/auth/password', { user: { email } }).then((r) => r.data),

  resetPassword: (payload: { reset_password_token: string; password: string; password_confirmation: string }) =>
    apiClient.put<{ message: string }>('/auth/password', { user: payload }).then((r) => r.data),

  logout: () => apiClient.delete('/auth/sign_out'),

  me: () => apiClient.get<User>('/auth/me'),
}
