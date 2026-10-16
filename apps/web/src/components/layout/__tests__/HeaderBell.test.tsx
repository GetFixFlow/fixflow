import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from '../Header'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'
import type { IotAlert } from '@/types'

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

function renderHeader() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="*" element={<><Header /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the header bell', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin User', role: 'admin', organization_id: 1, created_at: '' }, token: 't', isAuthenticated: true })
    useRealtimeStore.setState({ newAlerts: [], connected: false })
  })

  it('has no mark when there is nothing new', () => {
    renderHeader()

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('says how many new alerts there are', () => {
    useRealtimeStore.setState({ newAlerts: [{ id: 1 }, { id: 2 }] as IotAlert[] })
    renderHeader()

    expect(screen.getByRole('button', { name: 'Notifications: 2 new alerts' })).toBeInTheDocument()
  })

  it('takes the person to the alerts and clears the mark when clicked', async () => {
    const user = userEvent.setup()
    useRealtimeStore.setState({ newAlerts: [{ id: 1 }] as IotAlert[] })
    renderHeader()

    await user.click(screen.getByRole('button', { name: /Notifications: 1 new alerts/ }))

    expect(screen.getByTestId('where')).toHaveTextContent('/iot/alerts')
    expect(useRealtimeStore.getState().newAlerts).toEqual([])
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })
})
