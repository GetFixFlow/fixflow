import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMCreatePage } from '../PMCreatePage'
import { PMEditPage } from '../PMEditPage'
import { PMListPage } from '../PMListPage'
import { TriggerPMModal } from '@/components/pm/TriggerPMModal'
import { SkipExecutionModal } from '@/components/pm/SkipExecutionModal'
import { ChecklistTemplateBuilder } from '@/components/pm/ChecklistTemplateBuilder'
import { RequiredPartsEditor } from '@/components/pm/RequiredPartsEditor'
import { useAuthStore } from '@/stores/authStore'
import type { PreventiveMaintenance } from '@/types'

const meta = { request_id: 'test', timestamp: '' }
const pump = { id: 7, name: 'Pump 7', asset_tag: 'FF-000007', status: 'operational', organization_id: 1, created_at: '', updated_at: '' }
const pm = {
  id: 5, name: 'Oil change', description: 'Every so often', status: 'active', priority: 'medium', frequency_type: 'time_based',
  frequency_value: 30, frequency_unit: 'days', start_date: '2026-10-01', end_date: null, next_due_at: null, estimated_hours: 2,
  asset: { id: 7, name: 'Pump 7', asset_tag: 'FF-000007' },
  template: { title: '{asset_name}: oil change', description: 'Use 10W-40', checklist: [] }, created_at: '', updated_at: '',
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'tok', isAuthenticated: true })
  server.use(
    http.get('/api/v1/preventive_maintenances', () => HttpResponse.json({ pm_schedules: [pm], meta })),
    http.get('/api/v1/preventive_maintenances/5', () => HttpResponse.json({ data: pm, executions: [], meta })),
    http.get('/api/v1/assets', () => HttpResponse.json({ assets: [pump], meta })),
    http.get('/api/v1/locations', () => HttpResponse.json({ locations: [], meta })),
    http.get('/api/v1/parts', () => HttpResponse.json({ parts: [], meta })),
  )
})

describe('PM schedule forms: what a screen reader announces for each control', () => {
  it('create: names the first step\'s fields, the priority as a group, and the way back', () => {
    render(<PMCreatePage />, { wrapper })

    expect(screen.getByLabelText('PM Schedule Name*')).toBeInTheDocument()
    expect(screen.getByLabelText('Asset*')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    const priority = screen.getByRole('group', { name: 'Priority*' })
    expect(within(priority).getByRole('button', { name: 'medium' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Back to preventive maintenance' })).toHaveAttribute('href', '/preventive-maintenance')
  })

  it('edit: names the fields of a time-based schedule and the way back', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/preventive-maintenance/5/edit']}>
          <Routes><Route path="/preventive-maintenance/:id/edit" element={<PMEditPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByLabelText('PM Schedule Name*')).toHaveValue('Oil change')
    expect(screen.getByLabelText('Asset*')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toHaveValue('Every so often')
    expect(screen.getByLabelText('Frequency: Every')).toHaveValue(30)
    expect(screen.getByLabelText('Unit')).toHaveValue('days')
    expect(screen.getByLabelText('Title Template')).toHaveValue('{asset_name}: oil change')
    expect(screen.getByLabelText('Estimated Hours')).toHaveValue(2)
    expect(within(screen.getByRole('group', { name: 'Priority' })).getByRole('button', { name: 'medium' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Back to the PM schedule' })).toHaveAttribute('href', '/preventive-maintenance/5')
  })

  it('list: names the search box, the status filter and each way of viewing, and says which is on', async () => {
    render(<PMListPage />, { wrapper })

    expect(await screen.findByLabelText('Search PM schedules')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by status')).toHaveValue('all')
    const views = ['cards', 'table', 'calendar'].map((v) => screen.getByRole('button', { name: `${v} view` }))
    expect(views.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    await userEvent.click(views[1])
    expect(views[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('trigger now: names the overrides, and the close button', async () => {
    render(<TriggerPMModal open pm={pm as unknown as PreventiveMaintenance} onClose={() => {}} />, { wrapper })
    await userEvent.click(screen.getByText(/advanced overrides/i))

    expect(screen.getByLabelText('Override due date')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Override priority')).toBeInTheDocument()
    expect(screen.getByLabelText('Add note to work order')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('skip: names the other-reason box and the close button', async () => {
    render(<SkipExecutionModal open pmId={5} executionId={9} scheduledDate="2026-11-01" pm={pm as unknown as PreventiveMaintenance} onClose={() => {}} />, { wrapper })

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Other' }))
    expect(screen.getByLabelText('Reason')).toBeInTheDocument()
  })

  it('checklist and parts editors: name each step\'s boxes and each part\'s quantity', () => {
    const { unmount } = render(
      <ChecklistTemplateBuilder value={[{ step: 1, instruction: 'Drain the oil', required: true, notes: 'Hot' }, { step: 2, instruction: 'Refill', required: false }]} onChange={() => {}} />,
    )
    expect(screen.getByLabelText('Instruction for step 1')).toHaveValue('Drain the oil')
    expect(screen.getByLabelText('Instruction for step 2')).toHaveValue('Refill')
    unmount()

    render(<RequiredPartsEditor value={[{ part_id: 1, quantity: 3, part: { id: 1, name: 'Hydraulic seal' } } as never]} onChange={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Quantity of Hydraulic seal')).toHaveValue(3)
  })
})
