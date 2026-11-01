import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { customField } from '@/test/customFields'
import { WorkOrdersTable } from '../WorkOrdersTable'
import type { WorkOrder } from '@/types'

const centre = customField({ label: 'Cost centre', in_list: true })
const budget = customField({ label: 'Budget', kind: 'number' })
const safe = customField({ label: 'Safe', kind: 'checkbox', in_list: true })
const hidden = customField({ label: 'Hidden', in_list: true, active: false })

const order = (id: number, title: string, custom_values?: WorkOrder['custom_values']) =>
  ({
    id, work_order_number: `WO-${id}`, title, status: 'open', priority: 'medium', organization_id: 1,
    created_at: '', updated_at: '', custom_values,
  }) as WorkOrder

beforeEach(() => {
  server.use(http.get('/api/v1/custom_fields', () => HttpResponse.json({ custom_fields: [centre, budget, safe, hidden] })))
})

function renderTable(workOrders: WorkOrder[]) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><WorkOrdersTable workOrders={workOrders} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WorkOrdersTable custom field columns', () => {
  it('has a column for each field chosen for the list that is on, and a dash where nothing is filled in', async () => {
    renderTable([order(1, 'Pump leaking', { cost_centre: 'CC-1', safe: true, budget: 9 }), order(2, 'Fan noisy')])

    expect(await screen.findByRole('columnheader', { name: 'Cost centre' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Safe' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Budget' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Hidden' })).not.toBeInTheDocument()

    const first = screen.getByText('Pump leaking').closest('tr')!
    expect(within(first).getByText('CC-1')).toBeInTheDocument()
    expect(within(first).getByText('Yes')).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    const cells = within(screen.getByText('Fan noisy').closest('tr')!).getAllByRole('cell')
    expect(cells[headers.indexOf('Cost centre')]).toHaveTextContent('—')
    expect(cells[headers.indexOf('Safe')]).toHaveTextContent('—')
  })
})
