import { X } from 'lucide-react'
import { formatHours, formatPercent } from '@/utils/chartUtils'
import type { TechnicianStats } from './TechnicianScorecard'

interface TechnicianDetailPanelProps {
  stats: TechnicianStats | null
  onClose: () => void
}

export function TechnicianDetailPanel({ stats, onClose }: TechnicianDetailPanelProps) {
  if (!stats) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-80 bg-white dark:bg-gray-900 shadow-xl flex flex-col h-full border-l border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{stats.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-2">
            {([
              ['Completed', stats.completed + '/' + stats.assigned],
              ['Avg Resolution', formatHours(stats.avg_resolution_hours)],
              ['First-Time Fix', formatPercent(stats.first_time_fix_rate)],
              ['On-Time Rate', formatPercent(stats.on_time_rate)],
              ['Completion Rate', formatPercent(stats.completion_rate)],
              ['Critical Completed', String(stats.critical_completed)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className="font-bold text-gray-900 dark:text-gray-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
