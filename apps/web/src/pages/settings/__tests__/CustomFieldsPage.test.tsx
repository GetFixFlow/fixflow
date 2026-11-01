import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { customField } from '@/test/customFields'
import { CustomFieldsPage } from '../CustomFieldsPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const centre = customField({ label: 'Cost centre', required: true, in_list: true, position: 1 })
const risk = customField({ label: 'Risk', kind: 'select', options: ['Low', 'High'], position: 2 })
const old = customField({ label: 'Old code', active: false, position: 3 })
const shelf = customField({ label: 'Shelf', entity: 'part' })

let calls: { method: string; url: string; body?: unknown }[]

function serve(fields = [centre, risk, old]) {
  calls = []
  server.use(
    http.get('/api/v1/custom_fields', ({ request }) => {
      const entity = new URL(request.url).searchParams.get('entity')
      return HttpResponse.json({ custom_fields: [...fields, shelf].filter((f) => f.entity === entity) })
    }),
    http.post('/api/v1/custom_fields', async ({ request }) => {
      calls.push({ method: 'POST', url: request.url, body: await request.json() })
      return HttpResponse.json({ data: customField() }, { status: 201 })
    }),
    http.patch('/api/v1/custom_fields/reorder', async ({ request }) => {
      calls.push({ method: 'PATCH', url: request.url, body: await request.json() })
      return HttpResponse.json({ custom_fields: [] })
    }),
    http.patch('/api/v1/custom_fields/:id', async ({ request }) => {
      calls.push({ method: 'PATCH', url: request.url, body: await request.json() })
      return HttpResponse.json({ data: centre })
    }),
    http.delete('/api/v1/custom_fields/:id', ({ request }) => {
      calls.push({ method: 'DELETE', url: request.url })
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><CustomFieldsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => serve())
afterEach(() => vi.restoreAllMocks())

describe('CustomFieldsPage', () => {
  it('lists the work order fields in order with their type and flags, those turned off too', async () => {
    renderPage()

    const row = (await screen.findByText('Cost centre')).closest('li')!
    expect(within(row).getByText('Text')).toBeInTheDocument()
    expect(within(row).getByText('Required')).toBeInTheDocument()
    expect(within(row).getByText('In list')).toBeInTheDocument()
    expect(within(screen.getByText('Risk').closest('li')!).getByText('Choice list: Low, High')).toBeInTheDocument()
    expect(within(screen.getByText('Old code').closest('li')!).getByText('Off')).toBeInTheDocument()
    expect(screen.getByText('3 of 20 fields. Turning a field off hides it and keeps what was filled in; deleting it deletes that too.')).toBeInTheDocument()
  })

  it('shows the fields of parts on the other tab', async () => {
    renderPage()
    await screen.findByText('Cost centre')

    await userEvent.click(screen.getByRole('tab', { name: 'Parts' }))

    expect(await screen.findByText('Shelf')).toBeInTheDocument()
    expect(screen.queryByText('Cost centre')).not.toBeInTheDocument()
  })

  it('says so when there are none', async () => {
    serve([])
    renderPage()

    expect(await screen.findByText('No custom fields on work orders yet')).toBeInTheDocument()
    expect(screen.queryByText('Shelf')).not.toBeInTheDocument()
  })

  describe('adding', () => {
    it('sends the record type, name, type and flags', async () => {
      renderPage()
      await screen.findByText('Cost centre')

      await userEvent.click(screen.getByRole('button', { name: /add field/i }))
      await userEvent.type(screen.getByLabelText('Name *'), '  Hazard class ')
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'number')
      await userEvent.click(screen.getByLabelText('Must be filled in'))
      await userEvent.click(screen.getByLabelText('Show as a column in the list'))
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }))

      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].body).toEqual({
        custom_field: { entity: 'work_order', kind: 'number', label: 'Hazard class', options: [], required: true, in_list: true },
      })
    })

    it('adds a field to parts when the Parts tab is open', async () => {
      renderPage()
      await userEvent.click(screen.getByRole('tab', { name: 'Parts' }))
      await screen.findByText('Shelf')

      await userEvent.click(screen.getByRole('button', { name: /add field/i }))
      await userEvent.type(screen.getByLabelText('Name *'), 'Bin')
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }))

      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].body).toMatchObject({ custom_field: { entity: 'part', label: 'Bin' } })
    })

    it('takes the choices of a choice list one to a line, ignoring blanks', async () => {
      renderPage()
      await screen.findByText('Cost centre')

      await userEvent.click(screen.getByRole('button', { name: /add field/i }))
      await userEvent.type(screen.getByLabelText('Name *'), 'Grade')
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'select')
      await userEvent.type(screen.getByLabelText('Choices *'), ' A {Enter}{Enter}B{Enter}')
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }))

      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].body).toMatchObject({ custom_field: { kind: 'select', options: ['A', 'B'] } })
    })

    it('does not ask a yes/no box to be required', async () => {
      renderPage()
      await screen.findByText('Cost centre')

      await userEvent.click(screen.getByRole('button', { name: /add field/i }))
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'checkbox')

      expect(screen.queryByLabelText('Must be filled in')).not.toBeInTheDocument()
    })

    it('does not send required for a yes/no box even if it was ticked before the type was changed', async () => {
      renderPage()
      await screen.findByText('Cost centre')

      await userEvent.click(screen.getByRole('button', { name: /add field/i }))
      await userEvent.type(screen.getByLabelText('Name *'), 'Safe')
      await userEvent.click(screen.getByLabelText('Must be filled in'))
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'checkbox')
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }))

      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].body).toMatchObject({ custom_field: { kind: 'checkbox', required: false } })
    })

    it('wants a name, and choices for a choice list, before it sends anything', async () => {
      renderPage()
      await screen.findByText('Cost centre')
      await userEvent.click(screen.getByRole('button', { name: /add field/i }))

      await userEvent.click(screen.getByRole('button', { name: 'Add field' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Give the field a name.')

      await userEvent.type(screen.getByLabelText('Name *'), 'Grade')
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'select')
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Add at least one choice')
      expect(calls).toHaveLength(0)
    })

    it('stops at 20 fields', async () => {
      serve(Array.from({ length: 20 }, (_, i) => customField({ label: `F${i}`, position: i })))
      renderPage()
      await screen.findByText('F0')

      expect(screen.getByRole('button', { name: /add field/i })).toBeDisabled()
    })
  })

  describe('changing', () => {
    it('sends the new name and flags but cannot change the type', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Edit Risk' }))

      expect(screen.getByLabelText('Type')).toBeDisabled()
      expect(screen.getByLabelText('Choices *')).toHaveValue('Low\nHigh')
      await userEvent.clear(screen.getByLabelText('Name *'))
      await userEvent.type(screen.getByLabelText('Name *'), 'Risk level')
      await userEvent.type(screen.getByLabelText('Choices *'), '{Enter}Medium')
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].url).toContain(`/custom_fields/${risk.id}`)
      expect(calls[0].body).toEqual({ custom_field: { label: 'Risk level', options: ['Low', 'High', 'Medium'], required: false, in_list: false } })
    })

    it('turns a field off and on', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Turn off Cost centre' }))
      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].body).toEqual({ custom_field: { active: false } })

      await userEvent.click(screen.getByRole('button', { name: 'Turn on Old code' }))
      await waitFor(() => expect(calls).toHaveLength(2))
      expect(calls[1].body).toEqual({ custom_field: { active: true } })
    })
  })

  describe('ordering', () => {
    it('moves a field down by sending every id in the new order', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Move Cost centre down' }))

      await waitFor(() => expect(calls).toHaveLength(1))
      expect(calls[0].body).toEqual({ entity: 'work_order', ids: [risk.id, centre.id, old.id] })
    })

    it('cannot move the first up or the last down', async () => {
      renderPage()
      await screen.findByText('Cost centre')

      expect(screen.getByRole('button', { name: 'Move Cost centre up' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Move Old code down' })).toBeDisabled()
    })
  })

  describe('deleting', () => {
    it('says what is lost and deletes after a yes', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Delete Risk' }))

      expect(confirm.mock.calls[0][0]).toContain('is deleted too')
      expect(confirm.mock.calls[0][0]).toContain('turn the field off instead')
      await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: expect.stringContaining(`/custom_fields/${risk.id}`) }]))
    })

    it('does nothing after a no', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Delete Risk' }))

      expect(calls).toHaveLength(0)
    })
  })
})
