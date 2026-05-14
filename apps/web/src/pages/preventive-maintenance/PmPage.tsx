import { Wrench } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { pmApi } from '@/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { format } from 'date-fns'

export function PmPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['preventive_maintenances'],
    queryFn: () => pmApi.list().then((r) => r.data),
  })
  const pms = data?.preventive_maintenances ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preventive Maintenance"
        description="Manage recurring maintenance schedules"
        actions={<Button>New Schedule</Button>}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : pms.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No PM schedules"
          description="Create your first preventive maintenance schedule."
          action={{ label: 'New Schedule', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {pms.map((pm) => (
            <Card key={pm.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{pm.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {pm.frequency} · Next due: {format(new Date(pm.next_due_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant={statusBadge(pm.status)}>{pm.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
