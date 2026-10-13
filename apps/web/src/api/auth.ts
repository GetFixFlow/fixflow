import { apiClient } from './client'
import type { InvitationDetails, LoginPayload, RegisterPayload, User } from '@/types'

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient
      .post<{ message: string; user: User }>('/auth/sign_in', { user: payload })
      .then((response) => ({
        user: response.data.user,
        token: response.headers['authorization']?.replace(/^Bearer /, '') ?? '',
      })),

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
