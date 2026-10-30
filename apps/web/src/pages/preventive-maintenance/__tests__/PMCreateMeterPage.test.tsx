import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMCreatePage } from '../PMCreatePage'
import { useAuthStore } from '@/stores/authStore'

const meta = { request_id: 'test', timestamp: '' }
const pump = { id: 7, name: 'Pump 7', asset_tag: 'FF-000007', status: 'operational', organization_id: 1, created_at: '', updated_at: '' }

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/preventive-maintenance/new?asset_id=7']}><PMCreatePage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('creating a schedule', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [pump], meta })),
      http.get('/api/v1/assets/7', () => HttpResponse.json({ data: pump, meta })),
      http.get('/api/v1/locations', () => HttpResponse.json({ locations: [], meta })),
      http.get('/api/v1/assets/7/meters', () => HttpResponse.json({ meters: [] })),
    )
  })

  async function toSchedule() {
    await userEvent.type(screen.getByPlaceholderText(/monthly pump oil change/i), 'Oil change')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
  }

  it('sends what each work order is made from as the template, which is all the server reads', async () => {
    let body: Record<string, any> | undefined
    server.use(http.post('/api/v1/preventive_maintenances', async ({ request }) => {
      body = (await request.json()) as Record<string, any>
      return HttpResponse.json({ data: { id: 99 }, meta }, { status: 201 })
    }))
    renderPage()

    await toSchedule()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /create pm schedule/i }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.preventive_maintenance).toMatchObject({ name: 'Oil change', asset_id: 7, frequency_type: 'time_based', template: { title: 'Oil change' } })
    expect(body!.preventive_maintenance).not.toHaveProperty('title_template')
  })

  it('follows a meter of the asset: sends the meter and the interval, shows when it falls due, and needs a meter chosen', async () => {
    let body: Record<string, any> | undefined
    server.use(
      http.get('/api/v1/assets/7/meters', () => HttpResponse.json({
        meters: [{ id: 3, asset_id: 7, name: 'Running hours', unit: 'hours', reading: 4120.5, sensor_metric: null, last_reading_at: null }],
      })),
      http.post('/api/v1/preventive_maintenances', async ({ request }) => {
        body = (await request.json()) as Record<string, any>
        return HttpResponse.json({ data: { id: 99 }, meta }, { status: 201 })
      }),
    )
    renderPage()

    await toSchedule()
    await userEvent.click(screen.getByRole('button', { name: /meter-based/i }))
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()

    await userEvent.selectOptions(await screen.findByLabelText('Meter'), '3')
    const every = screen.getByLabelText('Every')
    await userEvent.tripleClick(every)
    await userEvent.keyboard('250')
    expect(screen.getByText(/reaches/)).toHaveTextContent('4,370.5 hours')

    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('At 4,370.5 hours')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /create pm schedule/i }))

    await waitFor(() => expect(body).toBeDefined())
    const sent = body!.preventive_maintenance
    expect(sent).toMatchObject({ frequency_type: 'meter_based', frequency_value: 250, meter_id: 3 })
    expect(sent).not.toHaveProperty('frequency_unit')
  })

  it('counts from the last service when it is given, and tells how to add a meter when the asset has none', async () => {
    server.use(http.get('/api/v1/assets/7/meters', () => HttpResponse.json({ meters: [] })))
    renderPage()

    await toSchedule()
    await userEvent.click(screen.getByRole('button', { name: /meter-based/i }))

    expect(await screen.findByText(/This asset has no meters yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the asset' })).toHaveAttribute('href', '/assets/7')
  })
})
