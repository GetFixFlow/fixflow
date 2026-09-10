import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
      updateUser((res as { data: { user: User } }).data.user)
      toast.success('Profile updated.')
    },
    onError: () => toast.error('Failed to update profile.'),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: settingsApi.profile.changePassword,
    onSuccess: () => toast.success('Password updated.'),
    onError: () => toast.error('Failed to update password. Check current password.'),
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
    onError: () => toast.error('Failed to save settings.'),
  })
}

export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: () => settingsApi.branding.get().then((r) => r.data.branding),
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
