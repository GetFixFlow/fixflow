import { Link } from 'react-router-dom'
import { Wrench, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PMDueDateDisplay } from './PMDueDateDisplay'
import { PMComplianceMeter } from './PMComplianceMeter'
import { usePMs } from '@/hooks/usePreventiveMaintenance'
import { useAuthStore } from '@/stores/authStore'

interface PMNextDueCardProps { assetId: number }

export function PMNextDueCard({ assetId }: PMNextDueCardProps) {
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const { data, isLoading } = usePMs({ asset_id: assetId, status: 'active' })
  const pms = data?.preventive_maintenances ?? []
  const topPMs = pms.slice(0, 3)

  if (isLoading) return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  )

  const avgCompliance = pms.length > 0
    ? Math.round(pms.reduce((s, p) => s + (p.compliance_rate ?? 0), 0) / pms.length)
    : 0

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-500" />
            Preventive Maintenance
          </h3>
          {pms.length > 0 && <PMComplianceMeter rate={avgCompliance} size="sm" />}
        </div>

        {pms.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No PM schedules for this asset</p>
        ) : (
          <>
            <ul className="space-y-2">
              {topPMs.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between text-sm">
                  <Link to={`/preventive-maintenance/${pm.id}`} className="text-brand-600 hover:underline dark:text-brand-400 truncate max-w-[60%]">
                    {pm.name ?? pm.title}
                  </Link>
                  <PMDueDateDisplay dueDate={pm.next_due_at ?? pm.next_due_date} showIcon={false} className="text-xs" />
                </li>
              ))}
            </ul>
            <Link to={`/preventive-maintenance?asset_id=${assetId}`} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
              View all {pms.length} PM schedules →
            </Link>
          </>
        )}

        {isManager && (
          <Link to={`/preventive-maintenance/new?asset_id=${assetId}`}>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" />Add PM Schedule
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
