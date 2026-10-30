import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '../AppLayout'
import { useAuthStore } from '@/stores/authStore'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { DEFAULT_LOCALE } from '@/lib/localeFormat'

const created = vi.hoisted(() => ({ channels: [] as unknown[], unsubscribed: 0 }))
vi.mock('@/lib/cable', () => ({
  cable: {
    subscriptions: {
      create: vi.fn((channel: unknown) => {
        created.channels.push(channel)
        return { unsubscribe: () => { created.unsubscribed += 1 } }
      }),
    },
  },
}))

function renderLayout(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<p>Dashboard</p>} />
            <Route path="/work-orders" element={<p>Work orders</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('live IoT alerts in the app layout', () => {
  beforeEach(() => {
    created.channels.length = 0
    created.unsubscribed = 0
    server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({ localization: DEFAULT_LOCALE })))
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin User', role: 'admin', organization_id: 1, created_at: '' }, token: 't', isAuthenticated: true })
  })

  it('listens for alerts on any screen, not only the IoT ones', () => {
    renderLayout('/work-orders')

    expect(created.channels).toEqual(['IotAlertChannel'])
  })

  it('listens once, however many screens are visited', () => {
    const { unmount } = renderLayout('/dashboard')

    expect(created.channels).toHaveLength(1)
    unmount()
    expect(created.unsubscribed).toBe(1)
  })
})
