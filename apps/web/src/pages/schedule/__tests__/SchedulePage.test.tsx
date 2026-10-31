import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { SchedulePage } from '../SchedulePage'
import type { Schedule } from '@/types/schedule'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const week: Schedule = fixtures.schedule.data
const alice = week.technicians.find((t) => t.name === 'Alice Silva')!.id!
const bob = week.technicians.find((t) => t.name === 'Bob Perera')!.id!
const pumpJob = week.work_orders.find((o) => o.title === 'Job on Pump')!

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><SchedulePage /></MemoryRouter></QueryClientProvider>)
}

/** The server answers with `body`; returns the requests made for the schedule and the moves sent. */
function serve(body: { data: Schedule } = fixtures.schedule) {
  const asked: URL[] = []
  const moves: { id: string; body: unknown }[] = []
  server.use(
    http.get('/api/v1/schedule', ({ request }) => { asked.push(new URL(request.url)); return HttpResponse.json(body) }),
    http.patch('/api/v1/work_orders/:id/reschedule', async ({ request, params }) => {
      moves.push({ id: String(params.id), body: await request.json() })
      return HttpResponse.json({ data: {} })
    }),
  )
  return { asked, moves }
}

const last = <T,>(list: T[]) => list[list.length - 1]
const chip = (title: RegExp) => screen.getByRole('link', { name: title }).closest('[draggable]')!
const cell = (person: number | null, day: string) => screen.getByTestId(`cell-${person ?? 'nobody'}-${day}`)
const dataTransfer = () => ({ setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' })

function drag(from: Element, to: Element) {
  const transfer = dataTransfer()
  fireEvent.dragStart(from, { dataTransfer: transfer })
  fireEvent.dragOver(to, { dataTransfer: transfer })
  fireEvent.drop(to, { dataTransfer: transfer })
}

describe('the schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 14, 12)) // a Wednesday
  })
  afterEach(() => vi.useRealTimers())

  it('asks for the week around today, starting on the company\'s first day of the week', async () => {
    const { asked } = serve()
    renderPage()

    await screen.findByText('Alice Silva')
    expect(asked[0].searchParams.get('from')).toBe('2026-10-11') // the default first day of the week is Sunday
    expect(asked[0].searchParams.get('to')).toBe('2026-10-17')
  })

  it('lays out the people, a row for work nobody has, and each work order on its day', async () => {
    serve()
    renderPage()

    await screen.findByText('Alice Silva')
    expect(screen.getByText('Bob Perera')).toBeInTheDocument()
    expect(screen.getByText('Nobody yet')).toBeInTheDocument()
    expect(within(cell(alice, '2026-10-13')).getByRole('link', { name: /Job on Pump/ })).toBeInTheDocument()
    expect(within(cell(null, '2026-10-14')).getByRole('link', { name: /Job on Fan/ })).toBeInTheDocument()
    expect(within(cell(bob, '2026-10-13')).queryByRole('link')).toBeNull()
  })

  it('says how full a day is, and marks a day off with its reason', async () => {
    serve()
    renderPage()

    await screen.findByText('Alice Silva')
    expect(within(cell(alice, '2026-10-13')).getByText(/3 h of 9 h/)).toBeInTheDocument()
    expect(screen.getByText("Founders' Day")).toBeInTheDocument()
    expect(screen.getAllByText('Day off').length).toBeGreaterThan(0)
  })

  it('says so when nobody is over their hours', async () => {
    serve()
    renderPage()

    expect(await screen.findByText(/nobody has more than a day's work/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('picks out who is overloaded, and when, in words as well as colour', async () => {
    const busy: { data: Schedule } = {
      data: {
        ...week,
        technicians: week.technicians.map((t) => ({
          ...t,
          days: t.days.map((d) => (t.id === alice && d.date === '2026-10-13' ? { ...d, hours: 11.5, overloaded: true } : d)),
        })),
      },
    }
    serve(busy)
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('One day is overloaded')
    expect(alert).toHaveTextContent('Alice Silva, Tue 13: 11.5 h of 9 h')
    expect(within(cell(alice, '2026-10-13')).getByText(/over by 2.5 h/)).toBeInTheDocument()
  })

  it('shows work from before the period, or with no date, in its own column, and counts what is not listed', async () => {
    const more: { data: Schedule } = {
      data: { ...week, technicians: week.technicians.map((t) => (t.id === bob ? { ...t, earlier: { count: 9, hours: 9 } } : t)) },
    }
    serve(more)
    renderPage()

    await screen.findByText('Alice Silva')
    const earlier = cell(bob, 'earlier')
    expect(within(earlier).getAllByRole('link')).toHaveLength(2)
    expect(earlier).toHaveTextContent('9 open')
    expect(earlier).toHaveTextContent('+7 more, not listed')
  })

  it('says when it could not list everything', async () => {
    serve({ data: { ...week, truncated: true } })
    renderPage()

    expect(await screen.findByText(/more work than can be listed/i)).toBeInTheDocument()
  })

  it('goes to the next week, back, and to today', async () => {
    const { asked } = serve()
    renderPage()
    await screen.findByText('Alice Silva')

    await userEvent.setup({ advanceTimers: () => {} }).click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(last(asked).searchParams.get('from')).toBe('2026-10-18'))

    await userEvent.setup({ advanceTimers: () => {} }).click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => expect(last(asked).searchParams.get('from')).toBe('2026-10-11'))
  })

  it('shows one day, with more about each work order, in the day view', async () => {
    const { asked } = serve()
    renderPage()
    await screen.findByText('Alice Silva')

    await userEvent.setup({ advanceTimers: () => {} }).click(screen.getByRole('button', { name: 'Day' }))

    await waitFor(() => expect(last(asked).searchParams.get('from')).toBe('2026-10-14'))
    expect(last(asked).searchParams.get('to')).toBe('2026-10-14')
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says when the schedule could not be loaded', async () => {
    server.use(http.get('/api/v1/schedule', () => HttpResponse.json({ error: { message: 'no' } }, { status: 500 })))
    renderPage()

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument()
  })

  describe('dragging a work order', () => {
    it('to someone else on another day moves it to both', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      drag(chip(/Job on Pump/), cell(bob, '2026-10-16'))

      await waitFor(() => expect(moves).toHaveLength(1))
      expect(moves[0]).toEqual({ id: String(pumpJob.id), body: { assignee_id: bob, due_on: '2026-10-16' } })
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Moved.'))
    })

    it('shows the new arrangement afterwards, by asking for the schedule again', async () => {
      const { asked, moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')
      const before = asked.length

      drag(chip(/Job on Pump/), cell(bob, '2026-10-16'))

      await waitFor(() => expect(moves).toHaveLength(1))
      await waitFor(() => expect(asked.length).toBeGreaterThan(before))
    })

    it('to another day for the same person moves only the day', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      drag(chip(/Job on Pump/), cell(alice, '2026-10-15'))

      await waitFor(() => expect(moves[0].body).toEqual({ due_on: '2026-10-15' }))
    })

    it('to the row of work nobody has takes it from its person', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      drag(chip(/Job on Pump/), cell(null, '2026-10-13'))

      await waitFor(() => expect(moves[0].body).toEqual({ assignee_id: null }))
    })

    it('to the earlier column changes who has it but not when it is due', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      drag(chip(/Job on Pump/), cell(bob, 'earlier'))

      await waitFor(() => expect(moves[0].body).toEqual({ assignee_id: bob }))
    })

    it('onto where it already is sends nothing', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      drag(chip(/Job on Pump/), cell(alice, '2026-10-13'))

      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(moves).toEqual([])
    })

    it('shows the server\'s reason when it refuses', async () => {
      serve()
      server.use(http.patch('/api/v1/work_orders/:id/reschedule', () =>
        HttpResponse.json({ error: { message: 'Work that has started stays with the person doing it.' } }, { status: 422 })))
      renderPage()
      await screen.findByText('Alice Silva')

      drag(chip(/Job on Pump/), cell(bob, '2026-10-13'))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Work that has started stays with the person doing it.'))
    })
  })

  describe('the move button, for those who cannot drag', () => {
    const user = () => userEvent.setup({ advanceTimers: () => {} })

    it('moves a work order to the person and day chosen', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      await user().click(screen.getByRole('button', { name: `Move ${pumpJob.work_order_number}` }))
      const dialog = await screen.findByRole('dialog')
      await user().selectOptions(within(dialog).getByLabelText('Who does it'), 'Bob Perera')
      fireEvent.change(within(dialog).getByLabelText('Due on'), { target: { value: '2026-10-16' } })
      await user().click(within(dialog).getByRole('button', { name: 'Move' }))

      await waitFor(() => expect(moves[0].body).toEqual({ assignee_id: bob, due_on: '2026-10-16' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('starts from where the work order is, so there is nothing to move until something is changed', async () => {
      serve()
      renderPage()
      await screen.findByText('Alice Silva')

      await user().click(screen.getByRole('button', { name: `Move ${pumpJob.work_order_number}` }))
      const dialog = await screen.findByRole('dialog')

      expect(within(dialog).getByLabelText('Who does it')).toHaveValue(String(alice))
      expect(within(dialog).getByLabelText('Due on')).toHaveValue('2026-10-13')
      expect(within(dialog).getByRole('button', { name: 'Move' })).toBeDisabled()
    })

    it('can hand work back to nobody', async () => {
      const { moves } = serve()
      renderPage()
      await screen.findByText('Alice Silva')

      await user().click(screen.getByRole('button', { name: `Move ${pumpJob.work_order_number}` }))
      const dialog = await screen.findByRole('dialog')
      await user().selectOptions(within(dialog).getByLabelText('Who does it'), 'Nobody yet')
      await user().click(within(dialog).getByRole('button', { name: 'Move' }))

      await waitFor(() => expect(moves[0].body).toEqual({ assignee_id: null }))
    })
  })
})
