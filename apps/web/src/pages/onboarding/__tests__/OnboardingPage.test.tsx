import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnboardingPage } from '../OnboardingPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      full_name: 'Alice',
      email: 'alice@test.com',
      role: 'admin',
      organization_id: 1,
      id: 1,
    },
  }),
}))

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockReset()
})

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OnboardingPage', () => {
  it('shows welcome step by default', () => {
    render(<OnboardingPage />, { wrapper: Wrapper })
    expect(screen.getByText(/Welcome to FixFlow/i)).toBeInTheDocument()
  })

  it('advances to step 2 on Start Setup', () => {
    render(<OnboardingPage />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText(/Start Setup/i))
    expect(screen.getByText(/Tell us about your organization/i)).toBeInTheDocument()
  })

  it('shows skip setup link', () => {
    render(<OnboardingPage />, { wrapper: Wrapper })
    expect(screen.getByText(/Skip setup/i)).toBeInTheDocument()
  })

  it('clicking skip navigates to dashboard', () => {
    render(<OnboardingPage />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText(/Skip setup/i))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
