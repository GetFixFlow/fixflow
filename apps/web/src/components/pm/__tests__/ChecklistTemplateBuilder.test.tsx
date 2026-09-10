import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChecklistTemplateBuilder } from '../ChecklistTemplateBuilder'
import type { PMChecklistStep } from '@/types'

const mockSteps: PMChecklistStep[] = [
  { step: 1, instruction: 'Shut down pump', required: true },
  { step: 2, instruction: 'Check oil level', required: true },
  { step: 3, instruction: 'Test run', required: false },
]

describe('ChecklistTemplateBuilder', () => {
  it('renders existing steps', () => {
    render(<ChecklistTemplateBuilder value={mockSteps} onChange={() => {}} />)
    expect(screen.getByDisplayValue('Shut down pump')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Check oil level')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test run')).toBeInTheDocument()
  })

  it('add step appends empty row', async () => {
    let steps = [...mockSteps]
    const { rerender } = render(<ChecklistTemplateBuilder value={steps} onChange={(v) => { steps = v }} />)
    await userEvent.click(screen.getByRole('button', { name: /add step/i }))
    rerender(<ChecklistTemplateBuilder value={steps} onChange={(v) => { steps = v }} />)
    expect(steps).toHaveLength(4)
  })

  it('delete step removes row', async () => {
    // Steps with empty instruction don't require confirmation
    const stepsWithEmpty = [
      { step: 1, instruction: 'Shut down pump', required: true },
      { step: 2, instruction: 'Check oil level', required: true },
      { step: 3, instruction: '', required: false }, // empty instruction — no confirm needed
    ]
    let steps = [...stepsWithEmpty]
    const { rerender } = render(<ChecklistTemplateBuilder value={steps} onChange={(v) => { steps = v }} />)
    const deleteButtons = screen.getAllByLabelText(/delete step/i)
    await userEvent.click(deleteButtons[2]) // delete step 3 (empty, no confirm)
    rerender(<ChecklistTemplateBuilder value={steps} onChange={(v) => { steps = v }} />)
    expect(steps).toHaveLength(2)
  })

  it('required toggle changes step required field', async () => {
    let steps = [...mockSteps]
    render(<ChecklistTemplateBuilder value={steps} onChange={(v) => { steps = v }} />)
    // Step 3 is optional — click its "Optional" toggle to make it required
    const optionalButtons = screen.getAllByText('Optional')
    await userEvent.click(optionalButtons[0])
    expect(steps[2].required).toBe(true)
  })

  it('shows empty state when no steps', () => {
    render(<ChecklistTemplateBuilder value={[]} onChange={() => {}} />)
    expect(screen.getByText(/no steps yet/i)).toBeInTheDocument()
  })

  it('respects 50 step limit', async () => {
    const fiftySteps = Array.from({ length: 50 }, (_, i) => ({ step: i + 1, instruction: `Step ${i + 1}`, required: true }))
    render(<ChecklistTemplateBuilder value={fiftySteps} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add step/i })).toBeDisabled()
  })

  it('shows step count', () => {
    render(<ChecklistTemplateBuilder value={mockSteps} onChange={() => {}} />)
    expect(screen.getByText('3/50')).toBeInTheDocument()
  })
})
