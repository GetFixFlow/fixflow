import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, Zap } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday,
  isSameDay, addMonths, subMonths,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PMDueDateDisplay } from './PMDueDateDisplay'
import type { PreventiveMaintenance, Priority } from '@/types'

const PRIORITY_CHIP: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

interface PMCalendarViewProps {
  pms: PreventiveMaintenance[]
  onTrigger?: (pm: PreventiveMaintenance) => void
}

export function PMCalendarView({ pms, onTrigger }: PMCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedPM, setSelectedPM] = useState<PreventiveMaintenance | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  const pmsByDate = (day: Date) =>
    pms.filter((pm) => {
      const due = pm.next_due_at ?? pm.next_due_date
      return due && isSameDay(new Date(due), day)
    })

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {calDays.map((day) => {
          const dayPMs = pmsByDate(day)
          const inMonth = isSameMonth(day, currentMonth)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'bg-white dark:bg-gray-900 min-h-[80px] p-1.5',
                !inMonth && 'opacity-40',
                isToday(day) && 'ring-2 ring-brand-500 ring-inset',
              )}
            >
              <span className={cn('text-xs font-medium', isToday(day) ? 'text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300')}>
                {format(day, 'd')}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayPMs.slice(0, 3).map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setSelectedPM(pm)}
                    className={cn('w-full text-left text-xs rounded px-1 py-0.5 truncate', PRIORITY_CHIP[pm.priority ?? 'medium'])}
                    title={pm.name ?? pm.title}
                  >
                    {pm.name ?? pm.title}
                  </button>
                ))}
                {dayPMs.length > 3 && (
                  <span className="text-xs text-gray-400 px-1">+{dayPMs.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Side panel */}
      {selectedPM && (
        <div className="absolute right-0 top-0 z-20 w-72 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2">
              {selectedPM.name ?? selectedPM.title}
            </h3>
            <button onClick={() => setSelectedPM(null)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div><dt className="text-gray-400 text-xs">Asset</dt><dd>{selectedPM.asset?.name ?? '—'}</dd></div>
            <div><dt className="text-gray-400 text-xs">Next Due</dt><dd><PMDueDateDisplay dueDate={selectedPM.next_due_at ?? selectedPM.next_due_date} /></dd></div>
            {selectedPM.assignee && <div><dt className="text-gray-400 text-xs">Assigned to</dt><dd>{selectedPM.assignee.full_name}</dd></div>}
          </dl>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onTrigger?.(selectedPM); setSelectedPM(null) }} className="flex-1">
              <Zap className="h-3.5 w-3.5 mr-1" />Trigger
            </Button>
            <Link to={`/preventive-maintenance/${selectedPM.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedPM(null)}>Details</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
