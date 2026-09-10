import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface LiveReadingBadgeProps {
  lastReadingAt?: string | null
  className?: string
}

function getAgeSeconds(iso?: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function LiveReadingBadge({ lastReadingAt, className }: LiveReadingBadgeProps) {
  const ageSeconds = useMemo(() => getAgeSeconds(lastReadingAt), [lastReadingAt])

  if (ageSeconds === null) return <span className={cn('text-xs text-gray-400', className)}>No data</span>

  const isLive = ageSeconds < 60
  const isRecent = ageSeconds < 300
  const isStale = ageSeconds < 3600
  const isOffline = ageSeconds >= 3600

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className,
      isLive ? 'text-green-600 dark:text-green-400' :
      isRecent ? 'text-yellow-600 dark:text-yellow-400' :
      isStale ? 'text-orange-500 dark:text-orange-400' :
      'text-red-500 dark:text-red-400')}>
      <span className={cn('h-2 w-2 rounded-full shrink-0',
        isLive ? 'bg-green-500 animate-pulse' :
        isRecent ? 'bg-yellow-500' :
        isStale ? 'bg-orange-500' : 'bg-red-500')} />
      {isLive ? 'Live' : isOffline ? 'Offline' : formatAge(ageSeconds)}
    </span>
  )
}
