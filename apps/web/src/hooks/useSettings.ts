import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { settingsApi } from '@/api/settings'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => settingsApi.profile.get().then((r) => r.data.user),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const updateUser = useAuthStore((s) => s.updateUser)
  return useMutation({
    mutationFn: settingsApi.profile.update,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      updateUser(res.data.user)
      toast.success('Profile updated.')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Failed to update profile.'),
  })
}

export function useChangePassword() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  return useMutation({
    mutationFn: settingsApi.profile.changePassword,
    // The server signs the user out everywhere, this session included, so go to sign-in.
    onSuccess: () => {
      toast.success('Password changed. Please sign in again.')
      clearAuth()
      queryClient.clear()
      navigate('/login')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Failed to change password.'),
  })
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => settingsApi.sessions.list().then((r) => r.data.sessions),
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.sessions.revoke,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session revoked.')
    },
  })
}

export function useRevokeAllSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.sessions.revokeAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('All other sessions revoked.')
    },
  })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification_preferences'],
    queryFn: () => settingsApi.notifications.get().then((r) => r.data.preferences),
  })
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.notifications.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification_preferences'] })
      toast.success('Preferences saved.')
    },
  })
}

export function useOrgSettings() {
  return useQuery({
    queryKey: ['org_settings'],
    queryFn: () => settingsApi.organization.get().then((r) => r.data.organization),
  })
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.organization.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org_settings'] })
      toast.success('Settings saved.')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Failed to save settings.'),
  })
}

/** Public, so the sign-in page can use it too. Falls back to the defaults (the app still works) if it cannot load. */
export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: () => settingsApi.branding.get().then((r) => r.data.branding),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateBranding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.branding.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding'] })
      toast.success('Branding saved.')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Could not save the branding.'),
  })
}

export function useEmailSettings() {
  return useQuery({
    queryKey: ['email_settings'],
    queryFn: () => settingsApi.email.get().then((r) => r.data.smtp),
  })
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.email.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_settings'] })
      toast.success('Email settings saved.')
    },
  })
}

export function useTestEmail() {
  return useMutation({
    mutationFn: settingsApi.email.test,
    onSuccess: () => toast.success('Test email sent!'),
    onError: () => toast.error('Failed to send test email.'),
  })
}

export function useLocalization() {
  return useQuery({
    queryKey: ['localization'],
    queryFn: () => settingsApi.localization.get().then((r) => r.data.localization),
  })
}

export function useUpdateLocalization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.localization.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['localization'] })
      toast.success('Localization saved.')
    },
  })
}
