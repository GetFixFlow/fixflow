import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { DashboardPage } from '../DashboardPage'
import type { Role } from '@/types'

const stats = {
  work_orders: { open: 0, in_progress: 0, overdue: 0, completed_today: 0, completed_this_week: 0, critical_open: 0, avg_resolution_hours: 0 },
  assets: { total: 0, operational: 0, degraded: 0, down: 0, decommissioned: 0, health_score: 100 },
  preventive_maintenance: { due_this_week: 0, overdue: 0, compliance_rate_30d: 100, next_due: [] },
  iot: { active_rules: 0, open_alerts: 0, critical_alerts: 0, readings_last_hour: 0 },
  recent_activity: [], generated_at: '2026-10-15T00:00:00Z',
}

function signInAs(role: Role) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada Admin', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

let asked: string[] = []

beforeEach(() => {
  asked = []
  server.use(
    http.get('/api/v1/dashboard', () => HttpResponse.json(stats)),
    http.get('/api/v1/getting_started', () => {
      asked.push('getting_started')
      return HttpResponse.json({
        steps: [{ key: 'assets', title: 'Add your equipment', description: 'Add one.', done: false, path: '/assets/new' }],
        all_done: false, dismissed: false, sample_loaded: false,
      })
    }),
    http.get('/api/v1/sample_data', () => { asked.push('sample_data'); return HttpResponse.json({ loaded: false, counts: {} }) }),
  )
})

describe('the dashboard and the first steps', () => {
  it('shows the administrator what to do first', async () => {
    signInAs('admin')
    renderPage()

    expect(await screen.findByText('Getting started')).toBeInTheDocument()
    expect(screen.getByText('Add your equipment')).toBeInTheDocument()
  })

  it.each<Role>(['manager', 'technician', 'requester'])('does not show it to a %s, or even ask for it', async (role) => {
    signInAs(role)
    renderPage()

    await screen.findByText(/Welcome back/)
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
    expect(asked).toEqual([])
  })
})
