import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, BarChart3, LayoutGrid, Table2, Calendar, Search } from 'lucide-react'
import { isBefore, addDays, startOfToday } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PMScheduleCard } from '@/components/pm/PMScheduleCard'
import { PMCalendarView } from '@/components/pm/PMCalendarView'
import { TriggerPMModal } from '@/components/pm/TriggerPMModal'
import { usePMs, usePausePM, useResumePM } from '@/hooks/usePreventiveMaintenance'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { PreventiveMaintenance } from '@/types'

type TabId = 'all' | 'due_soon' | 'overdue' | 'paused'
type ViewMode = 'cards' | 'table' | 'calendar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All Schedules' },
  { id: 'due_soon', label: 'Due Soon' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paused', label: 'Paused' },
]

function filterPMs(pms: PreventiveMaintenance[], tab: TabId, search: string, status: string): PreventiveMaintenance[] {
  const today = startOfToday()
  const in7 = addDays(today, 7)

  let filtered = pms
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (pm) =>
        (pm.name ?? pm.title ?? '').toLowerCase().includes(q) ||
        pm.asset?.name?.toLowerCase().includes(q),
    )
  }
  if (status && status !== 'all') filtered = filtered.filter((pm) => pm.status === status)

  switch (tab) {
    case 'due_soon': return filtered.filter((pm) => {
      const due = pm.next_due_at ?? pm.next_due_date
      if (!due || pm.status !== 'active') return false
      const d = new Date(due)
      return d >= today && d <= in7
    })
    case 'overdue': return filtered.filter((pm) => {
      const due = pm.next_due_at ?? pm.next_due_date
      if (!due || pm.status !== 'active') return false
      return isBefore(new Date(due), today)
    })
    case 'paused': return filtered.filter((pm) => pm.status === 'paused')
    default: return filtered
  }
}

export function PMListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const [tab, setTab] = useState<TabId>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('pm-view-mode') as ViewMode) ?? 'cards')
  const [triggerTarget, setTriggerTarget] = useState<PreventiveMaintenance | null>(null)

  const { data, isLoading } = usePMs()
  const pms = data?.preventive_maintenances ?? []
  const pausePM = usePausePM()
  const resumePM = useResumePM()

  const today = startOfToday()
  const in7 = addDays(today, 7)

  const tabCounts = useMemo(() => ({
    all: pms.length,
    due_soon: pms.filter((pm) => { const d = pm.next_due_at ?? pm.next_due_date; return d && new Date(d) >= today && new Date(d) <= in7 && pm.status === 'active' }).length,
    overdue: pms.filter((pm) => { const d = pm.next_due_at ?? pm.next_due_date; return d && isBefore(new Date(d), today) && pm.status === 'active' }).length,
    paused: pms.filter((pm) => pm.status === 'paused').length,
  }), [pms])

  const filtered = useMemo(() => filterPMs(pms, tab, search, statusFilter), [pms, tab, search, statusFilter])
  const activeCount = pms.filter((pm) => pm.status === 'active').length

  const setView = (v: ViewMode) => { setViewMode(v); localStorage.setItem('pm-view-mode', v) }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preventive Maintenance"
        description={`${activeCount} active schedule${activeCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <Link to="/preventive-maintenance/dashboard">
              <Button variant="outline"><BarChart3 className="h-4 w-4 mr-1.5" />Compliance Report</Button>
            </Link>
            {isManager && (
              <Link to="/preventive-maintenance/new">
                <Button><Plus className="h-4 w-4 mr-1.5" />New PM Schedule</Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-10 bg-white dark:bg-gray-950 pb-2 pt-1">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-9" placeholder="Search PM schedules..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          {/* View toggle */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
            {([['cards', LayoutGrid], ['table', Table2], ['calendar', Calendar]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v as ViewMode)}
                className={cn('px-2.5 py-2 text-sm transition-colors', viewMode === v ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50')}
                title={v}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')}
          >
            {t.label}
            {tabCounts[t.id] > 0 && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">{tabCounts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No PM schedules found"
          description={search ? 'Try adjusting your search or filters.' : 'Create your first preventive maintenance schedule.'}
          action={isManager ? { label: 'New PM Schedule', onClick: () => navigate('/preventive-maintenance/new') } : undefined}
        />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pm) => (
            <PMScheduleCard
              key={pm.id}
              pm={pm}
              onTrigger={setTriggerTarget}
              onPause={(id) => pausePM.mutate(id)}
              onResume={(id) => resumePM.mutate(id)}
            />
          ))}
        </div>
      ) : viewMode === 'calendar' ? (
        <PMCalendarView pms={filtered} onTrigger={setTriggerTarget} />
      ) : (
        // Table view
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {['Name', 'Asset', 'Frequency', 'Next Due', 'Assignee', 'Status', 'Compliance'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((pm) => {
                const dueAt = pm.next_due_at ?? pm.next_due_date
                const compliance = pm.compliance_rate ?? 0
                return (
                  <tr key={pm.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/preventive-maintenance/${pm.id}`)}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{pm.name ?? pm.title}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pm.asset?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pm.frequency_value ? `Every ${pm.frequency_value} ${pm.frequency_unit ?? 'days'}` : pm.frequency_type}</td>
                    <td className="px-4 py-3">{dueAt ? new Date(dueAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pm.assignee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3"><span className="capitalize">{pm.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div className={cn('h-full rounded-full', compliance >= 90 ? 'bg-green-500' : compliance >= 70 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${compliance}%` }} />
                        </div>
                        <span className="text-xs">{compliance}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {triggerTarget && (
        <TriggerPMModal open={!!triggerTarget} pm={triggerTarget} onClose={() => setTriggerTarget(null)} />
      )}
    </div>
  )
}
