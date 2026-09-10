import { Badge, statusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { AssetStatus } from '@/types'

const STATUS_LABELS: Record<AssetStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  decommissioned: 'Decommissioned',
  maintenance: 'Maintenance',
  offline: 'Offline',
  retired: 'Retired',
}

interface AssetStatusBadgeProps {
  status: AssetStatus
  className?: string
}

export function AssetStatusBadge({ status, className }: AssetStatusBadgeProps) {
  return (
    <Badge variant={statusBadge(status)} className={cn('capitalize', className)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
