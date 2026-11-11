import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { IoTSettingsPage } from '../IoTSettingsPage'
import { useAuthStore } from '@/stores/authStore'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const meta = { request_id: 't', timestamp: '' }
const key = (over: Record<string, unknown>) => ({ id: 1, name: 'Key', active: true, created_at: '2026-11-01T00:00:00Z', last_used_at: null, expires_at: null, ...over })

function renderPage() {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/settings/iot']}>
        <Routes>
          <Route path="/settings/iot" element={<IoTSettingsPage />} />
          <Route path="/settings/webhooks" element={<p>The webhooks page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => setLanguage('en', false))

describe('IoTSettingsPage: the keys', () => {
  it('shows the first characters of each key and what it may do', async () => {
    server.use(http.get('/api/v1/api_keys', () => HttpResponse.json({
      api_keys: [
        key({ id: 1, name: 'n8n', prefix: 'fxk_ab12cd34', scopes: ['read', 'write'] }),
        key({ id: 2, name: 'Dashboard', prefix: 'fxk_ef56ab78', scopes: ['read'] }),
        key({ id: 3, name: 'Gateway', prefix: 'fxk_99887766', scopes: ['iot'] }),
      ], meta,
    })))
    renderPage()

    const row = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement
    const n8n = await row('n8n')
    expect(within(n8n).getByText('fxk_ab12cd34…')).toBeInTheDocument()
    expect(within(n8n).getByText('Read and write')).toBeInTheDocument()
    expect(within(await row('Dashboard')).getByText('Read')).toBeInTheDocument()
    expect(within(await row('Gateway')).getByText('Sensor readings')).toBeInTheDocument()
  })

  it('shows a key from before scopes existed, which the server answers as iot, as a sensor key', async () => {
    server.use(http.get('/api/v1/api_keys', () => HttpResponse.json({
      api_keys: [key({ id: 4, name: 'Old gateway', prefix: 'fxk_01234567', scopes: ['iot'] }), key({ id: 5, name: 'Older', key_prefix: 'ff_ab12', scopes: ['iot_write'] }), key({ id: 6, name: 'None', prefix: 'fxk_aaaaaaaa', scopes: [] })], meta,
    })))
    renderPage()

    for (const name of ['Old gateway', 'Older', 'None']) {
      const tr = (await screen.findByText(name)).closest('tr') as HTMLElement
      expect(within(tr).getByText('Sensor readings')).toBeInTheDocument()
      expect(within(tr).queryByText('Read and write')).not.toBeInTheDocument()
    }
  })

  it('has a Webhooks tab that says they live under Settings, Webhooks and links there', async () => {
    server.use(http.get('/api/v1/api_keys', () => HttpResponse.json({ api_keys: [], meta })))
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Webhooks' }))

    expect(screen.queryByText(/Coming Soon/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Set them up under Settings, Webhooks/)).toBeInTheDocument()
    expect(screen.getByText(/API keys with the read or write scope/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Open Webhooks' })
    expect(link).toHaveAttribute('href', '/settings/webhooks')
    await userEvent.click(link)
    expect(screen.getByText('The webhooks page')).toBeInTheDocument()
  })

  it('words the new texts in Spanish', async () => {
    setLanguage('es', false)
    server.use(http.get('/api/v1/api_keys', () => HttpResponse.json({ api_keys: [key({ name: 'n8n', prefix: 'fxk_ab12cd34', scopes: ['write'] })], meta })))
    renderPage()

    const tr = (await screen.findByText('n8n')).closest('tr') as HTMLElement
    expect(within(tr).getByText('Leer y escribir')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Webhooks' }))
    expect(screen.getByRole('link', { name: 'Abrir Webhooks' })).toHaveAttribute('href', '/settings/webhooks')
  })
})
