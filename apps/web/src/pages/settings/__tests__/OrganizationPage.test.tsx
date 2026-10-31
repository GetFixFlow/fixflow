import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrganizationPage } from '../OrganizationPage'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  org: null as null | Record<string, unknown>,
}))

vi.mock('@/hooks/useSettings', () => ({
  useOrgSettings: () => ({ data: mocks.org, isLoading: false }),
  useUpdateOrgSettings: () => ({ mutate: mocks.mutate, isPending: false }),
}))

const SAVED_ORG = {
  name: 'Acme Corp', slug: 'acme', industry: 'Manufacturing', size: '11-50', website: '', address: '',
  default_priority: 'high', default_due_days: 3, labor_rate: 37.5, approval_limit: 500, require_completion_notes: false, auto_close_days: 30,
  wo_number_prefix: 'MNT', pm_compliance_target: 90, pm_reminder_days: 7, pm_pause_on_down: false,
  iot_alert_cooldown: 60, iot_stale_threshold: 300, iot_data_retention_days: 365, iot_auto_wo_threshold: 'critical',
  work_hours: { start: '07:00', end: '15:00' }, work_days: [1, 2, 3, 4, 5, 6],
  holidays: [{ date: '2026-12-25', name: 'Christmas', repeating: true }], timezone: 'Asia/Colombo',
}

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      role: 'admin',
      id: 1,
      full_name: 'Alice',
      email: 'alice@test.com',
      organization_id: 1,
    },
  }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OrganizationPage', () => {
  it('renders org details section', () => {
    render(<OrganizationPage />, { wrapper: Wrapper })
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText(/Organization Details/i)).toBeInTheDocument()
  })

  it('renders maintenance settings', () => {
    render(<OrganizationPage />, { wrapper: Wrapper })
    expect(screen.getByText(/Maintenance Settings/i)).toBeInTheDocument()
  })

  describe('with saved settings', () => {
    beforeEach(() => {
      mocks.org = SAVED_ORG
      mocks.mutate.mockClear()
    })
    afterEach(() => {
      mocks.org = null
    })

    it('shows the saved holidays, which load after the first render', async () => {
      render(<OrganizationPage />, { wrapper: Wrapper })
      expect(await screen.findByText('Christmas')).toBeInTheDocument()
    })

    it('shows the default hourly labor rate, and saves a changed one', async () => {
      render(<OrganizationPage />, { wrapper: Wrapper })
      const rate = await screen.findByLabelText(/hourly labor rate/i)
      expect(rate).toHaveValue(37.5)

      await userEvent.clear(rate)
      await userEvent.type(rate, '42.25')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(mocks.mutate).toHaveBeenCalled())
      expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ labor_rate: 42.25 })
    })

    it('shows the approval limit, and saves a changed one', async () => {
      render(<OrganizationPage />, { wrapper: Wrapper })
      const limit = await screen.findByLabelText(/approval limit/i)
      expect(limit).toHaveValue(500)

      await userEvent.clear(limit)
      await userEvent.type(limit, '1200')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(mocks.mutate).toHaveBeenCalled())
      expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ approval_limit: 1200 })
    })

    it('keeps the URL slug read-only', async () => {
      render(<OrganizationPage />, { wrapper: Wrapper })
      expect(await screen.findByDisplayValue('acme')).toBeDisabled()
    })

    it('says which settings are saved but not applied yet', () => {
      render(<OrganizationPage />, { wrapper: Wrapper })
      expect(screen.getAllByText('Saved, not applied yet').length).toBeGreaterThanOrEqual(4)
    })

    it('saves the holidays and working days with the rest, and never sends the slug', async () => {
      render(<OrganizationPage />, { wrapper: Wrapper })
      await screen.findByText('Christmas')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(mocks.mutate).toHaveBeenCalled())
      const sent = mocks.mutate.mock.calls[0][0]
      expect(sent).toMatchObject({
        name: 'Acme Corp', wo_number_prefix: 'MNT', timezone: 'Asia/Colombo', default_due_days: 3, labor_rate: 37.5,
        work_days: [1, 2, 3, 4, 5, 6], work_hours: { start: '07:00', end: '15:00' },
        holidays: [{ date: '2026-12-25', name: 'Christmas', repeating: true }],
      })
      expect(sent).not.toHaveProperty('slug')
    })
  })
})
