import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { ApiKeyCreateModal } from '../ApiKeyCreateModal'
import { ApiKeyRevealModal } from '../ApiKeyRevealModal'
import type { ApiKeyWithSecret } from '@/types'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

const LABEL = {
  iot: /Send sensor readings/,
  read: /Read work orders, assets, locations and parts/,
  write: /Also create and change work orders and assets/,
}
const box = (scope: keyof typeof LABEL) => screen.getByRole('checkbox', { name: LABEL[scope] })

beforeEach(() => setLanguage('en', false))

describe('ApiKeyCreateModal: scopes', () => {
  it('starts with only sensor readings ticked, as a gateway key needs', () => {
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    expect(box('iot')).toBeChecked()
    expect(box('read')).not.toBeChecked()
    expect(box('write')).not.toBeChecked()
    expect(screen.queryByText(/Anyone with this key can change/)).not.toBeInTheDocument()
  })

  it('ticking write ticks and locks read, and warns that the key can change things', async () => {
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    await userEvent.click(box('write'))

    expect(box('write')).toBeChecked()
    expect(box('read')).toBeChecked()
    expect(box('read')).toBeDisabled()
    expect(box('read')).toHaveAccessibleDescription(/Needed by the choice below/)
    expect(screen.getByText('Anyone with this key can change work orders and assets. Keep it secret.')).toBeInTheDocument()
  })

  it('unticking write frees read again, and unticking read unticks write', async () => {
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    await userEvent.click(box('write'))
    await userEvent.click(box('write'))
    expect(box('write')).not.toBeChecked()
    expect(box('read')).toBeChecked()
    expect(box('read')).toBeEnabled()

    await userEvent.click(box('write'))
    expect(box('write')).toBeChecked()
    // read is locked while write is on: it cannot be unticked first
    await userEvent.click(box('read'))
    expect(box('write')).toBeChecked()
  })

  it('refuses a key that may do nothing, and says so', async () => {
    let sent = false
    server.use(http.post('/api/v1/api_keys', () => { sent = true; return HttpResponse.json({}) }))
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Name *'), 'Nothing')
    await userEvent.click(box('iot'))
    await userEvent.click(screen.getByRole('button', { name: 'Create API Key' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one thing the key may do.')
    expect(sent).toBe(false)
  })

  it('sends exactly the ticked scopes, in a fixed order, and none of the old names', async () => {
    let body: { api_key?: { name?: string; scopes?: string[] } } = {}
    server.use(http.post('/api/v1/api_keys', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json({ data: { id: 9, name: 'n8n', key: 'fxk_secret', active: true, organization_id: 1, created_at: '', scopes: body.api_key?.scopes } })
    }))
    const onCreated = vi.fn()
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={onCreated} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Name *'), 'n8n')
    await userEvent.click(box('write'))
    await userEvent.click(box('iot'))
    await userEvent.click(screen.getByRole('button', { name: 'Create API Key' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(body.api_key).toMatchObject({ name: 'n8n', scopes: ['read', 'write'] })
    expect(JSON.stringify(body)).not.toMatch(/iot_write|iot_read/)
  })

  it('sends the default scope for a gateway key', async () => {
    let scopes: string[] = []
    server.use(http.post('/api/v1/api_keys', async ({ request }) => {
      scopes = ((await request.json()) as { api_key: { scopes: string[] } }).api_key.scopes
      return HttpResponse.json({ data: { id: 1, name: 'g', key: 'fxk_x', active: true, organization_id: 1, created_at: '' } })
    }))
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Name *'), 'Gateway')
    await userEvent.click(screen.getByRole('button', { name: 'Create API Key' }))

    await waitFor(() => expect(scopes).toEqual(['iot']))
  })

  it('is worded in Spanish', () => {
    setLanguage('es', false)
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    expect(screen.getByRole('group', { name: 'Qué puede hacer esta clave' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Enviar lecturas de sensores/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /También crear y modificar órdenes de trabajo y activos/ })).toBeInTheDocument()
  })
})

describe('ApiKeyRevealModal: the first call', () => {
  const base: ApiKeyWithSecret = { id: 1, name: 'n8n', prefix: 'fxk_ab12cd34', key: 'fxk_ab12cd34secretsecret', active: true, organization_id: 1, created_at: '2026-11-01T00:00:00Z' }

  it('shows a curl line with the key and this address for a key that reads', () => {
    render(<ApiKeyRevealModal open apiKey={{ ...base, scopes: ['read'] }} onClose={() => {}} />, { wrapper })

    const line = screen.getByText((_, el) => el?.tagName === 'PRE' && /\/api\/v1\/open\/me/.test(el.textContent ?? '') && /Authorization: Bearer fxk_ab12cd34secretsecret/.test(el.textContent ?? ''))
    expect(line.textContent).toContain(`curl ${window.location.origin}/api/v1/open/me`)
    expect(screen.queryByText('POST /api/v1/iot/ingest')).not.toBeInTheDocument()
  })

  it('says how to send the key, and where never to', () => {
    render(<ApiKeyRevealModal open apiKey={{ ...base, scopes: ['read', 'write'] }} onClose={() => {}} />, { wrapper })

    expect(screen.getByText(/X-API-Key header\. Never in the address/)).toBeInTheDocument()
  })

  it('keeps the sensor examples for a sensor key, and does not show the public API one', () => {
    render(<ApiKeyRevealModal open apiKey={{ ...base, scopes: ['iot'] }} onClose={() => {}} />, { wrapper })

    expect(screen.getByText('POST /api/v1/iot/ingest')).toBeInTheDocument()
    expect(screen.getAllByText(/MQTT/).length).toBeGreaterThan(0)
    expect(screen.queryByText('GET /api/v1/open/me')).not.toBeInTheDocument()
  })

  it('shows both when the key does both, and the key can be copied', () => {
    render(<ApiKeyRevealModal open apiKey={{ ...base, scopes: ['iot', 'read'] }} onClose={() => {}} />, { wrapper })

    expect(screen.getByText('GET /api/v1/open/me')).toBeInTheDocument()
    expect(screen.getByText('POST /api/v1/iot/ingest')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getAllByRole('button', { name: /copy/i }).length).toBeGreaterThan(0)
  })
})
