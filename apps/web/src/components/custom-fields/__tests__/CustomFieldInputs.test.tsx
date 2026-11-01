import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomFieldInputs } from '../CustomFieldInputs'
import { customField } from '@/test/customFields'

const centre = customField({ label: 'Cost centre', required: true })
const budget = customField({ label: 'Budget', kind: 'number' })
const review = customField({ label: 'Review on', kind: 'date' })
const risk = customField({ label: 'Risk', kind: 'select', options: ['Low', 'High'] })
const safe = customField({ label: 'Safe to touch', kind: 'checkbox' })

describe('CustomFieldInputs', () => {
  it('shows an input of the right kind for each field, with a star on the required ones', () => {
    render(<CustomFieldInputs fields={[centre, budget, review, risk, safe]} values={{}} onChange={() => {}} />)

    expect(screen.getByLabelText('Cost centre *')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Budget')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('Review on')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Risk').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Safe to touch')).toHaveAttribute('type', 'checkbox')
  })

  it('shows what is filled in', () => {
    render(<CustomFieldInputs fields={[centre, risk, safe]} values={{ cost_centre: 'CC-1', risk: 'High', safe_to_touch: true }} onChange={() => {}} />)

    expect(screen.getByLabelText('Cost centre *')).toHaveValue('CC-1')
    expect(screen.getByLabelText('Risk')).toHaveValue('High')
    expect(screen.getByLabelText('Safe to touch')).toBeChecked()
  })

  it('hands back all the values with the one that changed', async () => {
    const onChange = vi.fn()
    render(<CustomFieldInputs fields={[centre, safe]} values={{ cost_centre: 'CC-', other: 'kept' }} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Cost centre *'), '7')
    expect(onChange).toHaveBeenLastCalledWith({ cost_centre: 'CC-7', other: 'kept' })

    await userEvent.click(screen.getByLabelText('Safe to touch'))
    expect(onChange).toHaveBeenLastCalledWith({ cost_centre: 'CC-', other: 'kept', safe_to_touch: true })
  })

  it('offers the choices, and lets one pick be cleared', async () => {
    const onChange = vi.fn()
    render(<CustomFieldInputs fields={[risk]} values={{ risk: 'Low' }} onChange={onChange} />)

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['—', 'Low', 'High'])
    await userEvent.selectOptions(screen.getByLabelText('Risk'), '')
    expect(onChange).toHaveBeenLastCalledWith({ risk: '' })
  })

  it('asks for a choice when the list is required', () => {
    render(<CustomFieldInputs fields={[{ ...risk, required: true }]} values={{}} onChange={() => {}} />)

    expect(screen.getByRole('option', { name: 'Choose…' })).toBeInTheDocument()
  })

  it('keeps a choice that has since been removed, so editing something else does not drop it', () => {
    render(<CustomFieldInputs fields={[risk]} values={{ risk: 'Medium' }} onChange={() => {}} />)

    expect(screen.getByLabelText('Risk')).toHaveValue('Medium')
  })

  it('says what is wrong under a field', () => {
    render(<CustomFieldInputs fields={[centre]} values={{}} onChange={() => {}} errors={{ cost_centre: 'Cost centre is required' }} />)

    expect(screen.getByText('Cost centre is required')).toBeInTheDocument()
  })

  it('shows nothing for no fields', () => {
    const { container } = render(<CustomFieldInputs fields={[]} values={{}} onChange={() => {}} />)

    expect(container.querySelectorAll('input, select')).toHaveLength(0)
  })
})
