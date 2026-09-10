import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MoreVertical } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import {
  useIotRules,
  usePauseIotRule,
  useResumeIotRule,
  useArchiveIotRule,
  useDuplicateIotRule,
} from '@/hooks/useIoT'
import { useAuthStore } from '@/stores/authStore'
import { TestRuleModal } from '@/components/iot/TestRuleModal'
import type { IotRuleExtended } from '@/types'

function formatCondition(rule: IotRuleExtended): string {
  const op = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=', outside_range: 'not between' }[rule.operator] ?? rule.operator
  if (rule.operator === 'outside_range') {
    return `${rule.metric_name} not between ${rule.threshold_min ?? '?'} and ${rule.threshold_max ?? '?'} ${rule.metric_unit ?? ''}`
  }
  return `${rule.metric_name} ${op} ${rule.threshold_value} ${rule.metric_unit ?? ''}`
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500', paused: 'bg-yellow-500', archived: 'bg-gray-400',
}

export function IoTRulesPage() {
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [testRule, setTestRule] = useState<IotRuleExtended | null>(null)

  const { data, isLoading } = useIotRules()
  const pause = usePauseIotRule()
  const resume = useResumeIotRule()
  const archive = useArchiveIotRule()
  const duplicate = useDuplicateIotRule()

  const allRules = (data?.iot_rules ?? []) as IotRuleExtended[]

  const filtered = allRules.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.metric_name?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      {testRule && (
        <TestRuleModal open={!!testRule} rule={testRule} onClose={() => setTestRule(null)} />
      )}

      <PageHeader
        title="IoT Rules"
        description={`${allRules.length} rule${allRules.length !== 1 ? 's' : ''} configured`}
        actions={
          isManager ? (
            <Link to="/iot/rules/new">
              <Button aria-label="New Rule"><Plus className="h-4 w-4 mr-1.5" />New Rule</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search rules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-2">📡</p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No IoT rules yet</p>
              {isManager && (
                <Link to="/iot/rules/new">
                  <Button className="mt-3">Create First Rule</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auto WO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cooldown</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={cn('h-2.5 w-2.5 rounded-full inline-block', STATUS_DOT[rule.status] ?? 'bg-gray-400')} />
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/iot/rules/${rule.id}/edit`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600">
                          {rule.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {rule.asset ? rule.asset.name : rule.asset_id ? `Asset #${rule.asset_id}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {formatCondition(rule)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {rule.auto_create_wo ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">{rule.wo_priority ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {rule.cooldown_minutes ? `${rule.cooldown_minutes}m` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {rule.last_triggered_at
                          ? formatDistanceToNow(new Date(rule.last_triggered_at), { addSuffix: true })
                          : rule.trigger_count
                            ? `${rule.trigger_count}×`
                            : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === rule.id ? null : rule.id)}
                            className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === rule.id && (
                            <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                              <Link
                                to={`/iot/rules/${rule.id}/edit`}
                                className="block px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                onClick={() => setOpenMenuId(null)}
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => {
                                  if (rule.status === 'active') pause.mutate(rule.id)
                                  else resume.mutate(rule.id)
                                  setOpenMenuId(null)
                                }}
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                {rule.status === 'active' ? 'Pause' : 'Resume'}
                              </button>
                              <button
                                onClick={() => { setTestRule(rule); setOpenMenuId(null) }}
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                Test Rule
                              </button>
                              <button
                                onClick={() => { duplicate.mutate(rule.id); setOpenMenuId(null) }}
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                Duplicate
                              </button>
                              <hr className="my-1 border-gray-100 dark:border-gray-700" />
                              <button
                                onClick={() => { archive.mutate(rule.id); setOpenMenuId(null) }}
                                className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Archive
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
