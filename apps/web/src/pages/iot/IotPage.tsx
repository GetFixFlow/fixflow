import { Radio } from 'lucide-react'
import { useIotAlerts, useAcknowledgeAlert, useResolveAlert } from '@/hooks/useIoT'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { formatDistanceToNow } from 'date-fns'

export function IotPage() {
  const { data, isLoading } = useIotAlerts({ status: 'open' })
  const alerts = data?.iot_alerts ?? []
  const { mutate: acknowledge } = useAcknowledgeAlert()
  const { mutate: resolve } = useResolveAlert()

  const severityVariant = (s: string) =>
    s === 'critical' ? 'destructive' : s === 'warning' ? 'warning' : 'default'

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Alerts"
        description="Monitor sensor alerts from your assets"
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No open alerts"
          description="All IoT alerts have been resolved."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {alert.message}
                    </p>
                    <p className="text-xs text-gray-500">Value: {alert.sensor_value}</p>
                  </div>
                  <div className="flex gap-2">
                    {alert.status === 'open' && (
                      <Button size="sm" variant="outline" onClick={() => acknowledge(alert.id)}>
                        Acknowledge
                      </Button>
                    )}
                    {alert.status !== 'resolved' && (
                      <Button size="sm" variant="ghost" onClick={() => resolve(alert.id)}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
