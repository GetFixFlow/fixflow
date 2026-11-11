import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { IoTSettingsPage } from '../IoTSettingsPage'
import { useAuthStore } from '@/stores/authStore'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

function renderPage() {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><IoTSettingsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('IoTSettingsPage: what a screen reader announces for the icon buttons', () => {
  it('names each key\'s menu button after the key, and says whether the menu is open', async () => {
    server.use(http.get('/api/v1/api_keys', () => HttpResponse.json({
      api_keys: [{ id: 3, name: 'Gateway', prefix: 'fxk_ab12cd34', scopes: ['iot'], status: 'active', created_at: '2026-11-01T00:00:00Z', last_used_at: null, expires_at: null }],
      meta: { request_id: 't', timestamp: '' },
    })))
    renderPage()

    const menu = await screen.findByRole('button', { name: 'Actions for Gateway' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
  })

  it('names the copy buttons of the connection settings by what they copy', async () => {
    server.use(http.get('/api/v1/api_keys', () => HttpResponse.json({ api_keys: [], meta: { request_id: 't', timestamp: '' } })))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'MQTT Configuration' }))

    expect(screen.getByRole('button', { name: 'Copy host' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy username' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy organization token' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy topic pattern' })).toBeInTheDocument()
  })
})
