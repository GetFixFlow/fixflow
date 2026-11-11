import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '../Input'

describe('Input, for a screen reader', () => {
  it('is named by its label even when the caller gave it no id', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('says it is invalid and reads the error with the field, and announces the error when it appears', () => {
    const { rerender } = render(<Input label="Email" id="email" />)
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')

    rerender(<Input label="Email" id="email" error="Enter a valid email" />)
    const field = screen.getByLabelText('Email')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter a valid email')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email')
  })

  it('keeps a description the caller gave, beside the error', () => {
    render(<><p id="hint">At least 10 characters</p><Input label="Password" id="pw" aria-describedby="hint" error="Too short" /></>)
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Too short At least 10 characters')
  })
})
