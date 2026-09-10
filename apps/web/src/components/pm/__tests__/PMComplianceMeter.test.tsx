import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PMComplianceMeter } from '../PMComplianceMeter'

describe('PMComplianceMeter', () => {
  it('displays percentage in center', () => {
    render(<PMComplianceMeter rate={87} />)
    expect(screen.getByText('87%')).toBeInTheDocument()
  })

  it('green color for >= 90%', () => {
    render(<PMComplianceMeter rate={95} />)
    const text = screen.getByText('95%')
    expect(text).toHaveStyle({ color: '#22c55e' })
  })

  it('yellow color for 70-89%', () => {
    render(<PMComplianceMeter rate={75} />)
    const text = screen.getByText('75%')
    expect(text).toHaveStyle({ color: '#eab308' })
  })

  it('red color for < 70%', () => {
    render(<PMComplianceMeter rate={60} />)
    const text = screen.getByText('60%')
    expect(text).toHaveStyle({ color: '#ef4444' })
  })

  it('has accessible aria-label', () => {
    render(<PMComplianceMeter rate={87} />)
    expect(screen.getByRole('img', { name: /compliance: 87%/i })).toBeInTheDocument()
  })
})
