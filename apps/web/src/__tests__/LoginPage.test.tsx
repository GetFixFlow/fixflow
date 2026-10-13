import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { LoginPage } from '@/pages/auth/LoginPage'
import { authApi } from '@/api'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'

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

  it("shows the company's logo, headline and subtitle from Settings, Branding", async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({
      branding: {
        name: 'Acme Corp', logo_url: '/api/v1/storage/x/logo.png', favicon_url: null, primary_color: '#16a34a',
        login_headline: 'Acme Maintenance', login_subtitle: 'Sign in with your work email',
      },
    })))
    render(<LoginPage />, { wrapper })

    expect(await screen.findByRole('heading', { name: 'Acme Maintenance' })).toBeInTheDocument()
    expect(screen.getByText('Sign in with your work email')).toBeInTheDocument()
    expect(screen.getByAltText('Acme Corp')).toHaveAttribute('src', '/api/v1/storage/x/logo.png')
  })

  it('shows the usual text until the branding has loaded, or if it cannot', async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({}, { status: 500 })))
    render(<LoginPage />, { wrapper })

    expect(screen.getByRole('heading', { name: 'Sign in to FixFlow' })).toBeInTheDocument()
    expect(screen.getByText('Enter your credentials to continue')).toBeInTheDocument()
  })
})
