import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { queryClient } from '@/lib/queryClient'
import type { LoginPayload, RegisterPayload } from '@/types'

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

export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: ({ token, user }) => {
      setAuth(user, token)
      toast.success(`Welcome back, ${user.full_name}!`)
      navigate('/dashboard')
    },
    onError: (error: AxiosError<{ error?: string }>) =>
      toast.error(error.response?.data?.error ?? 'Invalid email or password.'),
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
