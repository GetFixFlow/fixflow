import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { twoFactorApi } from '@/api/twoFactor'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

/** The server's reason, or the fallback. */
export function twoFactorMessage(error: unknown, fallback: string): string {
  const data = (error as AxiosError<{ error?: { message?: string } | string }>).response?.data
  return typeof data?.error === 'string' ? data.error : (data?.error?.message ?? fallback)
}

export function useTwoFactorStatus() {
  return useQuery({ queryKey: ['two-factor'], queryFn: twoFactorApi.status })
}

/** After switching it on or off: the status, and the signed-in person's own record (the set-up screen depends on it). */
function useRefreshAfterChange() {
  const qc = useQueryClient()
  const { updateUser } = useAuthStore()

  return async (enabled: boolean) => {
    updateUser({ two_factor_enabled: enabled, two_factor_setup_required: false })
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['two-factor'] }),
      qc.invalidateQueries({ queryKey: ['me'] }),
      authApi.me().then((r) => updateUser(r.data)).catch(() => undefined),
    ])
  }
}

export function useStartTwoFactor() {
  return useMutation({ mutationFn: twoFactorApi.start })
}

export function useConfirmTwoFactor() {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: twoFactorApi.confirm,
    onSuccess: () => refresh(true),
  })
}

export function useDisableTwoFactor() {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: ({ password, code }: { password: string; code: string }) => twoFactorApi.disable(password, code),
    onSuccess: () => refresh(false),
  })
}

export function useNewRecoveryCodes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ password, code }: { password: string; code: string }) => twoFactorApi.newRecoveryCodes(password, code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['two-factor'] }),
  })
}
