import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

interface PMForecastRow {
  id: number
  pm_title: string
  asset_name: string
  frequency: string
  next_due_date: string
  days_until_due: number
  assignee_name?: string
  estimated_hours?: number
  status: 'on_track' | 'due_soon' | 'overdue'
}

export function PMForecastTable({ rows }: { rows: PMForecastRow[] }) {
  const sorted = [...rows].sort((a, b) => a.days_until_due - b.days_until_due)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700 text-[10px] uppercase">
            <th className="text-left py-2 px-2">PM Task</th>
            <th className="text-left py-2">Asset</th>
            <th className="text-left py-2">Freq.</th>
            <th className="text-left py-2">Due Date</th>
            <th className="text-right py-2">Days</th>
            <th className="text-left py-2 px-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100 max-w-[160px] truncate">{row.pm_title}</td>
              <td className="py-2 text-gray-600 dark:text-gray-400 max-w-[120px] truncate">{row.asset_name}</td>
              <td className="py-2 capitalize text-gray-500">{row.frequency}</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">{format(parseISO(row.next_due_date), 'MMM d')}</td>
              <td className={cn('py-2 text-right font-semibold tabular-nums',
                row.days_until_due < 0 ? 'text-red-600' : row.days_until_due <= 7 ? 'text-amber-600' : 'text-gray-700')}>
                {row.days_until_due < 0 ? `${Math.abs(row.days_until_due)}d late` : row.days_until_due === 0 ? 'Today' : `${row.days_until_due}d`}
              </td>
              <td className="py-2 px-2">
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                  row.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  row.status === 'due_soon' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
                  {row.status === 'on_track' ? 'On Track' : row.status === 'due_soon' ? 'Due Soon' : 'Overdue'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
