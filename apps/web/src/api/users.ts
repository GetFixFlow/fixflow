import { apiClient } from './client'
import type { User, Role, InvitePayload, InviteResult } from '@/types'

export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ users: User[]; meta: unknown }>('/users', { params }),

  get: (id: number) => apiClient.get<{ user: User }>(`/users/${id}`),

  invite: (data: InvitePayload) => apiClient.post<InviteResult>('/users/invite', { user: data }),

  resendInvitation: (id: number, sendEmail = false) =>
    apiClient.post<InviteResult>(`/users/${id}/resend_invitation`, { user: { send_welcome: sendEmail } }),

  update: (id: number, data: Partial<User>) =>
    apiClient.patch<{ user: User }>(`/users/${id}`, { user: data }),

  changeRole: (id: number, role: Role) =>
    apiClient.patch<{ user: User }>(`/users/${id}/role`, { role }),

  deactivate: (id: number) => apiClient.patch(`/users/${id}/deactivate`),

  reactivate: (id: number) => apiClient.patch(`/users/${id}/reactivate`),

  resetPassword: (id: number) => apiClient.post(`/users/${id}/reset_password`),

  bulkChangeRole: (ids: number[], role: Role) =>
    apiClient.patch('/users/bulk_role', { ids, role }),

  bulkDeactivate: (ids: number[]) =>
    apiClient.patch('/users/bulk_deactivate', { ids }),
}
