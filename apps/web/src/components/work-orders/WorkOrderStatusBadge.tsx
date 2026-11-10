import { label } from '@/i18n'
import { useTranslation } from 'react-i18next'
import {
  Circle,
  UserCheck,
  PlayCircle,
  PauseCircle,
  Package,
  CheckCircle,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { WorkOrderStatus } from '@/types'

const STATUS_ICONS: Record<WorkOrderStatus, React.ElementType> = {
  open: Circle,
  assigned: UserCheck,
  in_progress: PlayCircle,
  on_hold: PauseCircle,
  pending_parts: Package,
  completed: CheckCircle,
  verified: ShieldCheck,
  cancelled: XCircle,
}

interface WorkOrderStatusBadgeProps {
  status: WorkOrderStatus
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export function WorkOrderStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: WorkOrderStatusBadgeProps) {
  const { t } = useTranslation()
  const Icon = STATUS_ICONS[status]
  const text = label('status', status)

  return (
    <Badge
      variant={statusBadge(status)}
      className={cn(
        size === 'sm' && 'px-1.5 py-0 text-[10px]',
        size === 'lg' && 'px-3 py-1 text-sm',
        'gap-1',
        className,
      )}
      aria-label={t('workOrders.badge.status', { status: text })}
    >
      {showIcon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />}
      {text}
    </Badge>
  )
}
