import { cn } from '@/lib/utils'
import type { PmStatus } from '@/types'

interface PMStatusBadgeProps { status: PmStatus; size?: 'sm' | 'md' | 'lg'; className?: string }

const STATUS_CONFIG: Record<PmStatus, { label: string; color: string; pulse: boolean }> = {
  active: { label: 'Active', color: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30', pulse: true },
  paused: { label: 'Paused', color: 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30', pulse: false },
  archived: { label: 'Archived', color: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700', pulse: false },
}

const SIZE_CLASSES = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1', lg: 'text-sm px-3 py-1.5' }
const DOT_SIZES = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2', lg: 'h-2.5 w-2.5' }

export function PMStatusBadge({ status, size = 'md', className }: PMStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium', cfg.color, SIZE_CLASSES[size], className)}>
      <span className={cn('rounded-full', cfg.pulse ? 'bg-green-500 animate-pulse' : status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400', DOT_SIZES[size])} />
      {cfg.label}
    </span>
  )
}
