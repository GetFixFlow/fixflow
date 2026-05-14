import { apiClient } from './client'
import type { LoginPayload, RegisterPayload, User } from '@/types'

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<{ data: { token: string; user: User } }>('/users/sign_in', {
      user: payload,
    }),

  register: (payload: RegisterPayload) =>
    apiClient.post<{ data: User }>('/users', { user: payload }),

  logout: () => apiClient.delete('/users/sign_out'),

  me: () => apiClient.get<{ data: User }>('/users/me'),
}
