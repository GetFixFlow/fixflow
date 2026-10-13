import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { usersApi } from '@/api/users'
import type { Role } from '@/types'

function failureMessage(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) =>
    toast.error(error.response?.data?.error?.message ?? fallback)
}

export function useUsers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.list(params).then((r) => r.data.users),
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.invite,
    // The invite dialog shows the result (and the link to copy), so no toast here.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Could not create the invitation.'),
  })
}

export function useResendInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => usersApi.resendInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: () => toast.error('Could not create a new invitation link.'),
  })
}

export function useUpdateUser(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof usersApi.update>[1]) => usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated.')
    },
    onError: failureMessage('Could not update the user.'),
  })
}

export function useChangeUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => usersApi.changeRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Role updated.')
    },
    onError: failureMessage('Could not change the role.'),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated.')
    },
    onError: failureMessage('Could not deactivate the user.'),
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.reactivate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User reactivated.')
    },
    onError: failureMessage('Could not reactivate the user.'),
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: usersApi.resetPassword,
    onError: failureMessage('Could not create a reset link.'),
  })
}

export function useBulkChangeRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, role }: { ids: number[]; role: Role }) => usersApi.bulkChangeRole(ids, role),
    onSuccess: (_, { ids }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Role updated for ${ids.length} user${ids.length !== 1 ? 's' : ''}.`)
    },
    onError: failureMessage('Could not change the roles. Nothing was changed.'),
  })
}

export function useBulkDeactivate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.bulkDeactivate,
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`${ids.length} user${ids.length !== 1 ? 's' : ''} deactivated.`)
    },
    onError: failureMessage('Could not deactivate the users. Nothing was changed.'),
  })
}

