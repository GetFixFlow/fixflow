import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { AssetMeters } from '../AssetMeters'

const hours = { id: 3, asset_id: 7, name: 'Running hours', unit: 'hours', reading: 4120.5, sensor_metric: null, last_reading_at: '2026-10-29T10:00:00Z' }
const fed = { id: 4, asset_id: 7, name: 'Odometer', unit: 'km', reading: 88000, sensor_metric: 'odometer', last_reading_at: null }

function renderMeters(canManage: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AssetMeters assetId={7} canManage={canManage} /></QueryClientProvider>)
}

describe('the meters of an asset', () => {
  beforeEach(() => {
    server.use(http.get('/api/v1/assets/7/meters', () => HttpResponse.json({ meters: [hours, fed] })))
  })

  it('shows each meter with its reading, and says which one a sensor feeds', async () => {
    renderMeters(false)

    expect(await screen.findByText('Running hours')).toBeInTheDocument()
    expect(screen.getByText('4,120.5')).toBeInTheDocument()
    expect(screen.getByText('88,000')).toBeInTheDocument()
    expect(screen.getByText(/fed by the sensor “odometer”/)).toBeInTheDocument()
    expect(screen.getByText(/Not read yet/)).toBeInTheDocument()
  })

  it('lets a technician record a reading, but not add or delete a meter, or call a reading a reset', async () => {
    let body: Record<string, any> | undefined
    server.use(http.post('/api/v1/meters/3/readings', async ({ request }) => {
      body = (await request.json()) as Record<string, any>
      return HttpResponse.json({ data: {}, meter: hours }, { status: 201 })
    }))
    renderMeters(false)
    await screen.findByText('Running hours')

    expect(screen.queryByRole('button', { name: /add meter/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    await userEvent.click(screen.getAllByRole('button', { name: /record reading/i })[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
    await userEvent.type(within(dialog).getByLabelText(/new reading/i), '4130')
    await userEvent.type(within(dialog).getByLabelText(/note/i), 'End of shift')
    await userEvent.click(within(dialog).getByRole('button', { name: /save reading/i }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.reading).toMatchObject({ value: '4130', note: 'End of shift' })
    expect(body!.reading).not.toHaveProperty('reset')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the form open and the number as typed when the server refuses the reading', async () => {
    server.use(http.post('/api/v1/meters/3/readings', () =>
      HttpResponse.json({ error: { code: 'METER_READING_REFUSED', message: 'That is lower than the last reading' } }, { status: 422 })))
    renderMeters(false)
    await screen.findByText('Running hours')

    await userEvent.click(screen.getAllByRole('button', { name: /record reading/i })[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/new reading/i), '10')
    await userEvent.click(within(dialog).getByRole('button', { name: /save reading/i }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: /save reading/i })).not.toBeDisabled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/new reading/i)).toHaveValue(10)
  })

  it('lets a manager say the meter was replaced, and sends it as a reset', async () => {
    let body: Record<string, any> | undefined
    server.use(http.post('/api/v1/meters/3/readings', async ({ request }) => {
      body = (await request.json()) as Record<string, any>
      return HttpResponse.json({ data: {}, meter: hours }, { status: 201 })
    }))
    renderMeters(true)
    await screen.findByText('Running hours')

    await userEvent.click(screen.getAllByRole('button', { name: /record reading/i })[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/new reading/i), '2')
    await userEvent.click(within(dialog).getByRole('checkbox'))
    await userEvent.click(within(dialog).getByRole('button', { name: /save reading/i }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.reading).toMatchObject({ value: '2', reset: true })
  })

  it('lets a manager add a meter that starts where the machine stands', async () => {
    let body: Record<string, any> | undefined
    server.use(http.post('/api/v1/assets/7/meters', async ({ request }) => {
      body = (await request.json()) as Record<string, any>
      return HttpResponse.json({ data: hours }, { status: 201 })
    }))
    renderMeters(true)
    await screen.findByText('Running hours')

    await userEvent.click(screen.getByRole('button', { name: /add meter/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText('Name'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Cycles')
    await userEvent.clear(within(dialog).getByLabelText('Unit'))
    await userEvent.type(within(dialog).getByLabelText('Unit'), 'cycles')
    await userEvent.type(within(dialog).getByLabelText('Reading today'), '12000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add meter' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.meter).toMatchObject({ name: 'Cycles', unit: 'cycles', reading: '12000', sensor_metric: null })
  })

  it('says so when there are no meters, and who can add one', async () => {
    server.use(http.get('/api/v1/assets/7/meters', () => HttpResponse.json({ meters: [] })))
    renderMeters(false)

    expect(await screen.findByText('No meters yet')).toBeInTheDocument()
    expect(screen.getByText('A manager can add a meter to this asset.')).toBeInTheDocument()
  })

  it('shows the history of a meter', async () => {
    server.use(http.get('/api/v1/meters/3/readings', () => HttpResponse.json({ readings: [
      { id: 1, meter_id: 3, value: 4120.5, recorded_at: '2026-10-29T10:00:00Z', source: 'manual', reset: false, note: 'Starting reading', recorded_by: 'Dana Admin' },
      { id: 2, meter_id: 3, value: 5, recorded_at: '2026-10-28T10:00:00Z', source: 'sensor', reset: true, note: null, recorded_by: null },
    ] })))
    renderMeters(false)
    await screen.findByText('Running hours')

    await userEvent.click(screen.getAllByRole('button', { name: /history/i })[0])

    expect(await screen.findByText('Dana Admin')).toBeInTheDocument()
    expect(screen.getByText('4,120.5 hours')).toBeInTheDocument()
    expect(screen.getByText('5 hours (reset)')).toBeInTheDocument()
    expect(screen.getByText('Sensor')).toBeInTheDocument()
  })
})
