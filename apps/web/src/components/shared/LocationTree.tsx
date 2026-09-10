import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ChevronRight,
  Building2,
  Layers,
  MapPin,
  Factory,
  DoorOpen,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import type { Location, LocationTreeNode, LocationType } from '@/types'
import { buildLocationTree } from '@/utils/locationUtils'

export interface LocationTreeProps {
  locations: Location[]
  selectedId?: number | null
  onSelect?: (location: Location) => void
  expandedByDefault?: boolean
  showAssetCount?: boolean
  selectable?: boolean
  searchable?: boolean
  className?: string
  onAddChild?: (parent: Location) => void
  onEdit?: (location: Location) => void
  onDelete?: (location: Location) => void
}

const TYPE_ICONS: Record<LocationType, React.ElementType> = {
  site: Factory,
  building: Building2,
  floor: Layers,
  room: DoorOpen,
  zone: MapPin,
}

function LocationNode({
  node,
  selectedId,
  onSelect,
  showAssetCount,
  selectable,
  defaultExpanded,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: LocationTreeNode
  selectedId?: number | null
  onSelect?: (loc: Location) => void
  showAssetCount?: boolean
  selectable?: boolean
  defaultExpanded?: boolean
  onAddChild?: (parent: Location) => void
  onEdit?: (location: Location) => void
  onDelete?: (location: Location) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? node.depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id
  const Icon = TYPE_ICONS[node.location_type] ?? MapPin
  const nodeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSelected && nodeRef.current) {
      nodeRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [isSelected])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (selectable !== false && onSelect) onSelect(node)
      }
      if (e.key === 'ArrowRight' && !expanded) setExpanded(true)
      if (e.key === 'ArrowLeft' && expanded) setExpanded(false)
    },
    [expanded, selectable, onSelect, node],
  )

  const hasContextMenu = onAddChild || onEdit || onDelete

  return (
    <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? expanded : undefined}>
      <div
        ref={nodeRef}
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          isSelected
            ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50',
          selectable !== false && 'cursor-pointer',
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => {
          if (selectable !== false && onSelect) onSelect(node)
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={node.name}
      >
        {/* Expand/collapse chevron */}
        <button
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-transform',
            expanded && 'rotate-90',
            !hasChildren && 'invisible',
          )}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          tabIndex={-1}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />

        <span className="flex-1 truncate font-medium">{node.name}</span>

        {showAssetCount && node.asset_count != null && node.asset_count > 0 && (
          <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300">
            {node.asset_count}
          </span>
        )}

        {hasChildren && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {node.children.length}
          </span>
        )}

        {hasContextMenu && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="invisible ml-1 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200 group-hover:visible dark:hover:bg-gray-600"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
                aria-label="Location options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[150px] rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800"
                sideOffset={4}
              >
                {onAddChild && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    onClick={(e) => { e.stopPropagation(); onAddChild(node) }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add child
                  </DropdownMenu.Item>
                )}
                {onEdit && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </DropdownMenu.Item>
                )}
                {onDelete && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={(e) => { e.stopPropagation(); onDelete(node) }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child) => (
            <LocationNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              showAssetCount={showAssetCount}
              selectable={selectable}
              defaultExpanded={defaultExpanded}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LocationTreeSkeleton() {
  return (
    <div className="space-y-1 p-2" aria-busy="true" aria-label="Loading locations">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded-md bg-gray-100 dark:bg-gray-700"
          style={{ marginLeft: `${(i % 3) * 16}px` }}
        />
      ))}
    </div>
  )
}

export function LocationTree({
  locations,
  selectedId,
  onSelect,
  expandedByDefault,
  showAssetCount = false,
  selectable = true,
  searchable = false,
  className,
  onAddChild,
  onEdit,
  onDelete,
}: LocationTreeProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? locations.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations

  const tree = buildLocationTree(filtered)

  return (
    <div className={cn('overflow-auto', className)}>
      {searchable && (
        <div className="p-2">
          <input
            type="search"
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label="Search locations"
          />
        </div>
      )}

      {tree.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {search ? 'No locations match your search.' : 'No locations yet.'}
        </p>
      ) : (
        <div role="tree" aria-label="Location hierarchy" className="p-1">
          {tree.map((node) => (
            <LocationNode
              key={node.id}
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
              showAssetCount={showAssetCount}
              selectable={selectable}
              defaultExpanded={expandedByDefault}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export { LocationTreeSkeleton }
