import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { customField } from '@/test/customFields'
import { PartFormModal } from '../PartFormModal'
import type { Part } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const shelf = customField({ label: 'Shelf', entity: 'part', required: true })
const grade = customField({ label: 'Grade', entity: 'part', kind: 'select', options: ['A', 'B'] })
const workOrderOnly = customField({ label: 'Cost centre' })

const existing: Part = {
  id: 5, name: 'Belt', sku: 'B-1', quantity_on_hand: 4, reorder_point: 1, unit: 'each', unit_cost: 3,
  organization_id: 1, created_at: '', updated_at: '', custom_values: { shelf: 'A1', grade: 'B' },
}

let sent: { method: string; url: string; body: { part: Record<string, unknown> } }[]

beforeEach(() => {
  sent = []
  server.use(
    http.get('/api/v1/custom_fields', ({ request }) => {
      const entity = new URL(request.url).searchParams.get('entity')
      return HttpResponse.json({ custom_fields: [shelf, grade, workOrderOnly].filter((f) => f.entity === entity) })
    }),
    http.post('/api/v1/parts', async ({ request }) => {
      sent.push({ method: 'POST', url: request.url, body: (await request.json()) as never })
      return HttpResponse.json({ id: 9 }, { status: 201 })
    }),
    http.patch('/api/v1/parts/:id', async ({ request }) => {
      sent.push({ method: 'PATCH', url: request.url, body: (await request.json()) as never })
      return HttpResponse.json({ id: 5 })
    }),
  )
})

function renderModal(part?: Part) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PartFormModal open onClose={() => {}} part={part} />
    </QueryClientProvider>,
  )
}

describe('PartFormModal custom fields', () => {
  it('shows the part fields, not the work order ones', async () => {
    renderModal()

    expect(await screen.findByLabelText('Shelf *')).toBeInTheDocument()
    expect(screen.getByLabelText('Grade')).toBeInTheDocument()
    expect(screen.queryByLabelText('Cost centre')).not.toBeInTheDocument()
  })

  it('sends them with a new part', async () => {
    renderModal()
    await userEvent.type(screen.getByLabelText('Name *'), 'Bolt')
    await userEvent.type(await screen.findByLabelText('Shelf *'), 'C3')
    await userEvent.selectOptions(screen.getByLabelText('Grade'), 'A')
    await userEvent.click(screen.getByRole('button', { name: 'Add part' }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].body.part).toMatchObject({ name: 'Bolt', custom_values: { shelf: 'C3', grade: 'A' } })
  })

  it('will not add a part without a required field', async () => {
    renderModal()
    await userEvent.type(screen.getByLabelText('Name *'), 'Bolt')
    await screen.findByLabelText('Shelf *')
    await userEvent.click(screen.getByRole('button', { name: 'Add part' }))

    expect(await screen.findByText('Shelf is required')).toBeInTheDocument()
    expect(sent).toHaveLength(0)
  })

  it('starts an edit with what is filled in, and sends the fields only when one changed', async () => {
    renderModal(existing)
    expect(await screen.findByLabelText('Shelf *')).toHaveValue('A1')
    expect(screen.getByLabelText('Grade')).toHaveValue('B')

    await userEvent.clear(screen.getByLabelText('Name *'))
    await userEvent.type(screen.getByLabelText('Name *'), 'Belt 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].body.part).not.toHaveProperty('custom_values')

    await userEvent.type(screen.getByLabelText('Shelf *'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1].body.part.custom_values).toEqual({ shelf: 'A12', grade: 'B' })
  })

  it('does not let a required field be emptied on an edit', async () => {
    renderModal(existing)
    await userEvent.clear(await screen.findByLabelText('Shelf *'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Shelf is required')).toBeInTheDocument()
    expect(sent).toHaveLength(0)
  })
})
