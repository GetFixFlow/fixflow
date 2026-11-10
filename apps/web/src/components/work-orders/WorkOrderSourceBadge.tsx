import { useTranslation } from 'react-i18next'
import { User, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkOrderSource } from '@/types'

const SOURCE_CONFIG: Record<
  WorkOrderSource,
  { labelKey: string; Icon: React.ElementType; className: string }
> = {
  manual: {
    labelKey: 'workOrders.source.manual',
    Icon: User,
    className: 'text-gray-600 dark:text-gray-400',
  },
  pm: {
    labelKey: 'workOrders.source.pm',
    Icon: RefreshCw,
    className: 'text-blue-600 dark:text-blue-400',
  },
  iot_rule: {
    labelKey: 'workOrders.source.iot_rule',
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
  const { t } = useTranslation()
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.manual
  const { Icon } = config
  const label = t(config.labelKey)

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
