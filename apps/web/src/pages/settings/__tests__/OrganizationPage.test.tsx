import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrganizationPage } from '../OrganizationPage'

vi.mock('@/hooks/useSettings', () => ({
  useOrgSettings: () => ({ data: null, isLoading: false }),
  useUpdateOrgSettings: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      role: 'admin',
      id: 1,
      full_name: 'Alice',
      email: 'alice@test.com',
      organization_id: 1,
    },
  }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OrganizationPage', () => {
  it('renders org details section', () => {
    render(<OrganizationPage />, { wrapper: Wrapper })
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText(/Organization Details/i)).toBeInTheDocument()
  })

  it('renders maintenance settings', () => {
    render(<OrganizationPage />, { wrapper: Wrapper })
    expect(screen.getByText(/Maintenance Settings/i)).toBeInTheDocument()
  })
})
