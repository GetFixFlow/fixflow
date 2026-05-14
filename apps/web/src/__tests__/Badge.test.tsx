import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, priorityBadge, statusBadge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>open</Badge>)
    expect(screen.getByText('open')).toBeInTheDocument()
  })

  it('applies success variant', () => {
    render(<Badge variant="success">Operational</Badge>)
    const el = screen.getByText('Operational')
    expect(el.className).toContain('bg-green')
  })
})

describe('priorityBadge', () => {
  it('maps critical to destructive', () => {
    expect(priorityBadge('critical')).toBe('destructive')
  })
  it('maps low to secondary', () => {
    expect(priorityBadge('low')).toBe('secondary')
  })
})

describe('statusBadge', () => {
  it('maps completed to success', () => {
    expect(statusBadge('completed')).toBe('success')
  })
  it('maps in_progress to warning', () => {
    expect(statusBadge('in_progress')).toBe('warning')
  })
})
