import { ClipboardList } from 'lucide-react'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, statusBadge, priorityBadge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { format } from 'date-fns'

export function WorkOrdersPage() {
  const { data, isLoading } = useWorkOrders()
  const workOrders = data?.work_orders ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Orders"
        description="Track and manage maintenance tasks"
        actions={<Button>New Work Order</Button>}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-4 w-64" />
                <Skeleton className="h-3 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No work orders"
          description="Create your first work order to get started."
          action={{ label: 'New Work Order', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {workOrders.map((wo) => (
            <Card key={wo.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{wo.work_order_number}</span>
                      <Badge variant={priorityBadge(wo.priority)}>{wo.priority}</Badge>
                    </div>
                    <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{wo.title}</p>
                    {wo.due_date && (
                      <p className="mt-1 text-xs text-gray-500">
                        Due {format(new Date(wo.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusBadge(wo.status)}>
                    {wo.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
