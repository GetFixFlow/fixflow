import { Badge } from '@/components/ui/Badge'
import type { PurchaseOrderStatus } from '@/types'

const LOOK: Record<PurchaseOrderStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  requested: { label: 'Waiting for approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'default' },
  ordered: { label: 'Ordered', variant: 'default' },
  partially_received: { label: 'Partly received', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  rejected: { label: 'Turned down', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { label, variant } = LOOK[status]
  return <Badge variant={variant}>{label}</Badge>
}
