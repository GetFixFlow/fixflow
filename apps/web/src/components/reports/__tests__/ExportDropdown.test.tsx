import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExportDropdown } from '../ExportDropdown'

vi.mock('@/services/exportService', () => ({
  copyShareLink: vi.fn(),
}))

describe('ExportDropdown', () => {
  it('renders export button', () => {
    render(<ExportDropdown onExportCSV={vi.fn()} />)
    expect(screen.getByText(/Export/)).toBeInTheDocument()
  })

  it('has export button with popup role', () => {
    render(<ExportDropdown onExportCSV={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /Export/ })
    // Radix DropdownMenu.Trigger sets aria-haspopup on the button
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('shows loading state', () => {
    const { container } = render(<ExportDropdown onExportCSV={vi.fn()} isExporting />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
