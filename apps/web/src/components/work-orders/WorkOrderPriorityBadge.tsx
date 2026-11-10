import { label } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { Flame, ChevronUp, Minus, ChevronDown } from 'lucide-react'
import { Badge, priorityBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Priority } from '@/types'

const PRIORITY_ICONS: Record<Priority, React.ElementType> = {
  critical: Flame,
  high: ChevronUp,
  medium: Minus,
  low: ChevronDown,
}

interface WorkOrderPriorityBadgeProps {
  priority: Priority
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export function WorkOrderPriorityBadge({
  priority,
  size = 'md',
  showIcon = true,
  className,
}: WorkOrderPriorityBadgeProps) {
  const { t } = useTranslation()
  const Icon = PRIORITY_ICONS[priority]
  const text = label('priority', priority)

  return (
    <Badge
      variant={priorityBadge(priority)}
      className={cn(
        size === 'sm' && 'px-1.5 py-0 text-[10px]',
        size === 'lg' && 'px-3 py-1 text-sm',
        'gap-1 uppercase tracking-wide',
        className,
      )}
      aria-label={t('workOrders.badge.priority', { priority: text })}
    >
      {showIcon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />}
      {text}
    </Badge>
  )
}
