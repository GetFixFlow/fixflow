import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLogin } from '../useAuth'
import { authApi } from '@/api'

vi.mock('@/api', () => ({ authApi: { login: vi.fn(), register: vi.fn(), setupStatus: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('useLogin errors', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(authApi.login).mockReset()
  })

  it('tells a deactivated person why they cannot sign in', async () => {
    vi.mocked(authApi.login).mockRejectedValue({
      response: { data: { error: 'Your account has been deactivated. Contact your administrator.' } },
    })
    const { result } = renderHook(() => useLogin(), { wrapper })

    result.current.mutate({ email: 'dan@test.com', password: 'password123' })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Your account has been deactivated. Contact your administrator.'),
    )
  })

  it('falls back to a generic message when the server gives none', async () => {
    vi.mocked(authApi.login).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useLogin(), { wrapper })

    result.current.mutate({ email: 'a@b.com', password: 'password123' })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid email or password.'))
  })
})
