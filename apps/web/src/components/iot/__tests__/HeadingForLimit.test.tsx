import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import type { LimitForecast } from '@/api/ai'
import { HeadingForLimit } from '../HeadingForLimit'

const forecast = (over: Partial<LimitForecast> = {}): LimitForecast => ({
  rule: { id: 3, name: 'Pump too hot' }, asset: { id: 5, name: 'Pump 3', asset_tag: 'P-3', location_path: null }, metric_name: 'temperature', unit: '°C',
  limit: 85, current: 75.4, slope_per_day: 0.5, days_left: 19.2, days_soonest: 14.6, days_latest: 26.1, reaches_on: '2026-12-04', r2: 0.93,
  days_of_history: 29, points: 30, ...over,
})

function renderIt() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><HeadingForLimit /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const serve = (list: LimitForecast[]) => server.use(http.get('/api/v1/ai/forecasts/limits', () => HttpResponse.json({ data: list })))
const config = (features: Record<string, boolean>) =>
  http.get('/api/v1/ai/config', () => HttpResponse.json({ success: true, data: { enabled: true, model: 'm', provider: 'local', source: 'app', features }, meta: {} }))

beforeEach(async () => {
  await setLanguage('en', false)
})

describe('HeadingForLimit', () => {
  it('says which sensor is heading for which limit, when, with the range and what it rests on', async () => {
    serve([forecast()])
    renderIt()

    expect(await screen.findByRole('link', { name: 'Pump 3' })).toHaveAttribute('href', '/assets/5')
    expect(screen.getByText(/temperature is 75.4 °C and rising by 0.5 °C a day/)).toBeInTheDocument()
    expect(screen.getByText(/Reaches 85 °C in 19 days, around Dec 4, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Between 15 and 26 days/)).toBeInTheDocument()
    expect(screen.getByText(/from 29 days of readings \(30 days used\), rule: Pump too hot/)).toBeInTheDocument()
  })

  it('says the range is narrow, instead of "between 20 and 20", when the readings follow the line closely', async () => {
    serve([forecast({ days_soonest: 19.6, days_left: 19.9, days_latest: 20.3 })])
    renderIt()

    expect(await screen.findByText(/A narrow range: the readings follow the line closely/)).toBeInTheDocument()
    expect(screen.queryByText(/Between 20 and 20/)).not.toBeInTheDocument()
  })

  it('says falling for a sensor that is falling', async () => {
    serve([forecast({ slope_per_day: -0.5, limit: 40 })])
    renderIt()

    expect(await screen.findByText(/and falling by 0.5 °C a day/)).toBeInTheDocument()
  })

  it('says so when nothing is clearly heading for a limit', async () => {
    serve([])
    renderIt()

    expect(await screen.findByText('No sensor is clearly heading for a limit.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heading for a limit' })).toBeInTheDocument()
  })

  it('shows nothing, and asks for nothing, when the forecast is switched off', async () => {
    let asked = 0
    server.use(config({ priority: true, anomalies: true, limits: false, parts: true }),
      http.get('/api/v1/ai/forecasts/limits', () => { asked += 1; return HttpResponse.json({ data: [] }) }))
    renderIt()
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(screen.queryByRole('heading', { name: 'Heading for a limit' })).not.toBeInTheDocument()
    expect(asked).toBe(0)
  })

  it('reads in Spanish, dates and "in 19 days" included', async () => {
    await setLanguage('es', false)
    serve([forecast()])
    renderIt()

    expect(await screen.findByText(/temperature está en 75.4 °C y sube 0.5 °C al día/)).toBeInTheDocument()
    expect(screen.getByText(/Llega a 85 °C dentro de 19 días, hacia el/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Camino a un límite' })).toBeInTheDocument()
  })
})
