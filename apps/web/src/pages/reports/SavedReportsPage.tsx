import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, Mail, Pencil, Play, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { SaveReportModal } from '@/components/reports/SaveReportModal'
import { useDeleteSavedReport, useSavedReports, useSendSavedReportNow } from '@/hooks/useSavedReports'
import { applySavedReport } from '@/lib/applySavedReport'
import { filtersSummary, PERIOD_LABELS, REPORT_PATHS, scheduleSummary } from '@/lib/savedReports'
import { formatDateTime } from '@/lib/localeFormat'
import type { SavedReport } from '@/types/savedReports'

/** Every saved report of the company: open one, see when it was last emailed, send yourself a copy, change or delete it. */
export function SavedReportsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useSavedReports()
  const remove = useDeleteSavedReport()
  const sendNow = useSendSavedReportNow()
  const [editing, setEditing] = useState<SavedReport | null>(null)

  const list = data?.saved_reports ?? []

  const open = (saved: SavedReport) => {
    applySavedReport(saved)
    navigate(REPORT_PATHS[saved.report])
  }

  const confirmDelete = (saved: SavedReport) => {
    const emailed = saved.send_on !== null ? ' It will no longer be emailed.' : ''
    if (!confirm(`Delete "${saved.name}"?${emailed}`)) return
    remove.mutate(saved.id)
  }

  return (
    <div className="space-y-4">
      <Link to="/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        <ArrowLeft className="h-4 w-4" />Reports
      </Link>
      <PageHeader
        title="Saved reports"
        description="Filters kept under a name. A saved report can also be emailed as a PDF every week."
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : isError ? (
        <EmptyState icon={Bookmark} title="The saved reports could not be loaded" action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved reports yet"
          description="Open Work Orders, Asset Health or PM Compliance, choose your filters, and press Save view."
          action={{ label: 'Go to reports', onClick: () => navigate('/reports') }}
        />
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {list.map((saved) => (
            <li key={saved.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-[220px] flex-1 space-y-0.5">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {saved.name} <Badge variant="secondary">{saved.title}</Badge>
                </p>
                <p className="text-xs text-gray-500">{PERIOD_LABELS[saved.period]}. {filtersSummary(saved.filters)}. Saved by {saved.owner.full_name}.</p>
                <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <Mail className="h-3 w-3" />{scheduleSummary(saved)}
                </p>
                {saved.last_sent_at && (
                  <p className="text-xs text-gray-500">Last sent {formatDateTime(saved.last_sent_at)}</p>
                )}
                {saved.last_error && <p role="alert" className="text-xs text-red-600">{saved.last_error}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => open(saved)} aria-label={`Open ${saved.name}`}>
                  <Play className="h-4 w-4" />Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={sendNow.isPending}
                  onClick={() => sendNow.mutate(saved.id)}
                  aria-label={`Email me ${saved.name} now`}
                >
                  <Mail className="h-4 w-4" />Email me now
                </Button>
                {saved.editable && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(saved)} aria-label={`Edit ${saved.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(saved)} aria-label={`Delete ${saved.name}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <SaveReportModal report={editing.report} saved={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
