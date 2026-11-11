import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  placeholder,
  disabled = false,
  error,
  id,
  label,
}: LocationSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

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
    // Escape pressed anywhere inside (the trigger, the tree) closes the list: this only listens, it is not a control.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="w-full"
      ref={containerRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
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
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white py-1 pl-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100',
            value != null && !disabled ? 'pr-14' : 'pr-3',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600',
          )}
          aria-haspopup="tree"
          aria-expanded={open}
        >
          <span className={cn('flex-1 truncate text-left', !displayText && 'text-gray-500 dark:text-gray-400')}>
            {displayText ?? placeholder ?? t('shell.locations.select')}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>
        {/* Beside the trigger, not inside it: a control cannot hold another control. */}
        {value != null && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1.5 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-600"
            aria-label={t('shell.locations.clear')}
          >
            <X className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="max-h-64 overflow-auto">
              {locations.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                  <MapPin className="h-4 w-4" />
                  {t('shell.locations.none_available')}
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
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
