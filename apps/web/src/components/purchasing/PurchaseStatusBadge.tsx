import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import type { PurchaseOrderStatus } from '@/types'

const VARIANT: Record<PurchaseOrderStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  requested: 'warning',
  approved: 'default',
  ordered: 'default',
  partially_received: 'warning',
  received: 'success',
  rejected: 'destructive',
  cancelled: 'secondary',
}

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANT[status]}>{t(`purchasing.status.${status}`)}</Badge>
}
