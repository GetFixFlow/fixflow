import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { WorkOrder, Priority } from '@/types'

const PRIORITY_DOT: Record<Priority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
}

interface WorkOrderCalendarViewProps {
  workOrders: WorkOrder[]
}

export function WorkOrderCalendarView({ workOrders }: WorkOrderCalendarViewProps) {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const wosByDay = workOrders.reduce<Record<string, WorkOrder[]>>((acc, wo) => {
    if (!wo.due_date) return acc
    const key = format(new Date(wo.due_date), 'yyyy-MM-dd')
    if (!acc[key]) acc[key] = []
    acc[key].push(wo)
    return acc
  }, {})

  const selectedDayWOs = selectedDate
    ? workOrders.filter(
        (wo) => wo.due_date && isSameDay(new Date(wo.due_date), selectedDate),
      )
    : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="py-2 text-xs font-medium uppercase text-gray-400 dark:text-gray-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayWOs = wosByDay[key] ?? []
          const inMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)

          return (
            <div
              key={key}
              onClick={() => setSelectedDate(isSameDay(day, selectedDate ?? new Date(0)) ? null : day)}
              className={cn(
                'min-h-[90px] cursor-pointer bg-white p-2 dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800',
                !inMonth && 'bg-gray-50 dark:bg-gray-900/50',
                isToday(day) && 'ring-2 ring-inset ring-brand-400',
                isSelected && 'bg-brand-50 dark:bg-brand-900/20',
              )}
            >
              <div
                className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isToday(day)
                    ? 'bg-brand-600 text-white'
                    : inMonth
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-600',
                )}
              >
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5">
                {dayWOs.slice(0, 3).map((wo) => (
                  <button
                    key={wo.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/work-orders/${wo.id}`)
                    }}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        PRIORITY_DOT[wo.priority],
                      )}
                    />
                    <span className="truncate text-gray-700 dark:text-gray-300">{wo.title}</span>
                  </button>
                ))}
                {dayWOs.length > 3 && (
                  <p className="pl-1 text-xs text-gray-400">+{dayWOs.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected day panel */}
      {selectedDate && selectedDayWOs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
            {format(selectedDate, 'EEEE, MMMM d')} — {selectedDayWOs.length} work order
            {selectedDayWOs.length !== 1 && 's'}
          </h3>
          <div className="space-y-2">
            {selectedDayWOs.map((wo) => (
              <button
                key={wo.id}
                onClick={() => navigate(`/work-orders/${wo.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-100 p-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
              >
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[wo.priority])}
                />
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {wo.title}
                </span>
                <span className="font-mono text-xs text-gray-400">{wo.work_order_number}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
