import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreVertical, Play, Pause, RotateCcw, Archive, Eye, Pencil, Zap } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PMStatusBadge } from './PMStatusBadge'
import { PMFrequencyBadge } from './PMFrequencyBadge'
import { PMDueDateDisplay } from './PMDueDateDisplay'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { PreventiveMaintenance } from '@/types'

interface PMScheduleCardProps {
  pm: PreventiveMaintenance
  onTrigger?: (pm: PreventiveMaintenance) => void
  onPause?: (id: number) => void
  onResume?: (id: number) => void
  onArchive?: (id: number) => void
}

export function PMScheduleCard({ pm, onTrigger, onPause, onResume, onArchive }: PMScheduleCardProps) {
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
  const dueAt = pm.next_due_at ?? pm.next_due_date
  const compliance = pm.compliance_rate ?? 0
  const complianceColor = compliance >= 90 ? 'bg-green-500' : compliance >= 70 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col gap-3 h-full">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <PMStatusBadge status={pm.status} size="sm" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="PM actions">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800" sideOffset={4}>
                <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                  <Link to={`/preventive-maintenance/${pm.id}`}><Eye className="h-4 w-4" />View Details</Link>
                </DropdownMenu.Item>
                {isManager && (
                  <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                    <Link to={`/preventive-maintenance/${pm.id}/edit`}><Pencil className="h-4 w-4" />Edit Schedule</Link>
                  </DropdownMenu.Item>
                )}
                {isManager && pm.status === 'active' && (
                  <>
                    <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" onSelect={() => onTrigger?.(pm)}>
                      <Zap className="h-4 w-4" />Trigger Now
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" onSelect={() => onPause?.(pm.id)}>
                      <Pause className="h-4 w-4" />Pause Schedule
                    </DropdownMenu.Item>
                  </>
                )}
                {isManager && pm.status === 'paused' && (
                  <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" onSelect={() => onResume?.(pm.id)}>
                    <RotateCcw className="h-4 w-4" />Resume
                  </DropdownMenu.Item>
                )}
                {isAdmin && (
                  <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" onSelect={() => onArchive?.(pm.id)}>
                    <Archive className="h-4 w-4" />Archive
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* PM Name */}
        <Link to={`/preventive-maintenance/${pm.id}`} className="text-base font-semibold text-gray-900 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-400 line-clamp-2">
          {pm.name ?? pm.title}
        </Link>

        {/* Asset info */}
        {pm.asset && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">🔧 {pm.asset.name}</span>
            <span className="ml-1 text-gray-400">({pm.asset.asset_tag})</span>
          </div>
        )}
        {pm.asset?.location && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            📍 {pm.asset.location.name}
          </div>
        )}

        {/* Schedule info box */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2.5 space-y-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            ⏰ <span className="text-gray-600 dark:text-gray-400 text-xs">Next due:</span>
            <PMDueDateDisplay dueDate={dueAt} showIcon={false} className="text-xs" />
          </div>
          <div className="flex items-center gap-1.5">
            <PMFrequencyBadge
              frequencyType={pm.frequency_type}
              frequencyValue={pm.frequency_value}
              frequencyUnit={pm.frequency_unit}
              calendarDayOfMonth={pm.calendar_day_of_month}
              calendarDayOfWeek={pm.calendar_day_of_week}
              frequency={pm.frequency}
            />
          </div>
          {pm.assignee && (
            <div className="text-xs text-gray-500">👤 {pm.assignee.full_name}</div>
          )}
        </div>

        {/* Compliance bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Compliance</span>
            <span className={cn('font-medium', compliance >= 90 ? 'text-green-600' : compliance >= 70 ? 'text-yellow-600' : 'text-red-600')}>
              {compliance}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div className={cn('h-full rounded-full transition-all', complianceColor)} style={{ width: `${compliance}%` }} />
          </div>
          <div className="flex gap-3 mt-1 text-xs text-gray-400">
            {pm.completed_count != null && <span>✅ {pm.completed_count}</span>}
            {pm.skipped_count != null && <span>⏭ {pm.skipped_count} skipped</span>}
            {pm.missed_count != null && <span>❌ {pm.missed_count} missed</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2">
          {isManager && pm.status === 'active' && (
            <Button variant="outline" size="sm" onClick={() => onTrigger?.(pm)} className="flex-1">
              <Play className="h-3.5 w-3.5 mr-1" />Trigger Now
            </Button>
          )}
          <Link to={`/preventive-maintenance/${pm.id}`} className="flex-1">
            <Button variant="ghost" size="sm" className="w-full">View Details →</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
