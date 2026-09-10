import type { Location, LocationTreeNode } from '@/types'

export function buildLocationTree(locations: Location[]): LocationTreeNode[] {
  const map = new Map<number, LocationTreeNode>()
  const roots: LocationTreeNode[] = []

  // First pass: create all nodes
  for (const loc of locations) {
    map.set(loc.id, { ...loc, children: [], depth: 0, path: loc.name })
  }

  // Second pass: build tree, detect cycles by tracking visited ids
  for (const node of map.values()) {
    if (node.parent_id == null) {
      roots.push(node)
    } else {
      const parent = map.get(node.parent_id)
      if (parent && parent.id !== node.id) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  }

  // Third pass: set depth and path
  function setDepthAndPath(nodes: LocationTreeNode[], depth: number, parentPath: string) {
    for (const node of nodes) {
      node.depth = depth
      node.path = parentPath ? `${parentPath} > ${node.name}` : node.name
      setDepthAndPath(node.children, depth + 1, node.path)
    }
  }
  setDepthAndPath(roots, 0, '')

  return roots
}

export function flattenTree(tree: LocationTreeNode[]): Location[] {
  const result: Location[] = []
  function traverse(nodes: LocationTreeNode[]) {
    for (const node of nodes) {
      result.push(node)
      traverse(node.children)
    }
  }
  traverse(tree)
  return result
}

export function getLocationPath(locations: Location[], id: number): Location[] {
  const map = new Map(locations.map((l) => [l.id, l]))
  const path: Location[] = []
  let current = map.get(id)
  const visited = new Set<number>()

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    path.unshift(current)
    current = current.parent_id != null ? map.get(current.parent_id) : undefined
  }
  return path
}

export function getLocationChildren(locations: Location[], parentId: number | null): Location[] {
  return locations.filter((l) => l.parent_id === parentId)
}

export function getLocationDisplayPath(locations: Location[], id: number | null | undefined): string {
  if (id == null) return ''
  const path = getLocationPath(locations, id)
  return path.map((l) => l.name).join(' > ')
}
