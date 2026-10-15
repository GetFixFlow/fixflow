import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { DEFAULT_LOCALE, useLocaleStore } from '@/lib/localeFormat'
import { WorkOrderCosts } from '../WorkOrderCosts'

beforeEach(() => {
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
  server.use(http.get('/api/v1/work_orders/1/parts', () => HttpResponse.json({ parts: [{ id: 1, part_id: 1, name: 'Seal', quantity_used: 2, unit_cost: 12.5 }] })))
})

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('WorkOrderCosts labor', () => {
  it("shows the server's labor cost, with the hours and the rate it was worked out at", async () => {
    wrap(<WorkOrderCosts workOrderId={1} actualHours="2.5" laborCost="112.50" laborRate="45.00" />)

    expect(await screen.findByText('$137.50')).toBeInTheDocument() // total: 25 parts + 112.50 labor (once the parts have loaded)
    expect(screen.getByText('Labor cost (2.5 hrs × $45.00/hr)')).toBeInTheDocument()
    expect(screen.getByText('$112.50')).toBeInTheDocument()
  })

  it('does not make up a rate of its own', async () => {
    wrap(<WorkOrderCosts workOrderId={1} actualHours="2" laborCost="0.0" laborRate="0.0" />)

    expect(await screen.findByText('Labor cost (2 hrs)')).toBeInTheDocument()
    expect(screen.queryByText(/\$40/)).not.toBeInTheDocument()
    expect(screen.getByText(/no hourly rate is set/i)).toBeInTheDocument()
  })

  it('does not nag when there are no hours yet', async () => {
    wrap(<WorkOrderCosts workOrderId={1} laborCost="0.0" laborRate={null} />)

    expect(await screen.findByText('Labor cost')).toBeInTheDocument()
    expect(screen.queryByText(/no hourly rate/i)).not.toBeInTheDocument()
  })

  it('shows people who may not see wages the parts cost only, not a total that would hide the rest', async () => {
    wrap(<WorkOrderCosts workOrderId={1} actualHours="2" laborCost={null} laborRate={null} />)

    expect(await screen.findByText('$25.00')).toBeInTheDocument()
    expect(screen.queryByText(/labor/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Total cost')).not.toBeInTheDocument()
  })

  it("follows the company's currency", async () => {
    useLocaleStore.getState().setLocale({ currency: 'EUR', number_format: '1.234,56' })
    wrap(<WorkOrderCosts workOrderId={1} actualHours="10" laborCost="1000" laborRate="100" />)

    expect(await screen.findByText('€1.025,00')).toBeInTheDocument() // total, once the parts have loaded
    expect(screen.getByText('Labor cost (10 hrs × €100,00/hr)')).toBeInTheDocument()
    expect(screen.getByText('€1.000,00')).toBeInTheDocument()
  })
})
