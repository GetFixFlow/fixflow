import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Play, Pause, RotateCcw, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { PMStatusBadge } from '@/components/pm/PMStatusBadge'
import { PMScheduleInfo } from '@/components/pm/PMScheduleInfo'
import { PMTemplatePreview } from '@/components/pm/PMTemplatePreview'
import { PMExecutionTable } from '@/components/pm/PMExecutionTable'
import { PMComplianceMeter } from '@/components/pm/PMComplianceMeter'
import { PMUpcomingSchedule } from '@/components/pm/PMUpcomingSchedule'
import { PMGeneratedWOList } from '@/components/pm/PMGeneratedWOList'
import { PMComplianceChart } from '@/components/pm/PMComplianceChart'
import { TriggerPMModal } from '@/components/pm/TriggerPMModal'
import { SkipExecutionModal } from '@/components/pm/SkipExecutionModal'
import { SchedulePreviewModal } from '@/components/pm/SchedulePreviewModal'
import { AssetMiniCard } from '@/components/assets/AssetMiniCard'
import { usePM, usePausePM, useResumePM } from '@/hooks/usePreventiveMaintenance'
import { useAuthStore } from '@/stores/authStore'

export function PMDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pmId = Number(id)
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const [showTrigger, setShowTrigger] = useState(false)
  const [showSchedulePreview, setShowSchedulePreview] = useState(false)
  const [skipTarget, setSkipTarget] = useState<{ executionId: number; scheduledDate: string } | null>(null)

  const { data, isLoading } = usePM(pmId)
  const pm = data?.data
  const pausePM = usePausePM()
  const resumePM = useResumePM()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-60 w-full" /></div>
          <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
        </div>
      </div>
    )
  }

  if (!pm) return <div className="text-center py-20 text-gray-500">PM schedule not found</div>

  const compliance = pm.compliance_rate ?? 0
  const mockTrendData = Array.from({ length: 6 }, (_, i) => ({
    month: new Date(Date.now() - (5 - i) * 30 * 86400000).toLocaleString('default', { month: 'short' }),
    completed: Math.floor(Math.random() * 4) + 1,
    missed: Math.floor(Math.random() * 2),
    compliance: Math.floor(Math.random() * 30) + 70,
  }))

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/preventive-maintenance" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pm.name ?? pm.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <PMStatusBadge status={pm.status} />
              {pm.priority && <span className="capitalize text-sm text-gray-500">{pm.priority} priority</span>}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isManager && (
            <Link to={`/preventive-maintenance/${pm.id}/edit`}>
              <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
            </Link>
          )}
          {isManager && pm.status === 'active' && (
            <Button size="sm" onClick={() => setShowTrigger(true)}>
              <Play className="h-4 w-4 mr-1.5" />Trigger Now
            </Button>
          )}
          {isManager && pm.status === 'active' && (
            <Button variant="outline" size="sm" onClick={() => pausePM.mutate(pm.id)} loading={pausePM.isPending}>
              <Pause className="h-4 w-4 mr-1.5" />Pause
            </Button>
          )}
          {isManager && pm.status === 'paused' && (
            <Button variant="outline" size="sm" onClick={() => resumePM.mutate(pm.id)} loading={resumePM.isPending}>
              <RotateCcw className="h-4 w-4 mr-1.5" />Resume
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowSchedulePreview(true)}>
            <Calendar className="h-4 w-4 mr-1.5" />Preview Schedule
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {pm.description && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{pm.description}</p>
              </CardContent>
            </Card>
          )}

          <PMScheduleInfo pm={pm} />
          <PMTemplatePreview pm={pm} onEdit={isManager ? () => navigate(`/preventive-maintenance/${pm.id}/edit`) : undefined} />

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Execution History</h3>
            <PMExecutionTable
              pmId={pm.id}
              onSkip={(executionId) => {
                setSkipTarget({ executionId, scheduledDate: new Date().toISOString() })
              }}
            />
          </div>
        </div>

        {/* Right (1/3) */}
        <div className="space-y-4">
          {pm.asset && <AssetMiniCard asset={pm.asset} />}

          {/* Compliance stats */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Compliance Rate (90 days)</h3>
              <div className="flex items-center gap-4">
                <PMComplianceMeter rate={compliance} size="lg" />
                <dl className="space-y-1 text-sm">
                  {pm.completed_count != null && <div className="flex gap-2"><dt className="text-gray-400">✅ Completed</dt><dd className="font-medium">{pm.completed_count}</dd></div>}
                  {pm.skipped_count != null && <div className="flex gap-2"><dt className="text-gray-400">⏭ Skipped</dt><dd className="font-medium">{pm.skipped_count}</dd></div>}
                  {pm.missed_count != null && <div className="flex gap-2"><dt className="text-gray-400">❌ Missed</dt><dd className="font-medium">{pm.missed_count}</dd></div>}
                  {pm.generated_count != null && <div className="flex gap-2"><dt className="text-gray-400">📋 Generated</dt><dd className="font-medium">{pm.generated_count}</dd></div>}
                </dl>
              </div>
              <PMComplianceChart data={mockTrendData} />
            </CardContent>
          </Card>

          <PMUpcomingSchedule pmId={pm.id} />

          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Generated Work Orders</h3>
              <PMGeneratedWOList pmId={pm.id} limit={5} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showTrigger && <TriggerPMModal open pm={pm} onClose={() => setShowTrigger(false)} />}
      {showSchedulePreview && <SchedulePreviewModal open pm={pm} pmId={pm.id} onClose={() => setShowSchedulePreview(false)} />}
      {skipTarget && (
        <SkipExecutionModal
          open
          pmId={pm.id}
          executionId={skipTarget.executionId}
          scheduledDate={skipTarget.scheduledDate}
          pm={pm}
          onClose={() => setSkipTarget(null)}
        />
      )}
    </div>
  )
}
