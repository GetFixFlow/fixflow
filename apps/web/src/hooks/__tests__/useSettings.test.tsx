import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChangePassword } from '../useSettings'
import { settingsApi } from '@/api/settings'

const navigate = vi.hoisted(() => vi.fn())
const clearAuth = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))
vi.mock('@/api/settings', () => ({
  settingsApi: { profile: { changePassword: vi.fn(), update: vi.fn(), get: vi.fn() } },
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { clearAuth: () => void; updateUser: () => void }) => unknown) =>
    selector({ clearAuth, updateUser: vi.fn() }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const passwords = { current_password: 'old-pass-1', password: 'new-pass-123', password_confirmation: 'new-pass-123' }

describe('useChangePassword', () => {
  beforeEach(() => {
    navigate.mockClear()
    clearAuth.mockClear()
    vi.mocked(settingsApi.profile.changePassword).mockReset()
  })

  it('signs the user out and goes to sign-in, because the server revokes every token', async () => {
    vi.mocked(settingsApi.profile.changePassword).mockResolvedValue({} as never)
    const { result } = renderHook(() => useChangePassword(), { wrapper })

    result.current.mutate(passwords)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
    expect(clearAuth).toHaveBeenCalled()
  })

  it('stays signed in when the change is rejected', async () => {
    vi.mocked(settingsApi.profile.changePassword).mockRejectedValue({
      response: { data: { error: { message: 'Current password is invalid' } } },
    })
    const { result } = renderHook(() => useChangePassword(), { wrapper })

    result.current.mutate(passwords)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(clearAuth).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
