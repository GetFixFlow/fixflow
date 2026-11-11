import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api'
import { directoryApi } from '@/api/directory'
import { useAuthStore } from '@/stores/authStore'
import { queryClient } from '@/lib/queryClient'
import { t } from '@/i18n'
import type { LoginPayload, RegisterPayload, User } from '@/types'

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: isAuthenticated,
  })
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: () => authApi.setupStatus(),
    staleTime: 60_000,
    retry: false,
  })
}

export function useInvitation(token: string | null) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => authApi.invitation(token as string),
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvitation(token: string) {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: { password: string; password_confirmation: string }) =>
      authApi.acceptInvitation(token, payload),
    onSuccess: () => {
      toast.success(t('auth.toast.password_set'))
      navigate('/login')
    },
    onError: (error: AxiosError<{ errors?: string[] }>) => {
      toast.error(error.response?.data?.errors?.[0] ?? t('auth.toast.password_set_failed'))
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onError: () => toast.error(t('auth.toast.request_failed')),
  })
}

export function useResetPassword() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: Parameters<typeof authApi.resetPassword>[0]) => authApi.resetPassword(payload),
    onSuccess: () => {
      toast.success(t('auth.toast.password_changed'))
      navigate('/login')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('auth.toast.password_change_failed')),
  })
}

/** Signed in: keep the token, greet, and go on (to the set-up screen first when the company requires two-factor). */
function useFinishSignIn() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return ({ token, user }: { token: string; user: User }) => {
    setAuth(user, token)
    toast.success(t('auth.toast.welcome', { name: user.full_name }))
    navigate(user.two_factor_setup_required ? '/two-factor-setup' : '/dashboard')
  }
}

/** `onChallenge` is called when the password was right but a code from the authenticator app is needed too. */
export function useLogin({ onChallenge }: { onChallenge?: (challenge: string) => void } = {}) {
  const finish = useFinishSignIn()

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (result) => (result.twoFactor ? onChallenge?.(result.challenge) : finish(result)),
    onError: (error: AxiosError<{ error?: string }>) =>
      toast.error(error.response?.data?.error ?? t('auth.toast.invalid_credentials')),
  })
}

/** The last step of signing in through the company account: swap the one-use note the server handed the browser for a session. */
export function useDirectoryExchange() {
  const finish = useFinishSignIn()

  return useMutation({
    mutationFn: (code: string) => directoryApi.exchange(code),
    onSuccess: finish,
  })
}

export function useVerifyTwoFactor() {
  const finish = useFinishSignIn()

  return useMutation({
    mutationFn: ({ challenge, code }: { challenge: string; code: string }) => authApi.verifyTwoFactor(challenge, code),
    onSuccess: finish,
    // The message comes from the server: a wrong code, too many wrong codes, or a challenge that has run out.
    onError: (error: AxiosError<{ error?: string }>) => toast.error(error.response?.data?.error ?? t('auth.toast.code_failed')),
  })
}

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: () => {
      queryClient.setQueryData(['setup-status'], { setup_required: false })
      toast.success(t('auth.toast.setup_complete'))
      navigate('/login')
    },
    onError: (error: AxiosError<{ errors?: string[] }>) => {
      const message = error.response?.data?.errors?.[0]
      toast.error(message ?? t('auth.toast.setup_failed'))
      // Someone else finished setup first: the setup screen no longer applies.
      if (error.response?.status === 403) {
        queryClient.setQueryData(['setup-status'], { setup_required: false })
        navigate('/login')
      }
    },
  })
}

export function useLogout() {
  const { clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login')
    },
  })
}
