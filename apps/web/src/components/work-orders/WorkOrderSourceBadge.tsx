import { User, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkOrderSource } from '@/types'

const SOURCE_CONFIG: Record<
  WorkOrderSource,
  { label: string; Icon: React.ElementType; className: string }
> = {
  manual: {
    label: 'Manual',
    Icon: User,
    className: 'text-gray-600 dark:text-gray-400',
  },
  pm: {
    label: 'Preventive',
    Icon: RefreshCw,
    className: 'text-blue-600 dark:text-blue-400',
  },
  iot_rule: {
    label: 'IoT Alert',
    Icon: Zap,
    className: 'text-yellow-600 dark:text-yellow-400',
  },
}

interface WorkOrderSourceBadgeProps {
  source: WorkOrderSource
  showLabel?: boolean
  className?: string
}

export function WorkOrderSourceBadge({
  source,
  showLabel = true,
  className,
}: WorkOrderSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.manual
  const { label, Icon } = config

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs', config.className, className)}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {showLabel && label}
    </span>
  )
}
