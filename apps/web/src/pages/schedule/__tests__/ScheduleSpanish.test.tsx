import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { setLanguage } from '@/i18n'
import { SchedulePage } from '../SchedulePage'
import type { Schedule } from '@/types/schedule'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const week: Schedule = fixtures.schedule.data
const alice = week.technicians.find((t) => t.name === 'Alice Silva')!.id!

describe('the schedule in Spanish', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00'))
    setLanguage('es', false)
  })
  afterEach(() => vi.useRealTimers())

  it('names its views, rows, load and days in Spanish, and says who is overloaded in Spanish', async () => {
    const busy = {
      data: {
        ...week,
        technicians: week.technicians.map((t) => ({
          ...t,
          days: t.days.map((d) => (t.id === alice && d.date === '2026-10-13' ? { ...d, hours: 11.5, overloaded: true } : d)),
        })),
      },
    }
    server.use(http.get('/api/v1/schedule', () => HttpResponse.json(busy)))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><MemoryRouter><SchedulePage /></MemoryRouter></QueryClientProvider>)

    await screen.findByText('Alice Silva')
    expect(screen.getByRole('heading', { name: 'Programación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeInTheDocument()
    expect(screen.getByText('Nadie aún')).toBeInTheDocument()
    expect(screen.getByText('Técnico')).toBeInTheDocument()
    expect(screen.getByText('Anteriores o sin fecha')).toBeInTheDocument()
    expect(screen.getAllByText('Día libre').length).toBeGreaterThan(0)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Un día está sobrecargado')
    expect(alert).toHaveTextContent(/Alice Silva, mar\.? 13: 11.5 h de 9 h/)
    expect(within(screen.getByTestId(`cell-${alice}-2026-10-13`)).getByText(/excede por 2.5 h/)).toBeInTheDocument()
  })
})
