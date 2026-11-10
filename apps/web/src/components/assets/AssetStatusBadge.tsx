import { Badge, statusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { label } from '@/i18n'
import type { AssetStatus } from '@/types'

interface AssetStatusBadgeProps {
  status: AssetStatus
  className?: string
}

export function AssetStatusBadge({ status, className }: AssetStatusBadgeProps) {
  return (
    <Badge variant={statusBadge(status)} className={cn('capitalize', className)}>
      {label('status', status)}
    </Badge>
  )
}
