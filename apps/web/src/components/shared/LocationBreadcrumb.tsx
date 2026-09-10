import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Location } from '@/types'
import { getLocationPath } from '@/utils/locationUtils'

interface LocationBreadcrumbProps {
  locations: Location[]
  locationId: number | null | undefined
  onNavigate?: (location: Location) => void
  className?: string
  compact?: boolean
}

export function LocationBreadcrumb({
  locations,
  locationId,
  onNavigate,
  className,
  compact = false,
}: LocationBreadcrumbProps) {
  if (!locationId) return null

  const path = getLocationPath(locations, locationId)
  if (path.length === 0) return <span className="text-sm text-gray-400">Unknown location</span>

  const displayPath = compact && path.length > 2 ? [path[0], path[path.length - 1]] : path

  return (
    <nav aria-label="Location path" className={cn('flex items-center gap-1', className)}>
      {displayPath.map((loc, index) => {
        const isLast = index === displayPath.length - 1
        const isEllipsis = compact && path.length > 2 && index === 1 && path.length > 2

        return (
          <span key={loc.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
            )}
            {compact && index === 1 && path.length > 2 && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="text-gray-400">…</span>
              </>
            )}
            {isLast || !onNavigate ? (
              <span
                className={cn(
                  'text-sm',
                  isLast ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
                )}
              >
                {loc.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(loc)}
                className="text-sm text-gray-500 hover:text-brand-600 hover:underline dark:text-gray-400 dark:hover:text-brand-400"
              >
                {loc.name}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
