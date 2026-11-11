import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { setLanguage } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { DashboardPage } from '../DashboardPage'
import type { Role } from '@/types'

function renderAs(role: Role, answer: unknown) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada Lovelace', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  server.use(
    http.get('/api/v1/dashboard', () => HttpResponse.json(answer as Record<string, unknown>)),
    http.get('/api/v1/getting_started', () => HttpResponse.json({ steps: [], dismissed: true })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>)
}

describe('the dashboard in Spanish', () => {
  beforeEach(() => setLanguage('es', false))

  it('shows a manager the figures with Spanish titles and asset states', async () => {
    renderAs('manager', fixtures.dashboardFull)

    expect(await screen.findByText('Órdenes de trabajo abiertas')).toBeInTheDocument()
    expect(screen.getByText('Te damos la bienvenida de nuevo, Ada')).toBeInTheDocument()
    expect(screen.getByText('Salud de los activos')).toBeInTheDocument()
    expect(screen.getByText('Cumplimiento de MP')).toBeInTheDocument()
    expect(screen.getByText(`${fixtures.dashboardFull.work_orders.overdue} vencidas`)).toBeInTheDocument()
    expect(screen.getAllByText('Operativo').length).toBeGreaterThan(0)
    expect(screen.queryByText('Open Work Orders')).not.toBeInTheDocument()
  })

  it('shows a technician and a requester their own pages in Spanish', async () => {
    const { unmount } = renderAs('technician', fixtures.dashboardTechnician)
    expect(await screen.findByText('Asignadas a mí')).toBeInTheDocument()
    expect(screen.getByText('Completadas hoy')).toBeInTheDocument()
    expect(screen.getByText('Ver mis órdenes de trabajo →')).toBeInTheDocument()
    unmount()

    renderAs('requester', fixtures.dashboardRequester)
    expect(await screen.findByText('Mis solicitudes')).toBeInTheDocument()
    expect(screen.getByText('Aún abiertas')).toBeInTheDocument()
  })
})
