import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { Sidebar } from '../Sidebar'

const mount = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter><Sidebar /></MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
})

describe('Sidebar branding', () => {
  it("shows the company's logo in place of the FixFlow name", async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({
      branding: { name: 'Acme Corp', logo_url: '/api/v1/storage/x/logo.png', favicon_url: null, primary_color: '#2563eb', login_headline: 'x', login_subtitle: '' },
    })))
    mount()

    expect(await screen.findByAltText('Acme Corp')).toHaveAttribute('src', '/api/v1/storage/x/logo.png')
    expect(screen.queryByText('FixFlow')).not.toBeInTheDocument()
  })

  it('shows the FixFlow mark and name when there is no logo', async () => {
    mount()

    expect(await screen.findByText('FixFlow')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
