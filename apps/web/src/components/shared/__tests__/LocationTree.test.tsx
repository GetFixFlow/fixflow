import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocationTree } from '../LocationTree'
import type { Location } from '@/types'

const mockLocations: Location[] = [
  {
    id: 1, name: 'Site A', location_type: 'site', parent_id: null,
    organization_id: 1, created_at: '', updated_at: '',
  },
  {
    id: 2, name: 'Building A', location_type: 'building', parent_id: 1,
    organization_id: 1, created_at: '', updated_at: '',
  },
  {
    id: 3, name: 'Floor 1', location_type: 'floor', parent_id: 2,
    organization_id: 1, created_at: '', updated_at: '',
  },
]

describe('LocationTree', () => {
  it('renders tree structure correctly', () => {
    render(<LocationTree locations={mockLocations} expandedByDefault />)
    expect(screen.getByText('Site A')).toBeInTheDocument()
    expect(screen.getByText('Building A')).toBeInTheDocument()
    expect(screen.getByText('Floor 1')).toBeInTheDocument()
  })

  it('shows empty state when no locations', () => {
    render(<LocationTree locations={[]} />)
    expect(screen.getByText(/no locations yet/i)).toBeInTheDocument()
  })

  it('highlights selected node', () => {
    render(<LocationTree locations={mockLocations} selectedId={1} expandedByDefault />)
    // The selected node should have aria-selected=true
    const selected = document.querySelector('[aria-selected="true"]')
    expect(selected).not.toBeNull()
  })

  it('calls onSelect with correct location', async () => {
    const onSelect = vi.fn()
    render(<LocationTree locations={mockLocations} onSelect={onSelect} expandedByDefault />)
    await userEvent.click(screen.getByRole('button', { name: 'Building A' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 2, name: 'Building A' }))
  })

  it('search filters visible nodes', async () => {
    render(<LocationTree locations={mockLocations} searchable />)
    const searchInput = screen.getByPlaceholderText(/search locations/i)
    await userEvent.type(searchInput, 'Floor')
    expect(screen.getByText('Floor 1')).toBeInTheDocument()
    expect(screen.queryByText('Building A')).not.toBeInTheDocument()
  })

  it('shows no match message for unmatched search', async () => {
    render(<LocationTree locations={mockLocations} searchable />)
    const searchInput = screen.getByPlaceholderText(/search locations/i)
    await userEvent.type(searchInput, 'xyz-nonexistent')
    expect(screen.getByText(/no locations match/i)).toBeInTheDocument()
  })

  it('expand/collapse works on click', async () => {
    render(<LocationTree locations={mockLocations} />)
    const expandBtn = screen.getAllByRole('button', { name: /expand/i })[0]
    await userEvent.click(expandBtn)
    expect(screen.getByText('Building A')).toBeInTheDocument()
  })
})
