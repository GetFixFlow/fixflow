import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { customField } from '@/test/customFields'
import { CustomValues } from '../CustomValues'

const centre = customField({ label: 'Cost centre', position: 1 })
const safe = customField({ label: 'Safe to touch', kind: 'checkbox', position: 2 })
const retired = customField({ label: 'Retired', active: false, position: 3 })
const budget = customField({ label: 'Budget', kind: 'number', position: 4 })

beforeEach(() => {
  server.use(http.get('/api/v1/custom_fields', () => HttpResponse.json({ custom_fields: [centre, safe, retired, budget] })))
})

function renderValues(values: Record<string, string | number | boolean> | undefined) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CustomValues entity="work_order" values={values} />
    </QueryClientProvider>,
  )
}

describe('CustomValues', () => {
  it('lists what is filled in, in the order of the fields, a false box as No', async () => {
    renderValues({ budget: 1500, safe_to_touch: false, cost_centre: 'CC-7' })

    expect(await screen.findByText('CC-7')).toBeInTheDocument()
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Cost centre', 'Safe to touch', 'Budget'])
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(['CC-7', 'No', '1500'])
  })

  it('leaves out fields with nothing in them and fields that are turned off', async () => {
    renderValues({ cost_centre: 'CC-7', retired: 'old data' })

    await screen.findByText('CC-7')
    expect(screen.queryByText('Budget')).not.toBeInTheDocument()
    expect(screen.queryByText('Retired')).not.toBeInTheDocument()
    expect(screen.queryByText('old data')).not.toBeInTheDocument()
  })

  it('shows nothing at all when nothing is filled in', async () => {
    const { container } = renderValues({})
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing for a record with no values', () => {
    const { container } = renderValues(undefined)

    expect(container).toBeEmptyDOMElement()
  })
})
