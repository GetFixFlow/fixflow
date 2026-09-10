import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatHours } from '@/utils/chartUtils'
import type { Asset } from '@/types'

interface AssetHistory { month: string; corrective: number; pm: number; iot: number }
interface AssetDetailReportProps {
  asset: Asset
  stats: { total_wos: number; total_cost: number; avg_resolution_hours: number; pm_compliance: number; longest_downtime_hours: number }
  history: AssetHistory[]
  onClose?: () => void
}

export function AssetDetailReport({ asset, stats, history, onClose }: AssetDetailReportProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">{asset.name}</h3>
          <p className="text-sm text-gray-500">{asset.asset_tag}</p>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
          <dt className="text-xs text-gray-400">Total WOs</dt>
          <dd className="font-bold text-gray-900 dark:text-gray-100">{stats.total_wos}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
          <dt className="text-xs text-gray-400">Total Cost</dt>
          <dd className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.total_cost)}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
          <dt className="text-xs text-gray-400">Avg Resolution</dt>
          <dd className="font-bold text-gray-900 dark:text-gray-100">{formatHours(stats.avg_resolution_hours)}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
          <dt className="text-xs text-gray-400">PM Compliance</dt>
          <dd className="font-bold text-gray-900 dark:text-gray-100">{stats.pm_compliance}%</dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Maintenance History (12 months)</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={history} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} width={20} />
            <Tooltip />
            <Bar dataKey="corrective" name="Corrective" fill="#3b82f6" stackId="a" />
            <Bar dataKey="pm" name="PM" fill="#22c55e" stackId="a" />
            <Bar dataKey="iot" name="IoT" fill="#f59e0b" stackId="a" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Link to={`/assets/${asset.id}`} className="block text-center text-sm text-brand-600 hover:underline">
        View Full Asset Page →
      </Link>
    </div>
  )
}
