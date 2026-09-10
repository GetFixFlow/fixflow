import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Location } from '@/types'
import { LocationTree } from './LocationTree'
import { getLocationPath } from '@/utils/locationUtils'

interface LocationSelectProps {
  locations: Location[]
  value?: number | null
  onChange: (id: number | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  id?: string
  label?: string
}

export function LocationSelect({
  locations,
  value,
  onChange,
  placeholder = 'Select a location...',
  disabled = false,
  error,
  id,
  label,
}: LocationSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedPath = value != null ? getLocationPath(locations, value) : []
  const displayText =
    selectedPath.length > 0 ? selectedPath.map((l) => l.name).join(' > ') : null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600',
          )}
          aria-haspopup="tree"
          aria-expanded={open}
        >
          <span className={cn('flex-1 truncate text-left', !displayText && 'text-gray-400')}>
            {displayText ?? placeholder}
          </span>
          <span className="flex items-center gap-1">
            {value != null && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && onChange(null)}
                className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="max-h-64 overflow-auto">
              {locations.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  No locations available
                </div>
              ) : (
                <LocationTree
                  locations={locations}
                  selectedId={value}
                  onSelect={(loc) => {
                    onChange(loc.id)
                    setOpen(false)
                  }}
                  searchable
                  expandedByDefault
                />
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
