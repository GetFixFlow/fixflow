import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { LoginPage } from '@/pages/auth/LoginPage'
import { authApi } from '@/api'

vi.mock('@/api', () => ({
  authApi: { setupStatus: vi.fn(), login: vi.fn(), register: vi.fn() },
}))

const useNavigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => useNavigateMock }
})

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: false })
  })

  it('renders email and password fields', () => {
    render(<LoginPage />, { wrapper })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows validation errors on empty submit', async () => {
    render(<LoginPage />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/valid email required/i)).toBeInTheDocument()
    })
  })

  it('shows password validation error', async () => {
    render(<LoginPage />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), 'user@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })
  it('links to forgot password', () => {
    render(<LoginPage />, { wrapper })
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute('href', '/forgot-password')
  })

  it('does not offer public sign-up', () => {
    render(<LoginPage />, { wrapper })
    expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
    expect(screen.getByText(/ask your administrator/i)).toBeInTheDocument()
  })

  it('sends the first visitor of a new install to setup', async () => {
    vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: true })
    render(
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/setup" element={<div>setup screen</div>} />
      </Routes>,
      { wrapper },
    )
    expect(await screen.findByText('setup screen')).toBeInTheDocument()
  })
})
