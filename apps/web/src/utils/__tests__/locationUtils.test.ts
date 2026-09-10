import { describe, it, expect } from 'vitest'
import {
  buildLocationTree,
  flattenTree,
  getLocationPath,
  getLocationChildren,
} from '../locationUtils'
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
  {
    id: 4, name: 'Room 101', location_type: 'room', parent_id: 3,
    organization_id: 1, created_at: '', updated_at: '',
  },
  {
    id: 5, name: 'Building B', location_type: 'building', parent_id: 1,
    organization_id: 1, created_at: '', updated_at: '',
  },
]

describe('buildLocationTree', () => {
  it('creates correct nested structure', () => {
    const tree = buildLocationTree(mockLocations)
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('Site A')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children[0].name).toBe('Building A')
    expect(tree[0].children[0].children[0].name).toBe('Floor 1')
  })

  it('sets correct depth values', () => {
    const tree = buildLocationTree(mockLocations)
    expect(tree[0].depth).toBe(0)
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('sets path strings correctly', () => {
    const tree = buildLocationTree(mockLocations)
    const building = tree[0].children[0]
    expect(building.path).toBe('Site A > Building A')
    expect(building.children[0].path).toBe('Site A > Building A > Floor 1')
  })

  it('handles locations with no parent as roots', () => {
    const unrooted: Location[] = [
      { id: 10, name: 'Orphan', location_type: 'site', parent_id: 999, organization_id: 1, created_at: '', updated_at: '' },
    ]
    const tree = buildLocationTree(unrooted)
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('Orphan')
  })

  it('handles circular reference gracefully', () => {
    const circular: Location[] = [
      { id: 1, name: 'A', location_type: 'site', parent_id: 2, organization_id: 1, created_at: '', updated_at: '' },
      { id: 2, name: 'B', location_type: 'site', parent_id: 1, organization_id: 1, created_at: '', updated_at: '' },
    ]
    expect(() => buildLocationTree(circular)).not.toThrow()
  })
})

describe('flattenTree', () => {
  it('returns all nodes in flat array', () => {
    const tree = buildLocationTree(mockLocations)
    const flat = flattenTree(tree)
    expect(flat).toHaveLength(mockLocations.length)
  })

  it('preserves all location ids', () => {
    const tree = buildLocationTree(mockLocations)
    const flat = flattenTree(tree)
    const ids = flat.map((l) => l.id).sort()
    expect(ids).toEqual([1, 2, 3, 4, 5])
  })
})

describe('getLocationPath', () => {
  it('returns correct breadcrumb array', () => {
    const path = getLocationPath(mockLocations, 4)
    expect(path.map((l) => l.name)).toEqual(['Site A', 'Building A', 'Floor 1', 'Room 101'])
  })

  it('returns single item for root', () => {
    const path = getLocationPath(mockLocations, 1)
    expect(path).toHaveLength(1)
    expect(path[0].name).toBe('Site A')
  })

  it('returns empty array for unknown id', () => {
    const path = getLocationPath(mockLocations, 999)
    expect(path).toHaveLength(0)
  })
})

describe('getLocationChildren', () => {
  it('returns direct children only', () => {
    const children = getLocationChildren(mockLocations, 1)
    expect(children).toHaveLength(2)
    expect(children.map((c) => c.name)).toContain('Building A')
    expect(children.map((c) => c.name)).toContain('Building B')
  })

  it('returns empty for leaf nodes', () => {
    const children = getLocationChildren(mockLocations, 4)
    expect(children).toHaveLength(0)
  })
})
