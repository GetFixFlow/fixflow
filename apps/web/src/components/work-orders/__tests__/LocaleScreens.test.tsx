import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { DEFAULT_LOCALE, useLocaleStore } from '@/lib/localeFormat'
import { WorkOrderCosts } from '../WorkOrderCosts'
import { PMCalendarView } from '@/components/pm/PMCalendarView'

beforeEach(() => {
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
  server.use(http.get('/api/v1/work_orders/1/parts', () => HttpResponse.json({ parts: [{ id: 1, part_id: 1, name: 'Seal', quantity_used: 2, unit_cost: 12.5 }] })))
})

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('screens follow the localization settings', () => {
  it('shows costs in the dollar by default', async () => {
    wrap(<WorkOrderCosts workOrderId={1} laborCost={10} />)

    expect(await screen.findByText('$25.00')).toBeInTheDocument() // parts: 2 x 12.50
    expect(screen.getByText('$35.00')).toBeInTheDocument() // total
  })

  it("shows costs in the company's currency and number style", async () => {
    useLocaleStore.getState().setLocale({ currency: 'EUR', number_format: '1.234,56' })
    wrap(<WorkOrderCosts workOrderId={1} laborCost={1000} />)

    expect(await screen.findByText('€25,00')).toBeInTheDocument()
    expect(screen.getByText('€1.025,00')).toBeInTheDocument()
  })

  it('starts the calendar week on Sunday, as it always did, unless set to Monday', () => {
    const { unmount } = wrap(<PMCalendarView pms={[]} />)
    const heading = () => screen.getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/).map((e) => e.textContent)
    expect(heading()[0]).toBe('Sun')
    unmount()

    useLocaleStore.getState().setLocale({ first_day_of_week: 'monday' })
    wrap(<PMCalendarView pms={[]} />)
    expect(heading()[0]).toBe('Mon')
    expect(heading()[6]).toBe('Sun')
  })
})
