import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { useWorkOrders } from '@/hooks/useWorkOrders'

interface PMGeneratedWOListProps { pmId: number; limit?: number }

export function PMGeneratedWOList({ pmId, limit = 5 }: PMGeneratedWOListProps) {
  const { data, isLoading } = useWorkOrders({ pm_id: pmId, per_page: limit })
  const wos = data?.work_orders ?? []

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  )
  if (wos.length === 0) return <p className="text-sm text-gray-400 italic">No work orders yet</p>

  return (
    <div className="space-y-1">
      {wos.map((wo) => (
        <div key={wo.id} className="flex items-center justify-between py-1 text-sm">
          <Link to={`/work-orders/${wo.id}`} className="text-brand-600 hover:underline dark:text-brand-400 font-mono text-xs">
            {wo.work_order_number}
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadge(wo.status)}>{wo.status.replace('_', ' ')}</Badge>
            <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(wo.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      ))}
      <Link to={`/work-orders?pm_id=${pmId}`} className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400 pt-1">
        View all work orders <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  )
}
