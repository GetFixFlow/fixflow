import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { directoryApi, type DirectoryChanges } from '@/api/directory'
import { t } from '@/i18n'

function failure(fallbackKey: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? t(fallbackKey))
}

/** Public: what the sign-in screen offers. Never blocks the screen: if it cannot be asked, only the password form shows. */
export function useDirectoryOptions() {
  return useQuery({ queryKey: ['directory-options'], queryFn: directoryApi.options, staleTime: 60_000, retry: false })
}

export function useDirectorySettings() {
  return useQuery({ queryKey: ['directory_settings'], queryFn: directoryApi.get })
}

export function useUpdateDirectorySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: DirectoryChanges) => directoryApi.update(settings),
    onSuccess: (data) => {
      qc.setQueryData(['directory_settings'], data)
      qc.invalidateQueries({ queryKey: ['directory-options'] })
      toast.success(t('directory.toast.saved'))
    },
    onError: failure('directory.toast.save_failed'),
  })
}

export function useRemoveDirectorySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: directoryApi.remove,
    onSuccess: (data) => {
      qc.setQueryData(['directory_settings'], data)
      qc.invalidateQueries({ queryKey: ['directory-options'] })
      toast.success(t('directory.toast.removed'))
    },
    onError: failure('directory.toast.remove_failed'),
  })
}

/** The page shows the outcome (and why it failed) next to the button, so no toast here. */
export function useTestDirectory() {
  return useMutation({
    mutationFn: ({ kind, settings, person }: { kind: 'oidc' | 'ldap'; settings: DirectoryChanges; person?: { login: string; password: string } }) =>
      directoryApi.test(kind, settings, person),
  })
}
