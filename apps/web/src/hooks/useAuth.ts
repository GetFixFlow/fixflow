import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { queryClient } from '@/lib/queryClient'
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
      toast.success('Password set. Please sign in.')
      navigate('/login')
    },
    onError: (error: AxiosError<{ errors?: string[] }>) => {
      toast.error(error.response?.data?.errors?.[0] ?? 'Could not set your password. Try again.')
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onError: () => toast.error('Could not send the request. Try again in a moment.'),
  })
}

export function useResetPassword() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: Parameters<typeof authApi.resetPassword>[0]) => authApi.resetPassword(payload),
    onSuccess: () => {
      toast.success('Password changed. Please sign in.')
      navigate('/login')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Could not change the password.'),
  })
}

/** Signed in: keep the token, greet, and go on (to the set-up screen first when the company requires two-factor). */
function useFinishSignIn() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return ({ token, user }: { token: string; user: User }) => {
    setAuth(user, token)
    toast.success(`Welcome back, ${user.full_name}!`)
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
      toast.error(error.response?.data?.error ?? 'Invalid email or password.'),
  })
}

export function useVerifyTwoFactor() {
  const finish = useFinishSignIn()

  return useMutation({
    mutationFn: ({ challenge, code }: { challenge: string; code: string }) => authApi.verifyTwoFactor(challenge, code),
    onSuccess: finish,
    // The message comes from the server: a wrong code, too many wrong codes, or a challenge that has run out.
    onError: (error: AxiosError<{ error?: string }>) => toast.error(error.response?.data?.error ?? 'Could not check the code. Try again.'),
  })
}

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: () => {
      queryClient.setQueryData(['setup-status'], { setup_required: false })
      toast.success('Setup complete! Please sign in.')
      navigate('/login')
    },
    onError: (error: AxiosError<{ errors?: string[] }>) => {
      const message = error.response?.data?.errors?.[0]
      toast.error(message ?? 'Setup failed. Please try again.')
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
