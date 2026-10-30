import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMEditPage } from '../PMEditPage'
import { useAuthStore } from '@/stores/authStore'

const meta = { request_id: 'test', timestamp: '' }
const pump = { id: 7, name: 'Pump 7', asset_tag: 'FF-000007', status: 'operational', organization_id: 1, created_at: '', updated_at: '' }
const checklist = [{ step: 1, instruction: 'Drain the oil', required: true }]
const pm = {
  id: 5, name: 'Oil change', description: 'Every so often', status: 'active', priority: 'medium', frequency_type: 'meter_based',
  frequency_value: 250, frequency_unit: 'hours', start_date: '2026-10-01', end_date: null, next_due_at: null, next_due_reading: 4370.5,
  meter: { id: 3, name: 'Running hours', unit: 'hours', reading: 4120.5 }, asset: { id: 7, name: 'Pump 7', asset_tag: 'FF-000007' },
  template: { title: '{asset_name}: oil change', description: 'Use 10W-40', checklist }, created_at: '', updated_at: '',
}

describe('editing a schedule', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/preventive_maintenances/5', () => HttpResponse.json({ data: pm, executions: [], meta })),
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [pump], meta })),
      http.get('/api/v1/assets/7/meters', () => HttpResponse.json({
        meters: [{ id: 3, asset_id: 7, name: 'Running hours', unit: 'hours', reading: 4120.5, sensor_metric: null, last_reading_at: null }],
      })),
      http.get('/api/v1/locations', () => HttpResponse.json({ locations: [], meta })),
      http.get('/api/v1/parts', () => HttpResponse.json({ parts: [], meta })),
    )
  })

  it('loads the template the server keeps, and sends it back with the meter when saved', async () => {
    let body: Record<string, any> | undefined
    server.use(http.patch('/api/v1/preventive_maintenances/5', async ({ request }) => {
      body = (await request.json()) as Record<string, any>
      return HttpResponse.json({ data: pm, meta })
    }))
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/preventive-maintenance/5/edit']}>
          <Routes><Route path="/preventive-maintenance/:id/edit" element={<PMEditPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByDisplayValue('{asset_name}: oil change')).toBeInTheDocument()
    expect(await screen.findByLabelText('Meter')).toHaveValue('3')
    const every = screen.getByLabelText('Every')
    await userEvent.tripleClick(every)
    await userEvent.keyboard('300')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.preventive_maintenance).toMatchObject({
      frequency_type: 'meter_based', frequency_value: 300, meter_id: 3,
      template: { title: '{asset_name}: oil change', description: 'Use 10W-40', checklist },
    })
    expect(body!.preventive_maintenance).not.toHaveProperty('frequency_unit')
  })
})
