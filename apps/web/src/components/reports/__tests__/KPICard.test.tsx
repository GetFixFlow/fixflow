import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPICard } from '../KPICard'

describe('KPICard', () => {
  it('renders title and value', () => {
    render(<KPICard title="Total WOs" value={42} />)
    expect(screen.getByText('Total WOs')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders loading skeleton', () => {
    const { container } = render(<KPICard title="Loading" value="" loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders trend information', () => {
    render(<KPICard title="Completion" value="80%" changePercent={5.2} trend="improved" />)
    expect(screen.getByText(/5\.2%/)).toBeInTheDocument()
  })

  it('renders subtitle', () => {
    render(<KPICard title="Test" value={100} subtitle="This month" />)
    expect(screen.getByText('This month')).toBeInTheDocument()
  })

  it('is clickable when onClick provided', async () => {
    const onClick = vi.fn()
    const { getByText } = render(<KPICard title="Clickable" value={1} onClick={onClick} />)
    getByText('Clickable').closest('[class*="cursor-pointer"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
