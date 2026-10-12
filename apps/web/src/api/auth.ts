import { apiClient } from './client'
import type { LoginPayload, RegisterPayload, User } from '@/types'

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient
      .post<{ message: string; user: User }>('/auth/sign_in', { user: payload })
      .then((response) => ({
        user: response.data.user,
        token: response.headers['authorization']?.replace(/^Bearer /, '') ?? '',
      })),

  setupStatus: () => apiClient.get<{ setup_required: boolean }>('/setup/status').then((r) => r.data),

  register: (payload: RegisterPayload) =>
    apiClient.post<{ message: string; user: User }>('/auth/sign_up', { user: payload }),

  logout: () => apiClient.delete('/auth/sign_out'),

  me: () => apiClient.get<User>('/auth/me'),
}
