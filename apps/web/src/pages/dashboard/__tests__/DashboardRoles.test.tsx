import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { useAuthStore } from '@/stores/authStore'
import { DashboardPage } from '../DashboardPage'
import type { Role } from '@/types'

// The page for each kind of person, fed what the server really sends that person (see reportFixtures.ts). The
// server's answer differs by role, and a page that reads the manager's shape crashes for everyone else.

function renderAs(role: Role, answer: unknown) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada Lovelace', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  server.use(
    http.get('/api/v1/dashboard', () => HttpResponse.json(answer as Record<string, unknown>)),
    http.get('/api/v1/getting_started', () => HttpResponse.json({ steps: [], dismissed: true })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>)
}

/** The number a stat card shows under its title. */
async function stat(title: string): Promise<string> {
  return (await screen.findByText(title)).nextElementSibling?.textContent ?? ''
}

describe('DashboardPage for each kind of person', () => {
  it('shows a manager the company figures', async () => {
    const { work_orders, assets, iot } = fixtures.dashboardFull
    renderAs('manager', fixtures.dashboardFull)
    expect(await stat('Open Work Orders')).toBe(String(work_orders.open))
    expect(await stat('Asset Health')).toBe(`${assets.health_score}%`)
    expect(await stat('PM Compliance')).toBe(`${fixtures.dashboardFull.preventive_maintenance.compliance_rate_30d}%`)
    expect(await stat('IoT Alerts')).toBe(String(iot.open_alerts))
    expect(screen.getByText(`${work_orders.overdue} overdue`)).toBeInTheDocument()
  })

  it('shows "—" for PM compliance when nothing has come due, not 0% or 100%', async () => {
    const answer = { ...fixtures.dashboardFull, preventive_maintenance: { ...fixtures.dashboardFull.preventive_maintenance, compliance_rate_30d: null } }
    renderAs('manager', answer)
    expect(await stat('PM Compliance')).toBe('—')
  })

  it('shows a technician their own work, maintenance and activity', async () => {
    const { my_work_orders, upcoming_pms, recent_activity } = fixtures.dashboardTechnician
    expect(upcoming_pms.length).toBeGreaterThan(0)
    renderAs('technician', fixtures.dashboardTechnician)
    expect(await stat('Assigned to me')).toBe(String(my_work_orders.assigned))
    expect(await stat('In progress')).toBe(String(my_work_orders.in_progress))
    expect(await stat('Overdue')).toBe(String(my_work_orders.overdue))
    expect(await stat('Completed today')).toBe(String(my_work_orders.completed_today))
    expect(screen.getByText(upcoming_pms[0].name)).toBeInTheDocument()
    expect(screen.getByText(recent_activity[0].description)).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Ada')).toBeInTheDocument()
  })

  it('shows a requester how their requests are going', async () => {
    const { my_requests } = fixtures.dashboardRequester
    renderAs('requester', fixtures.dashboardRequester)
    expect(await stat('My requests')).toBe(String(my_requests.total))
    expect(await stat('Still open')).toBe(String(my_requests.open))
    expect(await stat('Completed')).toBe(String(my_requests.completed))
  })
})
