import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkOrderPartsLog } from '../WorkOrderPartsLog'

const lines = [
  { id: 11, part_id: 1, name: 'Hydraulic seal', sku: 'HS-1', quantity_used: 2, unit_cost: '18.0' },
  { id: 12, part_id: 2, name: 'Drive chain', sku: null, quantity_used: 1, unit_cost: '30.0' },
]

function renderLog(editable: boolean) {
  server.use(http.get('/api/v1/work_orders/7/parts', () => HttpResponse.json({ parts: lines })))
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <WorkOrderPartsLog workOrderId={7} editable={editable} />
    </QueryClientProvider>,
  )
}

describe('WorkOrderPartsLog', () => {
  it('lists the parts used with line totals and the total cost', async () => {
    renderLog(false)

    expect(await screen.findByText('Hydraulic seal')).toBeInTheDocument()
    expect(screen.getByText('HS-1')).toBeInTheDocument()
    expect(screen.getByText('$36.00')).toBeInTheDocument() // 2 x 18
    expect(screen.getByText('$66.00')).toBeInTheDocument() // 36 + 30
  })

  it('only offers Remove to people who can change the work order', async () => {
    renderLog(false)
    await screen.findByText('Hydraulic seal')
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('removes a line when asked', async () => {
    let removed = ''
    server.use(http.delete('/api/v1/work_orders/7/parts/:id', ({ params }) => {
      removed = String(params.id)
      return new HttpResponse(null, { status: 204 })
    }))
    renderLog(true)

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Drive chain' }))

    await waitFor(() => expect(removed).toBe('12'))
  })
})
